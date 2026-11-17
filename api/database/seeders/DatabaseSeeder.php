<?php

namespace Database\Seeders;

use App\Models\Activity;
use App\Models\Agency;
use App\Models\Branch;
use App\Models\Car;
use App\Models\CarBlock;
use App\Models\CashMovement;
use App\Models\Client;
use App\Models\Contract;
use App\Models\ContractPhoto;
use App\Models\Document;
use App\Models\Expense;
use App\Models\Fine;
use App\Models\Income;
use App\Models\Payment;
use App\Models\SalaryPayment;
use App\Models\User;
use App\Support\Pricing;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Demo data built around today's date, so the calendar, the rented cars and the availability
 * search always have something to show. Logins (password "azerty"):
 *   +21623456109  Demo Rent a Car owner (9 cars, the main test account)
 *   +21650111222  Demo Rent a Car manager, every branch (no reports, cash book, staff or settings)
 *   +21655667788  Demo Rent a Car manager of the airport branch (its 3 cars and the car in no branch)
 *   +21698765432  Sousse Cars (2 cars, to check that agencies don't see each other's data)
 * The staff list also has an invited manager (no password yet) and one who left (disabled).
 * Inspection photos and papers are generated pictures on the default disk.
 */
class DatabaseSeeder extends Seeder
{
    const TIMEZONE = 'Africa/Tunis';

    // [ manufacturer, model, year, daily price in TND, transmission, fuel ]
    // The app labels FUEL_TYPE_GAS as petrol ("Essence") and FUEL_TYPE_PETROL as diesel ("Gasoil").
    const FLEET = [
        [ 'Kia', 'Picanto', 2024, 90, Car::TRANSMISSION_TYPE_MANUAL, Car::FUEL_TYPE_GAS ],
        [ 'Hyundai', 'i10', 2023, 90, Car::TRANSMISSION_TYPE_MANUAL, Car::FUEL_TYPE_GAS ],
        [ 'Renault', 'Clio 5', 2024, 110, Car::TRANSMISSION_TYPE_MANUAL, Car::FUEL_TYPE_GAS ],
        [ 'Peugeot', '208', 2025, 120, Car::TRANSMISSION_TYPE_MANUAL, Car::FUEL_TYPE_GAS ],
        [ 'Volkswagen', 'Polo', 2023, 120, Car::TRANSMISSION_TYPE_AUTO, Car::FUEL_TYPE_GAS ],
        [ 'Dacia', 'Logan', 2022, 100, Car::TRANSMISSION_TYPE_MANUAL, Car::FUEL_TYPE_PETROL ],
        [ 'Seat', 'Ibiza', 2024, 130, Car::TRANSMISSION_TYPE_AUTO, Car::FUEL_TYPE_GAS ],
        [ 'Hyundai', 'Accent', 2025, 140, Car::TRANSMISSION_TYPE_AUTO, Car::FUEL_TYPE_PETROL ],
        [ 'Renault', 'Symbol', 2024, 95, Car::TRANSMISSION_TYPE_MANUAL, Car::FUEL_TYPE_PETROL ],
    ];

    // The airport counter rents the automatics. The Symbol is in no branch, so every manager sees it.
    const AIRPORT_MODELS = [ 'Polo', 'Ibiza', 'Accent' ];
    const NO_BRANCH_MODELS = [ 'Symbol' ];

    // Contracts from today on, per car of FLEET: [ start day, start hour, end day, end hour, state ],
    // days relative to today. History before the first one is generated. A contract that has
    // started is out (handed over), one that has ended is closed, except an overdue or returned one.
    const SCHEDULE = [
        [ [ -3, 10, 2, 18 ], [ 5, 10, 9, 10 ] ],                   // rented now, booked again next week
        [ [ -4, 10, 0, 18 ], [ 1, 10, 8, 10 ] ],                   // returns today, leaves again tomorrow
        [ [ 0, 14, 3, 14 ] ],                                      // picked up today
        [ [ -10, 8, 20, 8 ] ],                                     // long rental
        [ [ 3, 10, 6, 18 ], [ 10, 8, 17, 8 ] ],                    // free now, two upcoming bookings
        [ [ -5, 10, -1, 10, 'overdue' ] ],                         // should have come back yesterday
        [ [ -1, 18, 1, 18 ], [ 2, 10, 4, 10 ], [ 4, 14, 11, 14 ] ], // rented now, back-to-back bookings
        [ [ 12, 10, 26, 10 ] ],                                    // booked in two weeks
        [ [ -6, 10, -2, 10, 'returned' ] ],                        // came back late and dented, not settled yet
    ];

    const COLOURS = [ '#f5f5f5', '#1f1f1f', '#9e9e9e', '#c0c0c0', '#b71c1c', '#1565c0', '#f5f5f5', '#1f1f1f', '#c0c0c0' ];

    const CHILD_SEAT = [ 'name' => 'Siège enfant', 'price' => 5000, 'per' => 'day' ];
    const GPS = [ 'name' => 'GPS', 'price' => 8000, 'per' => 'day' ];

    // What the inspection photographs, in the order the app asks for it.
    const ANGLES = [
        ContractPhoto::ANGLE_FRONT => 'AVANT', ContractPhoto::ANGLE_BACK => 'ARRIERE', ContractPhoto::ANGLE_LEFT => 'COTE GAUCHE',
        ContractPhoto::ANGLE_RIGHT => 'COTE DROIT', ContractPhoto::ANGLE_INTERIOR => 'INTERIEUR',
    ];

    private CarbonImmutable $today;
    private Branch $centre;
    private Branch $airport;
    private User $owner;
    private User $manager;
    private User $airportManager;
    private User $formerManager;
    private User $invited;
    private User $otherOwner;
    private int $airportSince; // when Amine moved to the airport counter
    private int $formerLeftAt; // when Rania left

    public function run(): void
    {
        $this->today = $today = CarbonImmutable::today(self::TIMEZONE);

        $agency = Agency::factory()->create([
            'name' => "Demo Rent a Car",
            'created_at' => $today->subMonthsNoOverflow(40)->getTimestamp(), // joined before its oldest car came
            'phone' => '+21673123456',
            'address' => 'Avenue Habib Bourguiba, M\'saken',
            // This one takes a deposit (Sousse Cars doesn't, like many agencies).
            'takes_deposit' => true,
            'default_deposit' => 500000,
            'default_deposit_method' => Payment::METHOD_CHEQUE,
        ]);
        $agency->pricing = [
            'seasons' => [ [ 'name' => 'Été', 'from' => '01/07', 'to' => '31/08', 'percent' => 25 ] ],
            'discounts' => [ [ 'min_days' => 7, 'percent' => 10 ], [ 'min_days' => 30, 'percent' => 20 ] ],
            'extras' => [ self::CHILD_SEAT, self::GPS ],
            // Second driver and delivery are free, as in most Tunisian agencies; Tunis-Carthage is far.
            'second_driver_price' => 0,
            'locations' => [
                [ 'name' => 'Aéroport Monastir', 'fee' => 0 ],
                [ 'name' => 'Aéroport Enfidha', 'fee' => 0 ],
                [ 'name' => 'Tunis-Carthage', 'fee' => 80000 ],
                [ 'name' => 'Hôtel, Sousse', 'fee' => 0 ],
            ],
            // No charge for kilometres.
            'charge_extra_km' => false,
            'km_per_day' => 0,
            'extra_km_price' => 0,
            'late_grace_hours' => 2,
            'late_per' => 'day',
            'late_hour_price' => 0,
        ];
        $agency->save();
        $this->centre = $agency->branches()->create([ 'name' => "M'saken centre", 'address' => 'Avenue Habib Bourguiba', 'monthly_rent' => 800000 ]);
        $this->airport = $agency->branches()->create([ 'name' => 'Comptoir aéroport Monastir', 'monthly_rent' => 1200000 ]);
        $this->createStaff($agency);

        $clients = Client::factory()->count(30)->create([ 'agency_id' => $agency->id ]);
        // Booked by phone: their ID and licence are only taken at pickup.
        $clients->take(5)->each->update([ 'gender' => null, 'birth_date' => null, 'id_number' => null, 'driver_licence_number' => null, 'driver_licence_delivery_date' => null ]);
        // Remembered for a damage, lateness or something else, but still rented to.
        $flags = [ 5 => [ Client::FLAG_DAMAGE, 'Pare-choc rayé en juillet, a payé la réparation.' ], 6 => [ Client::FLAG_LATE, 'Rend souvent la voiture avec une demi-journée de retard.' ], 7 => [ Client::FLAG_OTHER, 'A fumé dans la voiture.' ] ];
        foreach ($flags as $index => [ $flag, $notes ]) {
            $clients[$index]->update([ 'flag' => $flag, 'notes' => $notes ]);
        }
        // Their ID card and licence, photographed at an earlier rental.
        foreach ($clients->slice(5, 6) as $client) {
            $this->paper($agency, $client, Document::TYPE_ID_CARD, 'CIN ' . $client->id_number, "$client->first_name $client->last_name");
            $this->paper($agency, $client, Document::TYPE_DRIVER_LICENCE, 'PERMIS ' . $client->driver_licence_number, "$client->first_name $client->last_name");
        }
        // Blacklisted after an unpaid rental, and back under a new phone number with the same ID card.
        $flagged = $clients->last();
        $flagged->update([ 'flag' => Client::FLAG_UNPAID, 'notes' => 'Parti sans payer 3 jours en mars, ne répond plus.' ]);
        Client::factory()->create([ 'agency_id' => $agency->id, 'first_name' => $flagged->first_name, 'last_name' => $flagged->last_name, 'id_number' => $flagged->id_number ]);
        // A regular since before the app: their rentals were in the notebook.
        $clients[1]->update([ 'rentals_before' => 12 ]);
        $clients = $clients->slice(0, -1); // not rented to again

        foreach (self::FLEET as $index => [ $manufacturer, $model, $year, $price, $transmission, $fuel ]) {
            $car = Car::factory()->create([
                'agency_id' => $agency->id,
                'branch_id' => in_array($model, self::NO_BRANCH_MODELS, true) ? null : (in_array($model, self::AIRPORT_MODELS, true) ? $this->airport->id : $this->centre->id),
                'manufacturer' => $manufacturer,
                'model_name' => $model,
                'model_year' => $year,
                'daily_price' => $price * 1000,
                'transmission_type' => $transmission,
                'fuel_type' => $fuel,
                'type' => in_array($model, [ 'Logan', 'Accent', 'Symbol' ], true) ? Car::TYPE_SEDAN : Car::TYPE_COMPACT,
                // Two cars have papers about to expire, for the expiry alerts.
                'insurance_ends_at' => $today->addDays($index === 2 ? 5 : 200 + $index * 20)->getTimestamp(),
                'circulation_tax_ends_at' => $today->addDays($index === 4 ? 12 : 150 + $index * 15)->getTimestamp(),
                'technical_control_ends_at' => $today->addDays(100 + $index * 30)->getTimestamp(),
                'colour' => self::COLOURS[$index],
                'mileage' => 10000 + $index * 7000,
            ]);
            $this->paper($agency, $car, Document::TYPE_CARTE_GRISE, 'CARTE GRISE', "$manufacturer $model $car->licence_plate");
            $this->paper($agency, $car, Document::TYPE_INSURANCE, 'ASSURANCE STAR', "$manufacturer $model $car->licence_plate");

            $schedule = array_map(fn ($contract) => [
                $today->addDays($contract[0])->setHour($contract[1]),
                $today->addDays($contract[2])->setHour($contract[3]),
                $contract[4] ?? null,
            ], self::SCHEDULE[$index]);

            $this->createHistory($car, $clients, $today->subDays(60), isset($schedule[0]) ? $schedule[0][0]->min($today) : $today);
            foreach ($schedule as [ $startsAt, $endsAt, $state ]) {
                $contract = $this->createContract($car, $clients->random(), $startsAt, $endsAt, $state);
                if ($state === 'returned') {
                    $this->bringBack($contract);
                }
            }
            $this->createExpenses($car, $today, $index === 3); // the long rental is due an oil change
        }
        $this->createCarMoney($agency, $clients, $today);
        $this->createAgencyCosts($agency, $today);
        $this->chargeDamage($agency->contracts()->where('contracts.status', Contract::STATUS_CLOSED)->orderByDesc('ends_at')->first());
        $this->createFines($agency, $today);
        $this->numberInvoices($agency);

        // Upcoming bookings delivered at the airport or a hotel (free), and a second driver on a car out now.
        $upcoming = $agency->contracts()->where('contracts.status', Contract::STATUS_RESERVED)->orderBy('starts_at')->take(2)->get();
        foreach ($upcoming as $index => $contract) {
            $contract->pickup_location = $index === 0 ? 'Aéroport Monastir' : 'Hôtel, Sousse';
            $contract->return_location = $contract->pickup_location;
            $contract->save();
        }
        $this->checkIn($agency, $upcoming->first());
        $out = $agency->contracts()->where('contracts.status', Contract::STATUS_OUT)->orderBy('starts_at')->first();
        $out->second_driver_id = $clients->where('id', '!=', $out->client_id)->whereNotNull('driver_licence_number')->first()->id;
        $out->save();

        // Booked by phone for later this month, then cancelled.
        $cancelled = $this->createContract($agency->cars()->where('model_name', 'Picanto')->first(), $clients->random(), $today->addDays(12)->setHour(10), $today->addDays(15)->setHour(10));
        $cancelled->status = Contract::STATUS_CANCELLED;
        $cancelled->save();
        $this->log($cancelled, 'cancelled', $this->manager, time());
        $cancelled->delete();

        // The Accent goes to the garage before its booking.
        $agency->cars()->where('model_name', 'Accent')->first()->blocks()->create([
            'starts_at' => $today->addDays(3)->setHour(8)->getTimestamp(),
            'ends_at' => $today->addDays(5)->setHour(18)->getTimestamp(),
            'reason' => CarBlock::REASON_MAINTENANCE,
            'note' => 'Vidange et freins',
        ]);

        // The till: change put in at the start of the month; the owner took some cash yesterday.
        $agency->cashMovements()->create([ 'type' => CashMovement::TYPE_ADDED, 'amount' => 200000, 'moved_at' => $today->startOfMonth()->setHour(8)->getTimestamp(), 'note' => 'Fond de caisse', 'user_id' => $this->owner->id ]);
        $agency->cashMovements()->create([ 'type' => CashMovement::TYPE_WITHDRAWAL, 'amount' => 500000, 'moved_at' => $today->subDay()->setHour(19)->getTimestamp(), 'user_id' => $this->owner->id ]);

        // Who hands over and takes back the coming cars (one in five isn't given to anyone yet).
        foreach ($agency->contracts()->with('car')->whereIn('contracts.status', [ Contract::STATUS_RESERVED, Contract::STATUS_OUT, Contract::STATUS_RETURNED ])->get() as $contract) {
            $staff = $contract->id % 5 ? $this->staffFor($contract->car, $contract)->id : null;
            $contract->pickup_user_id = $contract->status === Contract::STATUS_RESERVED ? $staff : null;
            $contract->return_user_id = $staff;
            $contract->save();
        }

        $otherAgency = Agency::factory()->create([ 'name' => 'Sousse Cars' ]);
        $this->otherOwner = User::factory()->for($otherAgency)->create([
            'first_name' => 'Other',
            'last_name' => 'Owner',
            'phone' => '+21698765432',
            'password' => 'azerty',
        ]);
        $otherClients = Client::factory()->count(5)->create([ 'agency_id' => $otherAgency->id ]);
        foreach (Car::factory()->count(2)->create([ 'agency_id' => $otherAgency->id ]) as $index => $car) {
            // The first one is off the road since today.
            $this->createHistory($car, $otherClients, $today->subDays(20), $index ? $today->addDays(20) : $today);
            if (! $index) {
                $car->update([ 'status' => Car::STATUS_OUT_OF_SERVICE ]);
            }
        }

        // Every car back from a rental was cleaned, but the last one and those waiting to be settled.
        $lastReturn = $agency->contracts()->where('contracts.status', Contract::STATUS_CLOSED)->orderByDesc('returned_at')->value('contracts.id');
        Contract::where('status', Contract::STATUS_CLOSED)->whereKeyNot($lastReturn)->update([ 'cleaned_at' => DB::raw('returned_at + 3600') ]);
    }

    /**
     * The owner and the staff: a manager for every branch, one moved to the airport counter, one
     * invited who hasn't set a password yet, and one who left (disabled), with their history.
     */
    private function createStaff(Agency $agency): void
    {
        $user = fn (string $firstName, string $lastName, string $phone, array $extra = []) => User::factory()->for($agency)->create([
            'first_name' => $firstName, 'last_name' => $lastName, 'phone' => $phone, 'password' => 'azerty', 'role' => User::ROLE_MANAGER, ...$extra,
        ]);
        $this->owner = $user('Test', 'Owner', '+21623456109', [ 'role' => User::ROLE_OWNER ]);
        $this->manager = $user('Sami', 'Manager', '+21650111222');
        $this->airportManager = $user('Amine', 'Jaziri', '+21655667788', [ 'branch_id' => $this->airport->id ]);
        $this->formerManager = $user('Rania', 'Ferchichi', '+21697111222');
        $this->invited = $user('Yassine', 'Hammami', '+21622333444', [ 'password' => null, 'branch_id' => $this->centre->id ]);
        $this->invited->issuePasswordCode(User::INVITE_TTL); // unknown here: the owner sends a new one from the staff screen

        $at = fn (int $days) => $this->today->addDays($days)->setHour(9)->getTimestamp();
        $this->airportSince = $at(-25);
        $this->formerLeftAt = $at(-20);
        $this->staffLog($this->manager, 'staff_added', $at(-730), [ 'role' => User::ROLE_MANAGER ]);
        $this->staffLog($this->formerManager, 'staff_added', $at(-400), [ 'role' => User::ROLE_MANAGER ]);
        $this->staffLog($this->formerManager, 'password_set', $at(-90));
        $this->staffLog($this->formerManager, 'disabled', $this->formerLeftAt);
        $this->staffLog($this->airportManager, 'staff_added', $at(-40), [ 'role' => User::ROLE_MANAGER, 'branch' => $this->centre->name ]);
        $this->staffLog($this->airportManager, 'updated', $this->airportSince, [ 'branch' => [ $this->centre->name, $this->airport->name ] ]);
        $this->staffLog($this->invited, 'staff_added', $at(-2), [ 'role' => User::ROLE_MANAGER, 'branch' => $this->centre->name ]);
        $this->staffLog($this->invited, 'invited', $at(-2));
        $this->formerManager->forceFill([ 'deleted_at' => $this->formerLeftAt ])->save();
    }

    // Per car of FLEET: months since its first registration, and its price in TND. The Logan
    // must leave the fleet in two months, the i10 in five (the 3-year rule).
    const PURCHASES = [ [ 20, 48000 ], [ 31, 50000 ], [ 22, 62000 ], [ 10, 70000 ], [ 28, 72000 ], [ 34, 52000 ], [ 18, 68000 ], [ 6, 75000 ], [ 26, 44000 ] ];
    // Bought on credit: 30 % down, the rest over 36 months, the next instalment due in 3 days.
    const FINANCED = [ 'Clio 5', '208', 'Accent' ];
    // Already on the road, its credit well under way, when it was added to the app two months ago:
    // its figures count from then and the instalments before were paid on paper.
    const ADDED_LATE = 'Clio 5';

    /**
     * What each car cost and how it's paid for, what it should fetch, an insurance payout, and a
     * Kia Rio sold two months ago after its three years.
     */
    private function createCarMoney(Agency $agency, $clients, CarbonImmutable $today): void
    {
        foreach ($agency->cars()->orderBy('id')->get() as $index => $car) {
            [ $months, $price ] = self::PURCHASES[$index];
            $boughtAt = $today->subMonthsNoOverflow($months);
            $addedAt = $car->model_name === self::ADDED_LATE ? $today->subDays(60) : $boughtAt;
            $car->forceFill([
                'first_circulation_date' => $boughtAt->format('d/m/Y'), 'bought_at' => $boughtAt->getTimestamp(), 'created_at' => $addedAt->getTimestamp(),
                'purchase_price' => $price * 1000, 'purchase_fees' => 1500000, 'supplier' => $car->manufacturer . ' Tunisie',
                'expected_sale_price' => (int) round($price * 0.55) * 1000,
            ]);
            if (in_array($car->model_name, self::FINANCED, true)) {
                $paid = max(0, $months - 1);
                $instalment = (int) round($price * 0.7 * 1.12 / 36) * 1000;
                $car->forceFill([
                    'advance' => (int) round($price * 0.3) * 1000, 'instalment_amount' => $instalment, 'instalment_months' => 36,
                    'first_instalment_at' => $today->addDays(3)->setHour(9)->subMonthsNoOverflow($paid)->getTimestamp(), 'lender' => 'Attijari Leasing',
                ]);
                for ($month = 1; $month <= $paid; $month++) {
                    $paidAt = $today->addDays(3)->setHour(9)->subMonthsNoOverflow($paid - $month + 1);
                    if ($paidAt->lessThan($addedAt)) {
                        $car->instalments_paid_before++;
                        continue;
                    }
                    $agency->expenses()->create([
                        'car_id' => $car->id, 'category' => Expense::CATEGORY_INSTALMENT, 'amount' => $instalment, 'method' => Payment::METHOD_TRANSFER,
                        'spent_at' => $paidAt->getTimestamp(), 'user_id' => $this->owner->id,
                    ]);
                }
            }
            $car->save();
        }

        $clio = $agency->cars()->where('model_name', 'Clio 5')->first();
        // Marked when it was added: the scratch it came with, nobody's rental.
        $clio->damages()->make([ 'x' => 820, 'y' => 900, 'note' => 'Rayure pare-choc arrière, déjà là' ])->forceFill([ 'created_at' => $clio->created_at ])->save();
        $agency->incomes()->create([ 'car_id' => $clio->id, 'category' => Income::CATEGORY_INSURANCE_PAYOUT, 'amount' => 450000, 'received_at' => $today->subDays(6)->setHour(11)->getTimestamp(), 'method' => Payment::METHOD_CASH, 'note' => 'STAR, rétroviseur', 'user_id' => $this->owner->id ]);

        $rio = Car::factory()->create([
            'agency_id' => $agency->id, 'manufacturer' => 'Kia', 'model_name' => 'Rio', 'model_year' => 2022, 'daily_price' => 90000, 'mileage' => 98000,
            'first_circulation_date' => $today->subMonthsNoOverflow(38)->format('d/m/Y'), 'transmission_type' => Car::TRANSMISSION_TYPE_MANUAL, 'fuel_type' => Car::FUEL_TYPE_GAS,
        ]);
        $this->createHistory($rio, $clients, $today->subDays(150), $today->subDays(65));
        $rio->forceFill([
            'created_at' => $today->subMonthsNoOverflow(38)->getTimestamp(), 'bought_at' => $today->subMonthsNoOverflow(38)->getTimestamp(),
            'purchase_price' => 45000000, 'purchase_fees' => 1500000, 'status' => Car::STATUS_SOLD,
            'sold_at' => $today->subDays(62)->setHour(15)->getTimestamp(), 'sale_price' => 24000000, 'sale_method' => Payment::METHOD_TRANSFER,
            'buyer_name' => 'Karim Ben Ali', 'buyer_phone' => '+21698123456',
        ])->save();
    }

    /**
     * The branches' rent, the bills that come back, VAT on invoices, and the payroll: the managers
     * and a washer (no login), paid last month, the washer with an advance this month.
     */
    private function createAgencyCosts(Agency $agency, CarbonImmutable $today): void
    {
        $agency->update([
            'tax_id' => '1234567/A/M/000', 'vat_rate' => 1900, 'fiscal_stamp' => 1000,
            'contract_terms' => "Le véhicule est rendu avec le même niveau de carburant.\nToute amende pendant la location est à la charge du locataire.",
        ]);
        [ $centre, $airport ] = [ $this->centre, $this->airport ];
        $spent = fn (int $category, int $amount, CarbonImmutable $at, array $extra = []) => $agency->expenses()->create([
            'category' => $category, 'amount' => $amount, 'spent_at' => $at->getTimestamp(), 'method' => Payment::METHOD_TRANSFER, 'user_id' => $this->owner->id, ...$extra,
        ]);
        foreach ([ $today->subMonthNoOverflow()->startOfMonth(), $today->startOfMonth() ] as $month) {
            $spent(Expense::CATEGORY_RENT, 800000, $month->addDays(1)->setHour(10), [ 'branch_id' => $centre->id, 'note' => 'Loyer' ]);
            $spent(Expense::CATEGORY_RENT, 1200000, $month->addDays(1)->setHour(10), [ 'branch_id' => $airport->id, 'note' => 'Loyer' ]);
            $spent(Expense::CATEGORY_ELECTRICITY, 95000, $month->addDays(9)->setHour(10), [ 'branch_id' => $centre->id, 'note' => 'STEG' ]);
        }
        $agency->recurringBills()->create([ 'category' => Expense::CATEGORY_INTERNET, 'amount' => 65000, 'every_months' => 1, 'next_due_at' => $today->addDays(2)->getTimestamp(), 'branch_id' => $centre->id, 'note' => 'Topnet' ]);
        $agency->recurringBills()->create([ 'category' => Expense::CATEGORY_ACCOUNTANT, 'amount' => 300000, 'every_months' => 3, 'next_due_at' => $today->addDays(20)->getTimestamp() ]);
        $agency->recurringBills()->create([ 'category' => Expense::CATEGORY_RENT, 'amount' => 800000, 'every_months' => 1, 'next_due_at' => $today->addMonthNoOverflow()->startOfMonth()->addDays(1)->getTimestamp(), 'branch_id' => $centre->id ]);

        $employee = fn (User $user, array $extra) => $agency->employees()->create([ 'first_name' => $user->first_name, 'last_name' => $user->last_name, 'phone' => $user->phone, 'user_id' => $user->id, ...$extra ]);
        $employee($this->owner, [ 'role_label' => 'Gérant' ]);
        $manager = $employee($this->manager, [ 'role_label' => 'Agent de comptoir', 'monthly_salary' => 1100000, 'hired_at' => $today->subYears(2)->getTimestamp() ]);
        $employee($this->airportManager, [ 'role_label' => 'Comptoir aéroport', 'monthly_salary' => 1000000, 'hired_at' => $today->subDays(40)->getTimestamp() ]);
        $employee($this->invited, [ 'role_label' => 'Agent de comptoir', 'monthly_salary' => 900000, 'hired_at' => $today->subDays(2)->getTimestamp() ]);
        $employee($this->formerManager, [ 'role_label' => 'Agent de comptoir', 'monthly_salary' => 1000000, 'hired_at' => $today->subDays(400)->getTimestamp(), 'active' => false ]);
        $washer = $agency->employees()->create([ 'first_name' => 'Hamza', 'last_name' => 'Trabelsi', 'phone' => '+21655444333', 'role_label' => 'Lavage', 'monthly_salary' => 700000, 'hired_at' => $today->subYear()->getTimestamp() ]);
        $lastMonth = $today->subMonthNoOverflow();
        $manager->salaryPayments()->create([ 'month' => $lastMonth->format('Y-m'), 'type' => SalaryPayment::TYPE_SALARY, 'amount' => 1100000, 'method' => Payment::METHOD_TRANSFER, 'paid_at' => $lastMonth->endOfMonth()->setHour(17)->getTimestamp(), 'user_id' => $this->owner->id ]);
        $washer->salaryPayments()->create([ 'month' => $lastMonth->format('Y-m'), 'type' => SalaryPayment::TYPE_SALARY, 'amount' => 700000, 'method' => Payment::METHOD_CASH, 'paid_at' => $lastMonth->endOfMonth()->setHour(17)->getTimestamp(), 'user_id' => $this->owner->id ]);
        $washer->salaryPayments()->create([ 'month' => $today->format('Y-m'), 'type' => SalaryPayment::TYPE_ADVANCE, 'amount' => 200000, 'method' => Payment::METHOD_CASH, 'paid_at' => $today->subDays(3)->setHour(18)->getTimestamp(), 'user_id' => $this->owner->id ]);
        $spent(Expense::CATEGORY_PHONE, 20000, $today->subDays(5)->setHour(9), [ 'employee_id' => $manager->id, 'method' => Payment::METHOD_CASH, 'note' => 'Recharge Ooredoo' ]);
    }

    /**
     * Back-to-back past rentals with random gaps, all ending before $until.
     */
    private function createHistory(Car $car, $clients, CarbonImmutable $from, CarbonImmutable $until): void
    {
        $startsAt = $from;
        while (true) {
            $startsAt = $startsAt->addDays(fake()->numberBetween(0, 5))->setHour(fake()->randomElement([ 8, 10, 14, 18 ]));
            $endsAt = $startsAt->addDays(fake()->numberBetween(1, 7));
            if ($endsAt->greaterThan($until)) {
                return;
            }

            $this->createContract($car, $clients->random(), $startsAt, $endsAt);
            $startsAt = $endsAt;
        }
    }

    /**
     * An oil change a few months back (overdue by kilometres for $isOilChangeDue), a wash this
     * month and fuel; some cars also had tyres or a repair.
     */
    private function createExpenses(Car $car, CarbonImmutable $today, bool $isOilChangeDue): void
    {
        $expense = fn (int $category, int $amount, CarbonImmutable $at, array $extra = []) => $car->agency->expenses()->create([
            'car_id' => $car->id, 'category' => $category, 'amount' => $amount, 'spent_at' => $at->setHour(9)->getTimestamp(), 'user_id' => $this->owner->id, ...$extra,
        ]);

        $oilChangeKm = $isOilChangeDue ? 9800 : fake()->numberBetween(2000, 6000);
        $expense(Expense::CATEGORY_OIL_CHANGE, 180000, $today->subMonths(fake()->numberBetween(2, 5)), [ 'mileage' => max(0, $car->mileage - $oilChangeKm), 'garage' => 'Garage Ben Salah' ]);
        $expense(Expense::CATEGORY_WASHING, 15000, $today->subDays(fake()->numberBetween(1, 20)));
        $expense(Expense::CATEGORY_FUEL, 60000, $today->subDays(fake()->numberBetween(1, 40)));
        if ($car->id % 3 === 0) {
            $expense(Expense::CATEGORY_TYRES, 640000, $today->subMonths(1), [ 'mileage' => $car->mileage - 1500, 'garage' => 'Pneus Sahel' ]);
        }
    }

    /**
     * Fines on rentals over three weeks old, one per way of settling it: the client still owes it,
     * paid the agency, had it kept from the deposit, left it to the agency (unreachable), or paid
     * the agency back after it paid the authority.
     */
    private function createFines(Agency $agency, CarbonImmutable $today): void
    {
        $closed = $agency->contracts()->where('contracts.status', Contract::STATUS_CLOSED)
            ->where('ends_at', '<', $today->subDays(20)->getTimestamp())->orderByDesc('ends_at')->take(5)->get();
        $daysAgo = fn (int $days) => $today->subDays($days)->setHour(11)->getTimestamp();
        foreach ($closed as $index => $contract) {
            $fine = $agency->fines()->make([
                'car_id' => $contract->car_id,
                'committed_at' => $contract->starts_at + 26 * 60 * 60,
                'amount' => [ 60000, 40000, 60000, 100000, 40000 ][$index],
                'reference' => 'PV ' . fake()->numerify('######'),
                'note' => [ 'Excès de vitesse, GP1', 'Stationnement interdit', 'Excès de vitesse, A1', 'Feu rouge, Sousse', 'Stationnement interdit' ][$index],
            ]);
            $fine->contract_id = $contract->id;
            $fine->status = [ Fine::STATUS_UNPAID, Fine::STATUS_PAID_BY_CLIENT, Fine::STATUS_FROM_DEPOSIT, Fine::STATUS_PAID_BY_AGENCY, Fine::STATUS_PAID_BY_CLIENT ][$index];
            $fine->settled_at = [ null, $daysAgo(8), $contract->returned_at, $daysAgo(10), $daysAgo(5) ][$index];
            $fine->method = in_array($index, [ 1, 4 ], true) ? Payment::METHOD_CASH : null;
            $fine->user_id = $fine->settled_at ? $this->owner->id : null;
            if ($index >= 3) { // the agency paid the authority at the recette
                $fine->paid_out_at = $daysAgo($index === 3 ? 10 : 15);
                $fine->paid_out_method = Payment::METHOD_CASH;
                $fine->paid_out_user_id = $this->owner->id;
            }
            $fine->save();
            if ($fine->status === Fine::STATUS_FROM_DEPOSIT) {
                $contract->deposit_returned -= $fine->amount;
                $contract->save();
            }
        }
    }

    /**
     * The contract's status follows the clock: reserved, out (half paid), or closed (paid, mostly
     * in cash). Deposits are by cheque, or in cash for one rental in three. Handovers of the last
     * few days have their inspection photos and the client's signature. The car's odometer moves
     * with each rental.
     */
    private function createContract(Car $car, Client $client, CarbonImmutable $startsAt, CarbonImmutable $endsAt, ?string $state = null): Contract
    {
        $now = time();
        $contract = Contract::factory()->for($car)->for($client)->create([
            'daily_price' => $car->daily_price,
            'starts_at' => $startsAt->getTimestamp(),
            'ends_at' => $endsAt->getTimestamp(),
        ]);
        // Where it came from (one in nine through a hotel taking 10 %), and a child seat or a GPS now and then.
        $contract->source = $contract->id % 9 ? [ Contract::SOURCE_WALK_IN, Contract::SOURCE_PHONE, Contract::SOURCE_WHATSAPP, Contract::SOURCE_SOCIAL ][$contract->id % 4] : Contract::SOURCE_BROKER;
        if ($contract->source === Contract::SOURCE_BROKER) {
            $contract->broker = 'Hôtel Riadh Palms';
            $contract->commission = (int) round($contract->rentPrice() * 0.1);
        }
        $contract->extras = array_values(array_filter([ $contract->id % 4 ? null : self::CHILD_SEAT, $contract->id % 6 ? null : self::GPS ])) ?: null;
        $contract->save();
        $staff = $this->staffFor($car, $contract);
        $this->log($contract, 'created', $staff, min($now, $contract->starts_at - 3 * 86400));
        if ($contract->starts_at > $now) {
            return $contract;
        }

        $contract->status = Contract::STATUS_OUT;
        $contract->picked_up_at = $contract->starts_at;
        $contract->pickup_mileage = $car->mileage;
        $contract->deposit = 500000;
        $contract->deposit_method = $contract->id % 3 ? Payment::METHOD_CHEQUE : Payment::METHOD_CASH;
        $this->log($contract, 'picked_up', $staff, $contract->picked_up_at, [ 'mileage' => $contract->pickup_mileage, 'deposit' => $contract->deposit ]);
        $isRecent = $contract->ends_at > $now - 5 * 86400;
        if ($isRecent) {
            $this->inspect($contract, ContractPhoto::STAGE_PICKUP, $contract->pickup_mileage, $contract->id % 3 ? [] : [ [ 180, 90, 'Rayure pare-choc avant', null ] ]);
            $contract->signature = $this->signature();
            $contract->signed_at = $contract->picked_up_at;
            $this->log($contract, 'signed', $staff, $contract->picked_up_at);
        }
        if ($contract->ends_at > $now || $state) {
            $contract->save();
            $contract->payments()->create([ 'amount' => intdiv($contract->totalPrice(), 2), 'method' => $this->paymentMethod($contract), 'paid_at' => $contract->starts_at, 'user_id' => $staff->id ]);
            return $contract;
        }

        $car->mileage += (int) round(($contract->ends_at - $contract->starts_at) / 86400 * fake()->numberBetween(80, 200));
        $car->save();
        $contract->status = Contract::STATUS_CLOSED;
        $contract->returned_at = $contract->ends_at;
        $contract->return_mileage = $car->mileage;
        $contract->closed_at = $contract->ends_at + 1800;
        $contract->deposit_returned = $contract->deposit;
        $contract->save();
        $contract->payments()->create([ 'amount' => $contract->totalPrice(), 'method' => $this->paymentMethod($contract), 'paid_at' => $contract->starts_at, 'user_id' => $staff->id ]);
        if ($isRecent) {
            $this->inspect($contract, ContractPhoto::STAGE_RETURN, $contract->return_mileage);
        }
        $this->log($contract, 'returned', $staff, $contract->returned_at, [ 'mileage' => $contract->return_mileage, 'charges' => 0 ]);
        $this->log($contract, 'closed', $staff, $contract->closed_at, [ 'deposit_kept' => 0, 'deposit_kept_reason' => null ]);

        return $contract;
    }

    /**
     * Came back a day and a half late, dirty, with a dented door: the lateness, the wash and the damage
     * are charged, half the rent is paid, and it waits to be settled. The car is at the body shop.
     */
    private function bringBack(Contract $contract): void
    {
        $car = $contract->car;
        $contract->status = Contract::STATUS_RETURNED;
        $contract->returned_at = $contract->ends_at + 34 * 3600;
        $contract->return_mileage = $car->mileage + 640;
        $contract->charges = [ ...Pricing::returnCharges($car->agency, $contract, $contract->return_mileage, $contract->returned_at), [ 'type' => 'damage', 'quantity' => 1, 'amount' => 250000 ], [ 'type' => 'washing', 'quantity' => 1, 'amount' => 20000 ] ];
        $contract->save();
        $car->update([ 'mileage' => $contract->return_mileage, 'status' => Car::STATUS_MAINTENANCE ]);
        $this->inspect($contract, ContractPhoto::STAGE_RETURN, $contract->return_mileage, [ [ 820, 620, 'Portière arrière droite enfoncée', 250000 ] ]);
        $this->log($contract, 'returned', $this->staffFor($car, $contract), $contract->returned_at, [ 'mileage' => $contract->return_mileage, 'charges' => $contract->chargesPrice() ]);
    }

    /**
     * A mirror broken at the last return, paid from the deposit and replaced the next day.
     */
    private function chargeDamage(Contract $contract): void
    {
        $amount = 120000;
        $repairedAt = $contract->returned_at + 86400;
        $contract->damages()->create([ 'stage' => ContractPhoto::STAGE_RETURN, 'x' => 120, 'y' => 330, 'note' => 'Rétroviseur gauche cassé', 'amount' => $amount, 'repaired_at' => $repairedAt ]);
        $contract->car->agency->expenses()->create([ 'car_id' => $contract->car_id, 'contract_id' => $contract->id, 'category' => Expense::CATEGORY_REPAIR, 'amount' => 110000, 'spent_at' => $repairedAt, 'garage' => 'Garage Ben Salah', 'note' => 'Rétroviseur gauche cassé', 'user_id' => $this->owner->id ]);
        $contract->charges = [ [ 'type' => 'damage', 'quantity' => 1, 'amount' => $amount ] ];
        $contract->deposit_returned = $contract->deposit - $amount;
        $contract->save();
        $returned = $contract->activities()->where('action', 'returned')->first();
        $returned->update([ 'changes' => [ ...$returned->changes, 'charges' => $amount ] ]);
        $contract->payments()->create([ 'amount' => $amount, 'method' => Payment::METHOD_DEPOSIT, 'paid_at' => $contract->returned_at, 'user_id' => $returned->user_id ]);
    }

    /**
     * The client of the next pickup filled in their papers from the check-in link an hour ago.
     */
    private function checkIn(Agency $agency, Contract $contract): void
    {
        $client = $contract->client;
        if (! $client->id_number) {
            $client->update([ 'birth_date' => '14/03/1991', 'id_number' => fake()->numerify('0#######'), 'driver_licence_number' => fake()->numerify('##/######'), 'driver_licence_delivery_date' => '02/09/2012' ]);
        }
        $this->paper($agency, $client, Document::TYPE_ID_CARD, 'CIN ' . $client->id_number, "$client->first_name $client->last_name");
        $this->paper($agency, $client, Document::TYPE_DRIVER_LICENCE, 'PERMIS ' . $client->driver_licence_number, "$client->first_name $client->last_name");
        $activity = $contract->activities()->make([ 'action' => 'checked_in' ]);
        $activity->created_at = $activity->updated_at = time() - 3600;
        $activity->save();
    }

    /**
     * Invoices asked for one rental in three, numbered per year in order (2026-0001).
     */
    private function numberInvoices(Agency $agency): void
    {
        $numbers = [];
        foreach ($agency->contracts()->where('contracts.status', Contract::STATUS_CLOSED)->orderBy('closed_at')->get() as $contract) {
            if ($contract->id % 3 === 0) {
                $year = CarbonImmutable::createFromTimestamp($contract->closed_at, self::TIMEZONE)->format('Y');
                $numbers[$year] = ($numbers[$year] ?? 0) + 1;
                $contract->forceFill([ 'invoice_number' => sprintf('%s-%04d', $year, $numbers[$year]), 'invoiced_at' => $contract->closed_at ])->save();
            }
        }
    }

    /**
     * Who handled a contract: the airport cars are Amine's since he moved there, Rania took one in
     * three until she left, and the owner and Sami take turns otherwise.
     */
    private function staffFor(Car $car, Contract $contract): User
    {
        return match (true) {
            $car->agency_id !== $this->owner->agency_id => $this->otherOwner,
            $car->branch_id === $this->airport->id && $contract->starts_at >= $this->airportSince => $this->airportManager,
            $contract->starts_at < $this->formerLeftAt && $contract->id % 3 === 0 => $this->formerManager,
            default => $contract->id % 2 ? $this->owner : $this->manager,
        };
    }

    // Mostly cash; now and then a card, a transfer or a cheque.
    private function paymentMethod(Contract $contract): int
    {
        return match (true) {
            $contract->id % 5 === 0 => Payment::METHOD_CARD,
            $contract->id % 7 === 0 => Payment::METHOD_TRANSFER,
            $contract->id % 11 === 0 => Payment::METHOD_CHEQUE,
            default => Payment::METHOD_CASH,
        };
    }

    /**
     * The handover photos (with the odometer on the dashboard one) and damage marks: [ x, y, note, amount ].
     */
    private function inspect(Contract $contract, int $stage, int $mileage, array $damages = []): void
    {
        $car = $contract->car;
        foreach (self::ANGLES + [ ContractPhoto::ANGLE_DASHBOARD => "COMPTEUR $mileage KM" ] as $angle => $label) {
            $contract->photos()->create([ 'stage' => $stage, 'angle' => $angle, 'path' => $this->picture("contracts/{$contract->id}", $car->colour, "$car->manufacturer $car->model_name", $label) ]);
        }
        foreach ($damages as [ $x, $y, $note, $amount ]) {
            $contract->damages()->create([ 'stage' => $stage, 'x' => $x, 'y' => $y, 'note' => $note, 'amount' => $amount ]);
        }
    }

    // A scribble drawn in the app's 600 × 200 signature box.
    private function signature(): string
    {
        $x = 60;
        $path = 'M 60 ' . fake()->numberBetween(110, 140);
        while ($x < 520) {
            $x += fake()->numberBetween(15, 35);
            $path .= " L $x " . fake()->numberBetween(50, 170);
        }

        return $path;
    }

    private function paper(Agency $agency, Car|Client $of, int $type, string ...$lines): void
    {
        $folder = $of instanceof Car ? "cars/{$of->id}/documents" : "clients/{$of->id}";
        $agency->documents()->create([ 'type' => $type, 'path' => $this->picture($folder, '#fff8e1', ...$lines), $of instanceof Car ? 'car_id' : 'client_id' => $of->id ]);
    }

    /**
     * A stand-in photo on the default disk: the lines of text over a block of the given colour.
     */
    private function picture(string $folder, string $colour, string ...$lines): string
    {
        $image = imagecreatetruecolor(320, 214);
        imagefill($image, 0, 0, imagecolorallocate($image, 236, 239, 241));
        [ $red, $green, $blue ] = sscanf($colour, '#%02x%02x%02x');
        imagefilledrectangle($image, 40, 70, 280, 190, imagecolorallocate($image, $red, $green, $blue));
        imagerectangle($image, 40, 70, 280, 190, imagecolorallocate($image, 97, 97, 97));
        foreach ($lines as $index => $line) {
            imagestring($image, 5, 12, 12 + $index * 20, Str::ascii($line), imagecolorallocate($image, 33, 33, 33));
        }
        ob_start();
        imagejpeg(imagescale($image, 640), null, 80);
        $path = "$folder/" . Str::random(40) . '.jpg';
        Storage::put($path, ob_get_clean());

        return $path;
    }

    private function log(Contract $contract, string $action, User $user, int $at, ?array $changes = null): void
    {
        $activity = $contract->activities()->make([ 'action' => $action, 'changes' => $changes, 'user_id' => $user->id ]);
        $activity->created_at = $at;
        $activity->updated_at = $at;
        $activity->save();
    }

    private function staffLog(User $staff, string $action, int $at, ?array $changes = null): void
    {
        $activity = Activity::make([ 'action' => $action, 'changes' => $changes, 'staff_id' => $staff->id, 'user_id' => $this->owner->id ]);
        $activity->created_at = $at;
        $activity->updated_at = $at;
        $activity->save();
    }
}
