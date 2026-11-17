<?php

namespace App\Support;

use App\Http\Requests\CarRequest;
use App\Http\Requests\ClientRequest;
use App\Models\Activity;
use App\Models\Agency;
use App\Models\Car;
use App\Models\Client;
use App\Models\Contract;
use App\Models\Payment;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * An agency's fleet, clients and rentals from spreadsheets (cars, clients, rentals: see columns()),
 * for agencies that join with a past. Used by POST import (the apps) and `agency:import` (us).
 *
 * Input errors are tolerated: each cell is read the way people type it (22 123 456, 90,5 DT,
 * 5/3/24, Gazoil, headers in French...) and every change is reported as a fix, `sure` when only
 * the format changed, a guess otherwise, for the user to confirm or correct. What can't be read is
 * an error with a translation key (`import:error:*`) for the apps.
 *
 * check() saves everything in a transaction that is then rolled back, so its report (new, updated,
 * unchanged, rejected) is exactly what apply() does. Rows are matched to what's there (cars by
 * plate, clients by phone, rentals by car, start and client), so importing again never doubles.
 */
class AgencyImport
{
    const KINDS = [ 'cars', 'clients', 'rentals' ]; // in this order: rentals name cars and clients
    const MAX_ROWS = 3000; // ponytail: ~2 ms and ~6 queries a row, per check and apply (15 s for 6,300 rows locally); a queued job if full files time out

    // Choice words, matched without case or accents; the first is the one templates and fixes write.
    const TRANSMISSIONS = [ Car::TRANSMISSION_TYPE_MANUAL => [ 'manuelle', 'manuel', 'manual', 'mécanique', 'bvm' ], Car::TRANSMISSION_TYPE_AUTO => [ 'automatique', 'auto', 'automatic', 'bva' ] ];
    const FUELS = [ 1 => [ 'essence', 'petrol', 'gasoline', 'sans plomb', 'benzine' ], 2 => [ 'diesel', 'gasoil', 'gazole' ] ]; // as the apps' labels
    const TYPES = [ Car::TYPE_COMPACT => [ 'citadine', 'compacte', 'compact' ], Car::TYPE_SEDAN => [ 'berline', 'sedan' ] ];
    const GENDERS = [ Client::GENDER_MALE => [ 'homme', 'h', 'm', 'male', 'masculin', 'monsieur', 'mr' ], Client::GENDER_FEMALE => [ 'femme', 'f', 'female', 'féminin', 'madame', 'mme', 'mlle' ] ];
    const FLAGS = [ Client::FLAG_UNPAID => [ 'impayé', 'unpaid', 'non payé' ], Client::FLAG_DAMAGE => [ 'dégât', 'damage', 'dégâts', 'accident' ], Client::FLAG_LATE => [ 'retard', 'late' ], Client::FLAG_OTHER => [ 'autre', 'other' ] ];
    const METHODS = [ Payment::METHOD_CASH => [ 'espèces', 'cash', 'liquide' ], Payment::METHOD_CARD => [ 'carte', 'card', 'cb', 'tpe' ], Payment::METHOD_TRANSFER => [ 'virement', 'transfer' ], Payment::METHOD_CHEQUE => [ 'chèque', 'cheque', 'check' ] ];
    // Where the apps translate each choice.
    const OPTION_LABELS = [ 'transmission' => 'car:transmission_type:', 'fuel' => 'car:fuel_type:', 'type' => 'car:type:', 'gender' => 'common:gender:', 'flag' => 'client:flag:', 'method' => 'payment:method:' ];

    const PLATE = [ 'plaque', 'immatriculation', 'matricule', 'numero immatriculation', 'plate', 'plaque immatriculation' ];
    const PHONE = [ 'telephone', 'tel', 'portable', 'mobile', 'gsm', 'numero', 'phone number', 'الهاتف' ];
    const PRICE = [ 'prix', 'prix jour', 'prix par jour', 'prix journalier', 'tarif', 'tarif jour', 'price', 'price per day' ];

    private Agency $agency;
    private array $seen = []; // a row's key => its line, for duplicates within a file
    private array $cars = []; // plate => id and phone => id, for the rentals file
    private array $clients = [];

    public function __construct(Agency $agency)
    {
        $this->agency = $agency;
    }

    /**
     * Each file's columns: type (how a cell is read), required, the apps' label, examples (the
     * template's two rows), header aliases, and the words of a choice.
     */
    public static function columns(string $kind): array
    {
        $column = fn (string $type, bool $required, string $label, array $examples, array $aliases = [], ?array $options = null) =>
            compact('type', 'required', 'label', 'examples', 'aliases', 'options');

        return match ($kind) {
            'cars' => [
                'licence_plate' => $column('plate', true, 'car:licence_plate', [ '245 تونس 1234', '198 تونس 6040' ], self::PLATE),
                'serial_number' => $column('vin', true, 'car:serial_number', [ 'VF1RJA00123456789', 'MALA841CBLM123456' ], [ 'vin', 'numero de serie', 'n de serie', 'no de serie', 'n serie', 'serie', 'chassis', 'numero de chassis', 'serial' ]),
                'manufacturer' => $column('text', true, 'car:manufacturer', [ 'Renault', 'Hyundai' ], [ 'marque', 'make', 'brand', 'constructeur' ]),
                'model_name' => $column('text', true, 'car:model_name', [ 'Clio 5', 'i10' ], [ 'modele', 'model' ]),
                'model_year' => $column('year', true, 'car:model_year', [ '2022', '2021' ], [ 'annee', 'year', 'annee modele', 'millesime' ]),
                'daily_price' => $column('money', true, 'contract:daily_price', [ '90', '70' ], self::PRICE),
                'fiscal_horse_power' => $column('int', true, 'car:fiscal_horse_power', [ '5', '4' ], [ 'puissance', 'puissance fiscale', 'cv', 'chevaux', 'horsepower' ]),
                'number_of_cylinders' => $column('int', true, 'car:number_of_cylinders', [ '4', '4' ], [ 'cylindres', 'cylinders', 'nombre de cylindres' ]),
                'transmission' => $column('choice', true, 'car:transmission_type', [ 'manuelle', 'automatique' ], [ 'boite', 'boite de vitesse', 'boite vitesse', 'gearbox', 'transmission type' ], self::TRANSMISSIONS),
                'fuel' => $column('choice', true, 'car:fuel_type', [ 'essence', 'diesel' ], [ 'carburant', 'energie', 'fuel type' ], self::FUELS),
                'type' => $column('choice', true, 'car:type', [ 'citadine', 'citadine' ], [ 'categorie', 'category', 'gamme' ], self::TYPES),
                'first_circulation_date' => $column('date', true, 'car:first_circulation_date', [ '15/03/2022', '10/06/2021' ], [ 'premiere mise en circulation', 'mise en circulation', 'date de premiere circulation', 'premiere circulation', 'dpmc', 'pmc' ]),
                'circulation_tax_ends_at' => $column('date', true, 'car:circulation_tax', [ '05/04/2027', '05/04/2027' ], [ 'vignette', 'taxe de circulation', 'fin vignette', 'fin de vignette' ]),
                'insurance_ends_at' => $column('date', true, 'car:insurance', [ '31/12/2026', '30/06/2027' ], [ 'assurance', 'fin assurance', 'fin d assurance', 'insurance' ]),
                'technical_control_ends_at' => $column('date', true, 'car:technical_control', [ '15/03/2027', '10/06/2027' ], [ 'visite technique', 'controle technique', 'fin visite', 'fin visite technique' ]),
                'colour' => $column('text', false, 'car:colour', [ 'Blanc', 'Gris' ], [ 'couleur', 'color' ]),
                'mileage' => $column('int', false, 'car:mileage', [ '48500', '61200' ], [ 'kilometrage', 'km', 'compteur', 'odometer', 'kilometres' ]),
            ],
            'clients' => [
                'first_name' => $column('text', true, 'form:first_name:label', [ 'Ahmed', 'Leila' ], [ 'prenom', 'firstname', 'nom complet', 'nom et prenom', 'nom prenom', 'name', 'full name', 'client', 'الاسم' ]),
                'last_name' => $column('text', true, 'form:last_name:label', [ 'Ben Ali', 'Trabelsi' ], [ 'nom', 'lastname', 'nom de famille', 'surname', 'اللقب' ]),
                'phone' => $column('phone', true, 'form:phone:label', [ '22 123 456', '98 765 432' ], self::PHONE),
                'gender' => $column('choice', false, 'form:gender:label', [ 'homme', 'femme' ], [ 'sexe', 'genre', 'sex' ], self::GENDERS),
                'birth_date' => $column('date', false, 'form:birth_date:label', [ '12/05/1988', '' ], [ 'date de naissance', 'naissance', 'ne le', 'birthday', 'date of birth' ]),
                'id_number' => $column('text', false, 'form:id_number:label', [ '09876543', '' ], [ 'cin', 'numero cin', 'carte d identite', 'carte identite', 'id' ]),
                'driver_licence_number' => $column('text', false, 'form:driver_licence_number:label', [ '12/345678', '' ], [ 'permis', 'numero de permis', 'numero permis', 'licence', 'license', 'driving licence' ]),
                'driver_licence_delivery_date' => $column('date', false, 'form:driver_licence_delivery_date:label', [ '20/06/2008', '' ], [ 'date du permis', 'date permis', 'permis delivre le', 'date d obtention', 'date de delivrance' ]),
                'driver_licence_expiry_date' => $column('date', false, 'form:driver_licence_expiry_date:label', [ '', '' ], [ 'expiration permis', 'fin permis', 'permis expire le', 'date d expiration' ]),
                'flag' => $column('choice', false, 'client:flag', [ '', '' ], [ 'liste noire', 'blacklist', 'signalement' ], self::FLAGS),
                'notes' => $column('text', false, 'client:notes', [ 'Client depuis 2019', '' ], [ 'note', 'remarque', 'remarques', 'commentaire', 'observations' ]),
                'rentals_before' => $column('int', false, 'client:rentals_before', [ '14', '' ], [ 'locations', 'nombre de locations', 'locations avant', 'rentals' ]),
            ],
            'rentals' => [
                'licence_plate' => $column('plate', true, 'car:licence_plate', [ '245 تونس 1234', '198 تونس 6040' ], [ ...self::PLATE, 'voiture' ]),
                'phone' => $column('phone', true, 'form:phone:label', [ '22 123 456', '98 765 432' ], [ ...self::PHONE, 'client' ]),
                'starts_at' => $column('datetime', true, 'contract:starts_at', [ '03/05/2026 10:00', '10/05/2026' ], [ 'debut', 'depart', 'date de depart', 'date debut', 'du', 'start', 'sortie' ]),
                'ends_at' => $column('datetime', true, 'contract:ends_at', [ '07/05/2026 10:00', '12/05/2026' ], [ 'fin', 'retour', 'date de retour', 'date fin', 'au', 'end' ]),
                'daily_price' => $column('money', false, 'contract:daily_price', [ '90', '' ], self::PRICE),
                'paid' => $column('money', false, 'import:column:paid', [ '360', '100' ], [ 'paye', 'montant paye', 'regle', 'avance', 'verse' ]),
                'method' => $column('choice', false, 'expense:method', [ 'espèces', 'chèque' ], [ 'mode de paiement', 'paiement', 'payment', 'mode' ], self::METHODS),
                'pickup_mileage' => $column('int', false, 'contract:past:mileage:pickup', [ '', '' ], [ 'km depart', 'kilometrage depart', 'compteur depart' ]),
                'return_mileage' => $column('int', false, 'contract:past:mileage:return', [ '', '' ], [ 'km retour', 'kilometrage retour', 'compteur retour' ]),
                'note' => $column('text', false, 'contract:note', [ 'Du cahier', '' ], [ 'notes', 'remarque', 'commentaire', 'observations' ]),
            ],
        };
    }

    /**
     * A file's template for Excel: the columns, then the two example rows, `;` between columns (what
     * French Excel expects) and a BOM (UTF-8, for Arabic names).
     */
    public static function template(string $kind): string
    {
        $columns = self::columns($kind);
        $file = fopen('php://temp', 'r+');
        fwrite($file, "\u{FEFF}");
        fputcsv($file, array_keys($columns), ';', '"', '', "\r\n");
        foreach ([ 0, 1 ] as $example) {
            fputcsv($file, array_map(fn ($column) => $column['examples'][$example], array_values($columns)), ';', '"', '', "\r\n");
        }
        rewind($file);

        return stream_get_contents($file);
    }

    /**
     * An uploaded file's rows: cells by column (the header matched to the columns through their
     * names and aliases, without case, accents or spacing, or close to one: a guess), empty
     * cells null, lines as the spreadsheet numbers them (the header is 1). Excel's ways are read
     * too: a BOM, Windows-1252, `;` between columns. An .xlsx or an empty file is refused.
     */
    public static function read(string $contents, string $kind): array
    {
        if (str_starts_with($contents, "PK\x03\x04") || str_starts_with($contents, "\xD0\xCF\x11\xE0")) {
            throw ValidationException::withMessages([ "files.$kind" => 'import:error:xlsx' ]);
        }
        $text = preg_replace('/^\xEF\xBB\xBF/', '', $contents);
        if (! mb_check_encoding($text, 'UTF-8')) {
            $text = mb_convert_encoding($text, 'UTF-8', 'Windows-1252');
        }
        $firstLine = (string) strtok($text, "\r\n");
        $delimiter = collect([ ';', ',', "\t" ])->sortByDesc(fn ($candidate) => substr_count($firstLine, $candidate))->first();

        $stream = fopen('php://memory', 'r+');
        fwrite($stream, $text);
        rewind($stream);
        $header = fgetcsv($stream, null, $delimiter, '"', '') ?: [];
        $columns = self::columns($kind);
        $matches = array_map(fn ($name) => self::matchHeader((string) $name, $columns), $header);
        $mapped = [];
        // Names read as they are first: a close name never takes the column another one names.
        foreach ([ true, false ] as $pass) {
            foreach ($matches as $index => [ $column, $sure ]) {
                if ($sure === $pass && $column !== null && ! in_array($column, $mapped, true)) {
                    $mapped[$index] = $column;
                }
            }
        }
        ksort($mapped);
        $fixes = [];
        $ignored = [];
        foreach ($header as $index => $name) {
            if (! isset($mapped[$index])) {
                if (trim((string) $name) !== '') {
                    $ignored[] = trim((string) $name);
                }
            } elseif (self::key($name) !== self::key($mapped[$index])) {
                $fixes[] = [ 'from' => trim((string) $name), 'to' => $mapped[$index], 'sure' => $matches[$index][1] ];
            }
        }

        $rows = [];
        for ($line = 2; ($cells = fgetcsv($stream, null, $delimiter, '"', '')) !== false; $line++) {
            $values = collect($mapped)->mapWithKeys(fn ($column, $index) => [ $column => filled(trim($cells[$index] ?? '')) ? trim($cells[$index]) : null ]);
            if (collect($cells)->filter(fn ($cell) => filled(trim((string) $cell)))->isNotEmpty()) {
                $rows[] = [ 'line' => $line, 'cells' => $values->all() ];
            }
        }
        fclose($stream);
        if (! $rows) {
            throw ValidationException::withMessages([ "files.$kind" => 'import:error:empty' ]);
        }
        if (count($rows) > self::MAX_ROWS) {
            throw ValidationException::withMessages([ "files.$kind" => 'import:error:too_many' ]);
        }

        return [
            'header' => [
                'fixes' => $fixes,
                'ignored' => $ignored,
                // A whole name in the first name's column is split: no last name column is needed then.
                'missing' => collect($columns)->filter(fn ($column, $name) => $column['required'] && ! in_array($name, $mapped, true)
                    && ! ($name === 'last_name' && in_array('first_name', $mapped, true)))->keys()->values()->all(),
            ],
            'rows' => $rows,
        ];
    }

    public function check(array $datasets): array
    {
        return $this->run($datasets, false);
    }

    public function apply(array $datasets): array
    {
        return $this->run($datasets, true);
    }

    /**
     * $datasets: kind => [ [ 'line' => int, 'cells' => [ column => string|null ] ], ... ]. Each row
     * comes back with its cells, the fixes made, the errors, and what it did (new, updated,
     * unchanged, rejected).
     */
    private function run(array $datasets, bool $apply): array
    {
        $report = [];
        DB::beginTransaction();
        try {
            foreach (array_intersect(self::KINDS, array_keys($datasets)) as $kind) {
                $this->seen = [];
                if ($kind === 'rentals') {
                    // After the cars and clients files: their rows count, even in a check.
                    $this->cars = $this->agency->cars()->pluck('id', 'licence_plate')->all();
                    $this->clients = $this->agency->clients()->pluck('id', 'phone')->all();
                }
                $rows = collect($datasets[$kind])->map(fn ($row) => $this->importRow($kind, (int) $row['line'], $row['cells']));
                $report[$kind] = [
                    'rows' => $rows->values()->all(),
                    'counts' => collect([ 'new', 'updated', 'unchanged', 'rejected' ])->mapWithKeys(fn ($result) => [ $result => $rows->where('result', $result)->count() ])->all(),
                ];
            }
        } catch (\Throwable $exception) {
            DB::rollBack();
            throw $exception;
        }
        $apply ? DB::commit() : DB::rollBack();

        return $report;
    }

    private function importRow(string $kind, int $line, array $cells): array
    {
        [ $values, $fixes, $errors ] = $this->normalize($kind, $cells);
        $result = 'rejected';
        if (! $errors) {
            $key = match ($kind) {
                'cars' => $values['licence_plate'],
                'clients' => $values['phone'],
                'rentals' => $values['licence_plate'] . '|' . $values['starts_at'] . '|' . $values['phone'],
            };
            if (isset($this->seen[$key])) {
                $errors[] = [ 'column' => $kind === 'clients' ? 'phone' : 'licence_plate', 'code' => 'import:error:duplicate', 'params' => [ 'line' => $this->seen[$key] ] ];
            } else {
                $this->seen[$key] = $line;
                try {
                    // A savepoint: a rejected row leaves nothing behind.
                    $result = DB::transaction(fn () => $this->{'save' . ucfirst($kind)}($values));
                } catch (ValidationException $exception) {
                    $errors = $this->errors($exception->validator);
                }
            }
        }

        return [ 'line' => $line, 'cells' => $cells, 'fixes' => $fixes, 'errors' => $errors, 'result' => $errors ? 'rejected' : $result ];
    }

    /**
     * The row's values (read from its cells), the fixes made reading them, and what couldn't be read.
     */
    private function normalize(string $kind, array $cells): array
    {
        $values = [];
        $fixes = [];
        $errors = [];
        $fix = function (string $column, ?string $from, ?string $to, bool $sure) use (&$fixes) {
            if ((string) $from !== (string) $to) {
                $fixes[] = compact('column', 'from', 'to', 'sure');
            }
        };
        foreach (self::columns($kind) as $name => $column) {
            $raw = isset($cells[$name]) && trim((string) $cells[$name]) !== '' ? trim((string) $cells[$name]) : null;
            if ($raw === null) {
                $values[$name] = null;
                if ($column['required']) {
                    $errors[] = [ 'column' => $name, 'code' => 'import:error:required', 'params' => [] ];
                }
                continue;
            }
            $read = $this->{'read' . ucfirst($column['type'])}($raw, $name, $column);
            if (isset($read['error'])) {
                $errors[] = [ 'column' => $name, 'code' => $read['error'], 'params' => $read['params'] ?? [] ];
                continue;
            }
            $values[$name] = $read['value'];
            $fix($name, $raw, $read['text'], $read['sure']);
        }
        if ($kind === 'clients' && $values['last_name'] === null && str_contains($values['first_name'] ?? '', ' ')) {
            // The whole name in one column.
            [ $first, $last ] = explode(' ', $values['first_name'], 2);
            $fixes = array_values(array_filter($fixes, fn ($item) => $item['column'] !== 'first_name'));
            $fix('first_name', $cells['first_name'], $first, false);
            $fix('last_name', null, $last, false);
            $errors = array_values(array_filter($errors, fn ($error) => $error['column'] !== 'last_name'));
            [ $values['first_name'], $values['last_name'] ] = [ $first, $last ];
        }
        if ($errors) {
            return [ $values, $fixes, $errors ];
        }

        // Across columns.
        foreach ([ 'cars', 'rentals' ] as $withPrice) {
            // 90000 for 90 dinars: typed in millimes.
            if ($kind === $withPrice && ($values['daily_price'] ?? 0) >= 5000000 && $values['daily_price'] % 1000000 === 0) {
                $values['daily_price'] /= 1000;
                $fixes = array_values(array_filter($fixes, fn ($item) => $item['column'] !== 'daily_price'));
                $fix('daily_price', $cells['daily_price'], self::dinars($values['daily_price']), false);
            }
        }
        if ($kind === 'rentals') {
            if ($values['ends_at'] < $values['starts_at']) {
                // Start and end the wrong way round.
                [ $values['starts_at'], $values['ends_at'] ] = [ $values['ends_at'], $values['starts_at'] ];
                $fixes = array_values(array_filter($fixes, fn ($item) => ! in_array($item['column'], [ 'starts_at', 'ends_at' ], true)));
                $fix('starts_at', $cells['starts_at'], $this->formatTime($values['starts_at']), false);
                $fix('ends_at', $cells['ends_at'], $this->formatTime($values['ends_at']), false);
            }
            if ($values['pickup_mileage'] !== null && $values['return_mileage'] !== null && $values['return_mileage'] < $values['pickup_mileage']) {
                $errors[] = [ 'column' => 'return_mileage', 'code' => 'import:error:mileage', 'params' => [] ];
            }
            if (! isset($this->cars[$values['licence_plate']])) {
                // One character off an existing plate.
                $close = collect(array_keys($this->cars))->filter(fn ($plate) => levenshtein(str_replace(' ', '', $plate), str_replace(' ', '', $values['licence_plate'])) <= 1);
                if ($close->count() === 1) {
                    $fixes = array_values(array_filter($fixes, fn ($item) => $item['column'] !== 'licence_plate'));
                    $fix('licence_plate', $cells['licence_plate'], $close->first(), false);
                    $values['licence_plate'] = $close->first();
                } else {
                    $errors[] = [ 'column' => 'licence_plate', 'code' => 'import:error:no_car', 'params' => [ 'plate' => $values['licence_plate'] ] ];
                }
            }
            if (! isset($this->clients[$values['phone']])) {
                $errors[] = [ 'column' => 'phone', 'code' => 'import:error:no_client', 'params' => [ 'phone' => $values['phone'] ] ];
            }
        }

        return [ $values, $fixes, $errors ];
    }

    private function saveCars(array $values): string
    {
        $data = [
            ...collect($values)->only([ 'licence_plate', 'serial_number', 'manufacturer', 'model_name', 'model_year', 'daily_price', 'fiscal_horse_power', 'number_of_cylinders', 'type', 'colour', 'mileage' ])->all(),
            'transmission_type' => $values['transmission'],
            'fuel_type' => $values['fuel'],
            'first_circulation_date' => $values['first_circulation_date']->format('d/m/Y'),
            'circulation_tax_ends_at' => $values['circulation_tax_ends_at']->getTimestamp(),
            'insurance_ends_at' => $values['insurance_ends_at']->getTimestamp(),
            'technical_control_ends_at' => $values['technical_control_ends_at']->getTimestamp(),
        ];
        $car = $this->agency->cars()->firstOrNew([ 'licence_plate' => $data['licence_plate'] ]);
        Validator::make($data, CarRequest::fields($this->agency->id, $car->id))->validate();

        return $this->save($car, $data);
    }

    private function saveClients(array $values): string
    {
        $date = fn ($value) => $value?->format('d/m/Y');
        $data = [
            ...collect($values)->only([ 'first_name', 'last_name', 'phone', 'gender', 'id_number', 'driver_licence_number', 'flag', 'notes' ])->all(),
            'birth_date' => $date($values['birth_date']),
            'driver_licence_delivery_date' => $date($values['driver_licence_delivery_date']),
            'driver_licence_expiry_date' => $date($values['driver_licence_expiry_date']),
            'rentals_before' => $values['rentals_before'] ?? 0,
        ];
        $client = $this->agency->clients()->firstOrNew([ 'phone' => $data['phone'] ]);
        Validator::make($data, ClientRequest::fields($this->agency->id, $client->id))->validate();

        return $this->save($client, $data);
    }

    /**
     * A rental already over is a past rental (PastRental); one under way is out since its start;
     * a later one is booked. Then the app handles them like any other.
     */
    private function saveRentals(array $values): string
    {
        $data = [
            ...collect($values)->only([ 'starts_at', 'ends_at', 'daily_price', 'paid', 'method', 'pickup_mileage', 'return_mileage', 'note' ])->all(),
            'car_id' => $this->cars[$values['licence_plate']],
            'client_id' => $this->clients[$values['phone']],
        ];
        Validator::make($data, [ ...PastRental::rules($this->agency), 'ends_at' => 'required|integer|gt:starts_at' ])->validate();
        // Imported already; another client then is an overlap.
        if ($this->agency->contracts()->where('car_id', $data['car_id'])->where('starts_at', $data['starts_at'])->where('client_id', $data['client_id'])->exists()) {
            return 'unchanged';
        }
        if ($data['ends_at'] <= time()) {
            PastRental::record($this->agency, $data);
            return 'new';
        }

        $car = Contract::lockFreeCar($this->agency, $data['car_id'], $data['starts_at'], $data['ends_at'], 'starts_at');
        $contract = $car->contracts()->make([
            'client_id' => $data['client_id'],
            'daily_price' => $data['daily_price'] ?? Pricing::quote($this->agency, $car, $data['starts_at'], $data['ends_at'])['daily_price'],
            'starts_at' => $data['starts_at'],
            'ends_at' => $data['ends_at'],
            'note' => $data['note'],
        ]);
        if ($data['starts_at'] <= time()) {
            $contract->forceFill([ 'status' => Contract::STATUS_OUT, 'picked_up_at' => $data['starts_at'], 'pickup_mileage' => $data['pickup_mileage'] ]);
        }
        $contract->save();
        Activity::record($contract, 'recorded', [ 'amount' => (int) $data['paid'] ]);
        if ($data['paid']) {
            $contract->payments()->create([ 'amount' => $data['paid'], 'method' => $data['method'] ?? Payment::METHOD_CASH, 'paid_at' => min($data['starts_at'], time()), 'user_id' => auth()->id() ]);
        }

        return 'new';
    }

    private function save($model, array $data): string
    {
        $isNew = ! $model->exists;
        $model->fill($data);
        if (! $isNew && ! $model->isDirty()) {
            return 'unchanged';
        }
        $model->save();

        return $isNew ? 'new' : 'updated';
    }

    /**
     * The rules a row broke, as the apps' keys, on its columns.
     */
    private function errors($validator): array
    {
        $columns = [ 'transmission_type' => 'transmission', 'fuel_type' => 'fuel', 'car_id' => 'licence_plate', 'client_id' => 'phone' ];
        $codes = [
            'Required' => 'import:error:required', 'Unique' => 'import:error:taken', 'Regex' => 'import:error:phone',
            'Before' => 'import:error:future', 'BeforeOrEqual' => 'import:error:future', 'Min' => 'import:error:too_small', 'Max' => 'import:error:too_big',
        ];
        $failed = $validator->failed();
        if (! $failed) {
            // Thrown with a message: the API's own keys (contract:overlap, car:sold).
            return collect($validator->errors()->messages())->map(fn ($messages, $field) => [
                'column' => $columns[$field] ?? $field,
                'code' => preg_match('/^[a-z_]+(:[a-z_]+)+$/', $messages[0]) ? $messages[0] : 'import:error:invalid',
                'params' => [],
            ])->values()->all();
        }

        return collect($failed)->map(function ($rules, $field) use ($columns, $codes, $validator) {
            $rule = array_key_first($rules);
            $code = $codes[$rule] ?? 'import:error:invalid';
            if ($rule === 'Max' && ! is_numeric($validator->getData()[$field] ?? null)) {
                $code = 'import:error:too_long';
            }
            $params = in_array($rule, [ 'Min', 'Max' ], true) ? [ strtolower($rule) => $rules[$rule][0] ] : [];

            return [ 'column' => $columns[$field] ?? $field, 'code' => $code, 'params' => $params ];
        })->values()->all();
    }

    // Reading cells: [ value, text (the cell as it will be read again without a fix), sure ], or [ error ].

    private function ok($value, string $text, bool $sure = true): array
    {
        return compact('value', 'text', 'sure');
    }

    private function readText(string $raw): array
    {
        $text = preg_replace('/[ \t\x{a0}]+/u', ' ', $raw); // line breaks stay (notes)

        return $this->ok($text, $text);
    }

    private function readPlate(string $raw): array
    {
        $text = Car::normalizePlate($raw);

        return $this->ok($text, $text);
    }

    private function readVin(string $raw): array
    {
        $text = strtoupper(preg_replace('/[\s\-.]/', '', $raw));

        return $this->ok($text, $text);
    }

    /**
     * A count: 48 500, 48.500 or 48500 km.
     */
    private function readInt(string $raw): array
    {
        $digits = preg_replace('/[\s\x{a0}.]|km$/iu', '', $raw);

        return ctype_digit($digits) ? $this->ok((int) $digits, (string) (int) $digits) : [ 'error' => 'import:error:number' ];
    }

    /**
     * Four digits; two are a guess (22: 2022, 98: 1998).
     */
    private function readYear(string $raw): array
    {
        if (preg_match('/^\d{4}$/', $raw)) {
            return $this->ok((int) $raw, $raw);
        }
        if (preg_match('/^\d{2}$/', $raw)) {
            $year = (int) $raw + ((int) $raw <= (int) date('y') + 1 ? 2000 : 1900);
            return $this->ok($year, (string) $year, false);
        }

        return [ 'error' => 'import:error:number' ];
    }

    /**
     * Dinars as typed (90, 90,5, 1 200.500, 90 DT) in millimes.
     */
    private function readMoney(string $raw): array
    {
        $value = preg_replace('/[\s\x{a0}]|dt|tnd|dinars?|د\.?ت/iu', '', $raw);
        if (str_contains($value, ',') && str_contains($value, '.')) {
            $value = strrpos($value, ',') > strrpos($value, '.') ? str_replace('.', '', $value) : str_replace(',', '', $value);
        }
        if (! preg_match('/^(\d+)(?:[.,](\d{1,3}))?$/', $value, $match)) {
            return [ 'error' => 'import:error:amount' ];
        }
        $millimes = (int) $match[1] * 1000 + (int) str_pad($match[2] ?? '', 3, '0');

        return $this->ok($millimes, self::dinars($millimes));
    }

    /**
     * dd/mm/yyyy (also with - or ., one digit, or yyyy-mm-dd). Guesses: a two-digit year, the
     * month first (03/25/2024), an Excel day number (45356).
     */
    private function readDate(string $raw): array
    {
        $value = str_replace([ '-', '.', ' ' ], '/', $raw);
        $sure = true;
        if (preg_match('/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/', $value, $match)) {
            [ $year, $month, $day ] = [ (int) $match[1], (int) $match[2], (int) $match[3] ];
        } elseif (preg_match('/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/', $value, $match)) {
            [ $day, $month, $year ] = [ (int) $match[1], (int) $match[2], (int) $match[3] ];
            if (strlen($match[3]) === 2) {
                $year += $year <= (int) date('y') + 10 ? 2000 : 1900;
                $sure = false;
            }
            if ($month > 12 && $day <= 12) {
                [ $day, $month ] = [ $month, $day ];
                $sure = false;
            }
        } elseif (preg_match('/^\d{5}$/', $raw) && (int) $raw > 20000 && (int) $raw < 60000) {
            $date = (new DateTimeImmutable('1899-12-30', new DateTimeZone(Agency::TIMEZONE)))->modify("+$raw days");
            return $this->ok($date, $date->format('d/m/Y'), false);
        } else {
            return [ 'error' => 'import:error:date' ];
        }
        if (! checkdate($month, $day, $year)) {
            return [ 'error' => 'import:error:date' ];
        }
        $date = (new DateTimeImmutable('now', new DateTimeZone(Agency::TIMEZONE)))->setDate($year, $month, $day)->setTime(0, 0);

        return $this->ok($date, $date->format('d/m/Y'), $sure);
    }

    /**
     * A day and a time (10:00, 10h, 10h30); without a time, the agency's usual pickup (start) or
     * return (end) time. A Unix timestamp.
     */
    private function readDatetime(string $raw, string $name): array
    {
        $time = null;
        $date = preg_replace_callback('/\s+(?:à\s+)?(\d{1,2})\s*(?:[:hH.]\s*(\d{2})?)?\s*$/u', function ($match) use (&$time) {
            $time = [ (int) $match[1], (int) ($match[2] ?? 0) ];
            return '';
        }, $raw);
        if ($time && ($time[0] > 23 || $time[1] > 59)) {
            return [ 'error' => 'import:error:date' ];
        }
        $day = $this->readDate(trim($date));
        if (isset($day['error'])) {
            return $day;
        }
        $time ??= array_map('intval', explode(':', $name === 'starts_at' ? $this->agency->pickup_time : $this->agency->return_time));
        $timestamp = $day['value']->setTime(...$time)->getTimestamp();

        return $this->ok($timestamp, $this->formatTime($timestamp), $day['sure']);
    }

    /**
     * +216 and eight digits, from 22 123 456, 0021622123456... Guesses: a leading 0 (022 123 456),
     * letters for digits (5O 222 333).
     */
    private function readPhone(string $raw): array
    {
        $sure = ! preg_match('/[OoIl]/', $raw);
        $digits = preg_replace('/\D/', '', strtr($raw, [ 'O' => '0', 'o' => '0', 'I' => '1', 'l' => '1' ]));
        if (strlen($digits) === 9 && $digits[0] === '0') {
            $digits = substr($digits, 1);
            $sure = false;
        }
        $phone = match (true) {
            strlen($digits) === 8 => '+216' . $digits,
            (bool) preg_match('/^(?:00)?(216\d{8})$/', $digits, $match) => '+' . $match[1],
            default => null,
        };

        return $phone ? $this->ok($phone, $phone, $sure) : [ 'error' => 'import:error:phone' ];
    }

    /**
     * One of the column's words or numbers; within two letters of a word, a guess.
     */
    private function readChoice(string $raw, string $name, array $column): array
    {
        if (ctype_digit($raw) && isset($column['options'][(int) $raw])) {
            return $this->ok((int) $raw, $raw);
        }
        $typed = self::key($raw);
        $best = null;
        foreach ($column['options'] as $value => $words) {
            foreach ($words as $word) {
                $distance = levenshtein($typed, self::key($word));
                if ($distance === 0) {
                    return $this->ok($value, $raw);
                }
                if (strlen(self::key($word)) >= 4 && $distance <= 2 && (! $best || $distance < $best[1])) {
                    $best = [ $value, $distance ];
                }
            }
        }

        return $best ?
            $this->ok($best[0], $column['options'][$best[0]][0], false) :
            [ 'error' => 'import:error:choice', 'params' => [ 'options' => collect($column['options'])->map(fn ($words) => $words[0])->implode(', ') ] ];
    }

    /**
     * A header's column: its name or an alias, sure; a letter off one of 5 letters or more (Anée),
     * or two off one of 6 or more, a guess.
     */
    private static function matchHeader(string $name, array $columns): array
    {
        $typed = self::key($name);
        if ($typed === '') {
            return [ null, true ];
        }
        $best = null;
        foreach ($columns as $column => $spec) {
            foreach ([ $column, ...$spec['aliases'] ] as $alias) {
                $distance = levenshtein($typed, self::key($alias));
                if ($distance === 0) {
                    return [ $column, true ];
                }
                $length = strlen(self::key($alias));
                if ($distance <= ($length >= 6 ? 2 : ($length >= 5 ? 1 : 0)) && (! $best || $distance < $best[1])) {
                    $best = [ $column, $distance ];
                }
            }
        }

        return $best ? [ $best[0], false ] : [ null, true ];
    }

    /**
     * For comparing words: lowercase, no accents, letters and digits only.
     */
    private static function key(string $text): string
    {
        $text = strtr(mb_strtolower(trim($text)), [
            'à' => 'a', 'â' => 'a', 'ä' => 'a', 'á' => 'a', 'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e', 'î' => 'i', 'ï' => 'i', 'í' => 'i',
            'ô' => 'o', 'ö' => 'o', 'ó' => 'o', 'ù' => 'u', 'û' => 'u', 'ü' => 'u', 'ú' => 'u', 'ç' => 'c', 'œ' => 'oe',
        ]);

        return preg_replace('/[^\p{L}\p{N}]/u', '', $text);
    }

    private static function dinars(int $millimes): string
    {
        return rtrim(rtrim(number_format($millimes / 1000, 3, '.', ''), '0'), '.');
    }

    private function formatTime(int $timestamp): string
    {
        return (new DateTimeImmutable('@' . $timestamp))->setTimezone(new DateTimeZone(Agency::TIMEZONE))->format('d/m/Y H:i');
    }
}
