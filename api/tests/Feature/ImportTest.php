<?php

namespace Tests\Feature;

use App\Models\Car;
use App\Models\Client;
use App\Models\Contract;
use App\Models\User;
use App\Support\AgencyImport;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

/**
 * The owner imports spreadsheets from the apps: a guide and templates, then a check that fixes
 * what people type and asks about its guesses, then the rows saved once confirmed.
 */
class ImportTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create()->refresh();
    }

    private function csv(string $name, array $lines): UploadedFile
    {
        return UploadedFile::fake()->createWithContent("$name.csv", implode("\n", $lines));
    }

    public function test_the_guide_lists_each_files_columns_with_a_template_to_download(): void
    {
        $guide = $this->actingAsUser($this->owner)->getJson('/api/import')->assertOk()->json('data');
        $this->assertSame([ 'cars', 'clients', 'rentals' ], array_keys($guide));
        $this->assertSame([ 'name' => 'licence_plate', 'type' => 'plate', 'required' => true, 'label' => 'car:licence_plate', 'example' => '245 تونس 1234', 'options' => null ], $guide['cars']['columns'][0]);
        $fuel = collect($guide['cars']['columns'])->firstWhere('name', 'fuel');
        $this->assertSame([ 'value' => 2, 'label' => 'car:fuel_type:2', 'words' => [ 'diesel', 'gasoil', 'gazole' ] ], $fuel['options'][1]);

        // The phone's browser downloads it without a session.
        $this->withoutToken();
        $template = $this->get($guide['clients']['template_url'])->assertOk()->assertHeader('Content-Disposition', 'attachment; filename="clients.csv"')->getContent();
        $this->assertStringStartsWith("\u{FEFF}first_name;last_name;phone;", $template);
        $this->assertStringContainsString('Ahmed;"Ben Ali";"22 123 456";homme', $template);
        $this->get('/api/import/template/clients')->assertForbidden();

        // The owner's.
        $manager = User::factory()->create([ 'agency_id' => $this->owner->agency_id, 'role' => User::ROLE_MANAGER ]);
        $this->actingAsUser($manager)->getJson('/api/import')->assertForbidden();
        $this->actingAsUser($manager)->postJson('/api/import', [ 'rows' => [ 'cars' => [] ] ])->assertForbidden();
    }

    public function test_a_messy_file_is_read_with_its_fixes_then_saved_with_the_users_corrections(): void
    {
        $files = [
            'cars' => $this->csv('cars', [
                'Immatriculation;N° de série;Marque;Modèle;Année;Prix/jour;Puissance;Cylindres;Boîte;Carburant;Catégorie;Mise en circulation;Vignette;Assurance;Visite technique;Couleur;Kilométrage;Divers',
                '777tu77;vf1 234;Kia;Picanto;21;90000;4;3;manuel;Gazoil;citadine;31/3/21;05.04.2027;2027-01-31;45700;Blanc;61.200 km;x',
            ]),
            'clients' => $this->csv('clients', [ 'Nom complet;Téléphone;Sexe', 'Sami Ben Salah;022 111 333;Mr' ]),
            'rentals' => $this->csv('rentals', [ 'plaque;tel;debut;fin;prix;payé;paiement', '777 TU 78;22111333;12/09/2026 18h;08/09/2026 10h30;90;;cheq' ]),
        ];
        $report = $this->actingAsUser($this->owner)->post('/api/import', [ 'files' => $files ], [ 'Accept' => 'application/json' ])->assertOk()->json('data');
        $this->assertSame([ 0, 0, 0 ], [ Car::count(), Client::count(), Contract::count() ]); // a check saves nothing

        $cars = $report['cars'];
        $this->assertContains([ 'from' => 'Immatriculation', 'to' => 'licence_plate', 'sure' => true ], $cars['header']['fixes']);
        $this->assertSame([ 'Divers' ], $cars['header']['ignored']);
        $this->assertSame([], $cars['header']['missing']);
        $fixes = collect($cars['rows'][0]['fixes'])->keyBy('column');
        $this->assertSame([ 'from' => '777tu77', 'to' => '777 تونس 77', 'sure' => true ], collect($fixes['licence_plate'])->except('column')->all());
        $this->assertSame([ '2021', false ], [ $fixes['model_year']['to'], $fixes['model_year']['sure'] ]);
        $this->assertSame([ '90', false ], [ $fixes['daily_price']['to'], $fixes['daily_price']['sure'] ]); // typed in millimes
        $this->assertSame([ 'diesel', false ], [ $fixes['fuel']['to'], $fixes['fuel']['sure'] ]);
        $this->assertSame([ '12/02/2025', false ], [ $fixes['technical_control_ends_at']['to'], $fixes['technical_control_ends_at']['sure'] ]); // an Excel day number
        $this->assertSame([ '61200', true ], [ $fixes['mileage']['to'], $fixes['mileage']['sure'] ]);
        $this->assertSame([ [], 'new', 2 ], [ $cars['rows'][0]['errors'], $cars['rows'][0]['result'], $cars['rows'][0]['line'] ]);

        $client = collect($report['clients']['rows'][0]['fixes'])->keyBy('column');
        $this->assertSame([ 'Sami', 'Ben Salah', '+21622111333', false ], [ $client['first_name']['to'], $client['last_name']['to'], $client['phone']['to'], $client['phone']['sure'] ]);
        $this->assertSame([], $report['clients']['header']['missing']); // the whole name is split
        $rental = collect($report['rentals']['rows'][0]['fixes'])->keyBy('column');
        $this->assertSame([ '777 تونس 77', '08/09/2026 10:30', '12/09/2026 18:00', 'chèque' ], [ $rental['licence_plate']['to'], $rental['starts_at']['to'], $rental['ends_at']['to'], $rental['method']['to'] ]);
        $this->assertSame('new', $report['rentals']['rows'][0]['result']);

        // The owner accepts the guesses but knows better for the fuel: the rows go back with their cells.
        $rows = collect($report)->map(fn ($dataset) => collect($dataset['rows'])->map(fn ($row) => [ 'line' => $row['line'], 'cells' => $row['cells'] ])->all())->all();
        $rows['cars'][0]['cells']['fuel'] = 'essence';
        $again = $this->actingAsUser($this->owner)->postJson('/api/import', [ 'rows' => $rows ])->assertOk()->json('data');
        $this->assertNotContains('fuel', array_column($again['cars']['rows'][0]['fixes'], 'column'));
        $this->assertArrayNotHasKey('header', $again['cars']);

        $this->actingAsUser($this->owner)->postJson('/api/import', [ 'rows' => $rows, 'apply' => true ])->assertOk()
            ->assertJsonPath('data.cars.counts.new', 1)
            ->assertJsonPath('data.rentals.counts.new', 1);
        $car = Car::sole();
        $this->assertSame([ '777 تونس 77', 'VF1234', 1, 90000, 2021, 61200 ], [ $car->licence_plate, $car->serial_number, $car->fuel_type, $car->daily_price, $car->model_year, $car->mileage ]);
        $this->assertSame([ 'Sami', 'Ben Salah', '+21622111333', Client::GENDER_MALE ], [ Client::sole()->first_name, Client::sole()->last_name, Client::sole()->phone, Client::sole()->gender ]);
        $this->assertSame(Contract::STATUS_CLOSED, Contract::sole()->status); // over; paid left empty is paid in full

        // Again: nothing twice.
        $this->actingAsUser($this->owner)->postJson('/api/import', [ 'rows' => $rows, 'apply' => true ])->assertOk()
            ->assertJsonPath('data.cars.counts.unchanged', 1)
            ->assertJsonPath('data.clients.counts.unchanged', 1)
            ->assertJsonPath('data.rentals.counts.unchanged', 1);
        $this->assertSame([ 1, 1, 1 ], [ Car::count(), Client::count(), Contract::count() ]);
    }

    public function test_a_misspelt_column_name_is_a_guess_that_never_takes_a_column_named_exactly(): void
    {
        $this->assertContains([ 'from' => 'Anée', 'to' => 'model_year', 'sure' => false ], AgencyImport::read("Anée;Marque\n21;Kia", 'cars')['header']['fixes']);
        // Débit is a letter off début, which the next column is.
        $header = AgencyImport::read("Débit;Début;plaque\n1;2;3", 'rentals')['header'];
        $this->assertSame([ 'Débit' ], $header['ignored']);
        $this->assertContains([ 'from' => 'Début', 'to' => 'starts_at', 'sure' => true ], $header['fixes']);
    }

    public function test_what_cant_be_read_comes_back_as_keys_on_its_columns(): void
    {
        Car::factory()->create([ 'licence_plate' => '100 تونس 1' ]); // another agency's
        $cars = $this->csv('cars', [
            'licence_plate,serial_number,manufacturer,model_name,model_year,daily_price,fiscal_horse_power,number_of_cylinders,transmission,fuel,type,first_circulation_date,circulation_tax_ends_at,insurance_ends_at,technical_control_ends_at',
            '100 TU 1,VIN1,Kia,Rio,2022,80,5,4,manuelle,essence,citadine,01/01/2022,01/01/2027,01/01/2027,01/01/2027',
            '200 TU 2,VIN2,Kia,Rio,2022,80,5,4,volant,essence,citadine,31/02/2022,01/01/2027,01/01/2027,01/01/2027',
            '300 TU 3,VIN3,Kia,Rio,2022,80,5,4,manuelle,essence,citadine,01/01/2099,01/01/2027,01/01/2027,01/01/2027',
            '300 TU 3,VIN4,Kia,Rio,2022,80,5,4,manuelle,essence,citadine,01/01/2022,01/01/2027,01/01/2027,01/01/2027',
            ',VIN5,Kia,Rio,2022,80,5,4,manuelle,essence,citadine,01/01/2022,01/01/2027,01/01/2027,01/01/2027',
        ]);
        $clients = $this->csv('clients', [ 'first_name,last_name,phone', 'Ali,Ben,12345', 'Nadia,Jaziri,5O 222 333' ]);
        $report = $this->actingAsUser($this->owner)->post('/api/import', [ 'files' => [ 'cars' => $cars, 'clients' => $clients ] ], [ 'Accept' => 'application/json' ])->assertOk()->json('data');

        $errors = collect($report['cars']['rows'])->mapWithKeys(fn ($row) => [ $row['line'] => $row['errors'] ]);
        $this->assertSame([ [ 'column' => 'licence_plate', 'code' => 'import:error:taken', 'params' => [] ] ], $errors[2]);
        $this->assertSame([
            [ 'column' => 'transmission', 'code' => 'import:error:choice', 'params' => [ 'options' => 'manuelle, automatique' ] ],
            [ 'column' => 'first_circulation_date', 'code' => 'import:error:date', 'params' => [] ],
        ], $errors[3]);
        $this->assertSame('import:error:future', $errors[4][0]['code']);
        $this->assertSame([ [ 'column' => 'licence_plate', 'code' => 'import:error:duplicate', 'params' => [ 'line' => 4 ] ] ], $errors[5]); // the same plate twice
        $this->assertSame([ [ 'column' => 'licence_plate', 'code' => 'import:error:required', 'params' => [] ] ], $errors[6]);
        $this->assertSame([ 'new' => 0, 'updated' => 0, 'unchanged' => 0, 'rejected' => 5 ], $report['cars']['counts']);
        $this->assertSame('import:error:phone', $report['clients']['rows'][0]['errors'][0]['code']);
        $this->assertSame([ 'column' => 'phone', 'from' => '5O 222 333', 'to' => '+21650222333', 'sure' => false ], $report['clients']['rows'][1]['fixes'][0]); // a letter O

        // Written two ways, still the same plate.
        $twice = $this->csv('cars', [
            'licence_plate,serial_number,manufacturer,model_name,model_year,daily_price,fiscal_horse_power,number_of_cylinders,transmission,fuel,type,first_circulation_date,circulation_tax_ends_at,insurance_ends_at,technical_control_ends_at',
            '400 TU 4,VIN6,Kia,Rio,2022,80,5,4,manuelle,essence,citadine,01/01/2022,01/01/2027,01/01/2027,01/01/2027',
            '400tu4,VIN7,Kia,Rio,2022,80,5,4,manuelle,essence,citadine,01/01/2022,01/01/2027,01/01/2027,01/01/2027',
        ]);
        $this->actingAsUser($this->owner)->post('/api/import', [ 'files' => [ 'cars' => $twice ] ], [ 'Accept' => 'application/json' ])
            ->assertJsonPath('data.cars.rows.1.errors.0', [ 'column' => 'licence_plate', 'code' => 'import:error:duplicate', 'params' => [ 'line' => 2 ] ]);

        // An Excel workbook, an empty file, a file of no kind.
        $workbook = UploadedFile::fake()->createWithContent('cars.xlsx', "PK\x03\x04rest");
        $this->actingAsUser($this->owner)->post('/api/import', [ 'files' => [ 'cars' => $workbook ] ], [ 'Accept' => 'application/json' ])->assertJsonValidationErrors([ 'files.cars' => 'import:error:xlsx' ]);
        $this->actingAsUser($this->owner)->post('/api/import', [ 'files' => [ 'cars' => $this->csv('cars', [ 'licence_plate' ]) ] ], [ 'Accept' => 'application/json' ])->assertJsonValidationErrors([ 'files.cars' => 'import:error:empty' ]);
        $this->actingAsUser($this->owner)->postJson('/api/import', [ 'rows' => [ 'fines' => [] ] ])->assertJsonValidationErrors([ 'files' => 'import:error:kind' ]);
        $this->actingAsUser($this->owner)->postJson('/api/import', [ 'rows' => [ 'cars' => [ [ 'line' => 2, 'cells' => [ 'model_year' => [ 2022 ] ] ] ] ] ])->assertJsonValidationErrors([ 'rows.cars' => 'import:error:invalid' ]);
        $this->assertSame(1, Car::count()); // the other agency's
    }
}
