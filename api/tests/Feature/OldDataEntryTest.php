<?php

namespace Tests\Feature;

use App\Models\Car;
use App\Models\Client;
use App\Models\Contract;
use App\Models\Expense;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * What an agency with a past enters when it joins: the scratches already on its cars, the rentals
 * in its notebook, its regular clients, and all of it at once from spreadsheets.
 */
class OldDataEntryTest extends TestCase
{
    use RefreshDatabase;

    const DAY = 86400;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create()->refresh();
    }

    private function car(array $attributes = []): Car
    {
        return Car::factory()->create([ 'agency_id' => $this->owner->agency_id, 'daily_price' => 100000, ...$attributes ]);
    }

    public function test_damage_already_on_a_car_is_marked_on_it_and_shown_at_its_first_handover(): void
    {
        $car = $this->car();
        $this->actingAsUser($this->owner)->postJson("/api/car/{$car->id}/damage", [ 'damages' => [ [ 'x' => 120, 'y' => 300, 'note' => 'Rayure porte avant' ], [ 'x' => 800, 'y' => 900 ] ] ])
            ->assertCreated()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.contract_id', null)
            ->assertJsonPath('data.0.stage', null);
        $this->actingAsUser($this->owner)->postJson("/api/car/{$car->id}/damage", [ 'damages' => [ [ 'x' => 1200, 'y' => 1 ] ] ])->assertJsonValidationErrors('damages.0.x');
        $this->actingAsUser($this->owner)->postJson("/api/car/{$car->id}/damage", [ 'damages' => [] ])->assertJsonValidationErrors('damages');

        // The first rental's pickup shows them as already there.
        $contract = Contract::factory()->create([ 'car_id' => $car->id, 'starts_at' => time() + self::DAY, 'ends_at' => time() + 2 * self::DAY ]);
        $this->actingAsUser($this->owner)->getJson("/api/contract/{$contract->id}")
            ->assertJsonCount(2, 'data.car_damages')
            ->assertJsonPath('data.car_damages.0.note', 'Rayure porte avant');
        $this->actingAsUser($this->owner)->getJson("/api/car/{$car->id}")->assertJsonCount(2, 'data.damages');

        // Repaired with a cost: the car's expense, nobody's rental.
        $damage = $car->damages()->first();
        $this->actingAsUser($this->owner)->postJson("/api/car/{$car->id}/damage/{$damage->id}/repair", [ 'repaired_at' => time(), 'amount' => 90000 ])->assertOk();
        $this->assertSame([ $car->id, null ], [ Expense::sole()->car_id, Expense::sole()->contract_id ]);
        $this->actingAsUser($this->owner)->getJson("/api/contract/{$contract->id}")->assertJsonCount(1, 'data.car_damages');

        // Another agency's car, a sold one: not found.
        $this->actingAsUser(User::factory()->create())->postJson("/api/car/{$car->id}/damage", [ 'damages' => [ [ 'x' => 1, 'y' => 1 ] ] ])->assertNotFound();
        $sold = $this->car([ 'sold_at' => time(), 'status' => Car::STATUS_SOLD ]);
        $this->actingAsUser($this->owner)->postJson("/api/car/{$sold->id}/damage", [ 'damages' => [ [ 'x' => 1, 'y' => 1 ] ] ])->assertNotFound();
    }

    public function test_a_rental_from_the_notebook_is_entered_in_one_go_without_the_clients_papers(): void
    {
        $car = $this->car([ 'mileage' => 60000 ]);
        // Name and phone only, as in the notebook.
        $client = Client::factory()->create([ 'agency_id' => $this->owner->agency_id, 'id_number' => null, 'driver_licence_number' => null, 'driver_licence_delivery_date' => null ]);
        $startsAt = time() - 60 * self::DAY;
        $past = [ 'car_id' => $car->id, 'client_id' => $client->id, 'starts_at' => $startsAt, 'ends_at' => $startsAt + 3 * self::DAY, 'pickup_mileage' => 40000, 'return_mileage' => 40600 ];

        $contract = $this->actingAsUser($this->owner)->postJson('/api/contract/past', $past)
            ->assertCreated()
            ->assertJsonPath('data.status', Contract::STATUS_CLOSED)
            ->assertJsonPath('data.picked_up_at', $startsAt)
            ->assertJsonPath('data.returned_at', $startsAt + 3 * self::DAY)
            ->assertJsonPath('data.daily_price', 100000) // the car's
            ->assertJsonPath('data.paid', 300000) // in full by default
            ->assertJsonPath('data.activities.0.action', 'recorded')
            ->json('data');
        $this->assertSame([ Payment::METHOD_CASH, $startsAt ], [ Payment::sole()->method, (int) Payment::sole()->paid_at ]);
        $this->assertSame(60000, $car->refresh()->mileage); // today's odometer stays

        // Paid in part: returned, the rest owed, and the car's history starts with it.
        $this->actingAsUser($this->owner)->postJson('/api/contract/past', [ ...$past, 'starts_at' => $startsAt - 10 * self::DAY, 'ends_at' => $startsAt - 8 * self::DAY, 'daily_price' => 80000, 'paid' => 100000, 'method' => Payment::METHOD_CHEQUE ])
            ->assertCreated()
            ->assertJsonPath('data.status', Contract::STATUS_RETURNED);
        $stats = $this->actingAsUser($this->owner)->getJson("/api/client/{$client->id}")->json('data.stats');
        $this->assertSame([ 2, 460000, 60000, 'watch' ], [ $stats['contracts_count'], $stats['revenue'], $stats['outstanding'], $stats['badge'] ]);
        $this->assertSame(460000, $this->actingAsUser($this->owner)->getJson("/api/car/{$car->id}")->json('data.money.earned'));

        // The same days again, a rental not over, the odometer going back: refused.
        $this->actingAsUser($this->owner)->postJson('/api/contract/past', $past)->assertJsonValidationErrors([ 'starts_at' => 'contract:overlap' ]);
        $this->actingAsUser($this->owner)->postJson('/api/contract/past', [ ...$past, 'starts_at' => time() - self::DAY, 'ends_at' => time() + self::DAY ])->assertJsonValidationErrors('ends_at');
        $this->actingAsUser($this->owner)->postJson('/api/contract/past', [ ...$past, 'starts_at' => $startsAt - 30 * self::DAY, 'ends_at' => $startsAt - 29 * self::DAY, 'return_mileage' => 39000 ])->assertJsonValidationErrors('return_mileage');
        $stranger = User::factory()->create();
        $this->actingAsUser($stranger)->postJson('/api/contract/past', $past)->assertJsonValidationErrors([ 'car_id', 'client_id' ]);
        $this->assertSame(2, Contract::count());
        $this->assertSame(Contract::STATUS_CLOSED, Contract::find($contract['id'])->status);
    }

    public function test_a_regular_clients_rentals_before_the_app_make_them_known(): void
    {
        $client = Client::factory()->create([ 'agency_id' => $this->owner->agency_id ]);
        $this->assertSame('new', $this->actingAsUser($this->owner)->getJson("/api/client/{$client->id}")->json('data.stats.badge'));

        $this->actingAsUser($this->owner)->putJson("/api/client/{$client->id}", [ 'first_name' => $client->first_name, 'last_name' => $client->last_name, 'phone' => $client->phone, 'rentals_before' => 14 ])
            ->assertOk()
            ->assertJsonPath('data.rentals_before', 14);
        $this->actingAsUser($this->owner)->getJson("/api/client/{$client->id}")
            ->assertJsonPath('data.stats.badge', 'good')
            ->assertJsonPath('data.stats.rentals_before', 14)
            ->assertJsonPath('data.stats.contracts_count', 0);
        $this->actingAsUser($this->owner)->putJson("/api/client/{$client->id}", [ 'first_name' => 'A', 'last_name' => 'B', 'phone' => $client->phone, 'rentals_before' => -1 ])->assertJsonValidationErrors('rentals_before');

        // A flag still wins.
        $client->update([ 'flag' => Client::FLAG_LATE ]);
        $this->assertSame('risk', $this->actingAsUser($this->owner)->getJson("/api/client/{$client->id}")->json('data.stats.badge'));
    }

    public function test_the_agency_import_is_a_dry_run_first_then_saves_once(): void
    {
        $folder = sys_get_temp_dir() . '/car-import-' . uniqid();
        mkdir($folder);
        $year = date('Y') - 1;
        file_put_contents("$folder/cars.csv", "\xEF\xBB\xBF" . implode("\n", [
            'licence_plate;serial_number;manufacturer;model_name;model_year;daily_price;fiscal_horse_power;number_of_cylinders;transmission;fuel;type;first_circulation_date;circulation_tax_ends_at;insurance_ends_at;technical_control_ends_at;colour;mileage',
            "245 tu 1234;vf1rja001;Renault;Clio 5;2022;90,5;5;4;Manuelle;gasoil;citadine;15/03/2022;05/04/$year;31/12/$year;15/03/$year;Blanc;48 500",
            "999 TU 9;VIN9;Kia;Picanto;2021;abc;4;3;auto;essence;citadine;01/01/2021;01/01/$year;01/01/$year;01/01/$year;;",
        ]));
        file_put_contents("$folder/clients.csv", mb_convert_encoding(implode("\r\n", [
            'first_name,last_name,phone,gender,birth_date,id_number,driver_licence_number,driver_licence_delivery_date,driver_licence_expiry_date,flag,notes,rentals_before',
            'Ahmed,Ben Ali,22 123 456,m,12/05/1988,,,,,,"Regular, since 2019",14',
            'Sami,Dridi,50 111 222,,,,,,,impayé,,',
            'Bad,Phone,12345,,,,,,,,,',
        ]), 'Windows-1252', 'UTF-8'));
        $past = date('d/m/Y', time() - 30 * self::DAY);
        $pastEnd = date('d/m/Y', time() - 27 * self::DAY);
        $soon = date('d/m/Y', time() + 10 * self::DAY);
        $soonEnd = date('d/m/Y', time() + 12 * self::DAY);
        file_put_contents("$folder/rentals.csv", implode("\n", [
            'licence_plate,phone,starts_at,ends_at,daily_price,paid,method,pickup_mileage,return_mileage,note',
            "245 TU 1234,22123456,$past,$pastEnd,90,200,espèces,,,",
            "245 TU 1234,50111222,$past,$pastEnd,,,,,,overlaps",
            "245 TU 1234,50111222,$soon,$soonEnd,,,,,,booked",
            "111 XX 1,22123456,$past,$pastEnd,,,,,,",
        ]));

        $this->artisan('agency:import', [ 'agency' => $this->owner->agency_id, 'folder' => $folder ])
            ->expectsOutputToContain('dry run')
            ->expectsOutputToContain('cars.csv: 1 new, 0 updated, 0 unchanged, 1 rejected')
            ->expectsOutputToContain('clients.csv: 2 new, 0 updated, 0 unchanged, 1 rejected')
            ->expectsOutputToContain('rentals.csv: 2 new, 0 updated, 0 unchanged, 2 rejected')
            ->expectsOutputToContain('import:error:amount')
            ->expectsOutputToContain('contract:overlap')
            ->expectsOutputToContain('import:error:no_car {"plate":"111 XX 1"}')
            ->assertSuccessful();
        $this->assertSame([ 0, 0, 0 ], [ Car::count(), Client::count(), Contract::count() ]);

        $this->artisan('agency:import', [ 'agency' => $this->owner->agency_id, 'folder' => $folder, '--apply' => true ])->assertSuccessful();
        $car = Car::sole();
        $this->assertSame([ '245 تونس 1234', 'VF1RJA001', 90500, 2, 48500, $this->owner->agency_id ], [ $car->licence_plate, $car->serial_number, $car->daily_price, $car->fuel_type, $car->mileage, $car->agency_id ]);
        $ahmed = Client::where('phone', '+21622123456')->sole();
        $this->assertSame([ 'Regular, since 2019', 14, Client::GENDER_MALE ], [ $ahmed->notes, $ahmed->rentals_before, $ahmed->gender ]);
        $this->assertSame(Client::FLAG_UNPAID, Client::where('phone', '+21650111222')->value('flag'));
        $this->assertSame([ Contract::STATUS_RETURNED, Contract::STATUS_RESERVED ], Contract::orderBy('starts_at')->pluck('status')->all()); // 200 of 271.5 paid
        $this->assertSame(200000, (int) Payment::sole()->amount);

        // Again, with a car's price changed: nothing twice.
        file_put_contents("$folder/cars.csv", str_replace('90,5', '95', file_get_contents("$folder/cars.csv")));
        $this->artisan('agency:import', [ 'agency' => $this->owner->agency_id, 'folder' => $folder, '--apply' => true ])
            ->expectsOutputToContain('cars.csv: 0 new, 1 updated, 0 unchanged, 1 rejected')
            ->expectsOutputToContain('clients.csv: 0 new, 0 updated, 2 unchanged, 1 rejected')
            ->expectsOutputToContain('rentals.csv: 0 new, 0 updated, 2 unchanged, 2 rejected')
            ->assertSuccessful();
        $this->assertSame([ 1, 2, 2, 95000 ], [ Car::count(), Client::count(), Contract::count(), $car->refresh()->daily_price ]);

        array_map('unlink', glob("$folder/*"));
        rmdir($folder);
    }
}
