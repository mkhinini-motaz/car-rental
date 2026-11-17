<?php

namespace Tests\Feature;

use App\Models\Car;
use App\Models\Contract;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CarApiTest extends TestCase
{
    use RefreshDatabase;

    private function carInput(array $overrides = []): array
    {
        return [
            'daily_price' => 95000,
            'licence_plate' => '245 tn 1234 ',
            'serial_number' => 'vf1rja00123456789',
            'manufacturer' => 'Renault',
            'model_name' => 'Clio 5',
            'model_year' => 2024,
            'fiscal_horse_power' => 5,
            'number_of_cylinders' => 3,
            'transmission_type' => Car::TRANSMISSION_TYPE_MANUAL,
            'fuel_type' => Car::FUEL_TYPE_GAS,
            'type' => Car::TYPE_COMPACT,
            'first_circulation_date' => '15/03/2024',
            'circulation_tax_ends_at' => 1790000000,
            'insurance_ends_at' => 1790000000,
            'technical_control_ends_at' => 1790000000,
            'colour' => '#b71c1c',
            'mileage' => 12000,
            ...$overrides,
        ];
    }

    public function test_plates_read_as_on_the_car(): void
    {
        $this->assertSame('245 تونس 1234', Car::normalizePlate(' 245-tu-1234 '));
        $this->assertSame('245 تونس 1234', Car::normalizePlate('245tn1234'));
        $this->assertSame('12 RS 345', Car::normalizePlate('12rs345')); // another series keeps its letters
        // Inside a push or a PDF: left to right, the number after تونس kept on its right.
        $this->assertSame("\u{202A}245 تونس\u{200E} 1234\u{202C}", Car::embedPlate('245 تونس 1234'));
    }

    public function test_create_and_edit_a_car(): void
    {
        $user = User::factory()->create();
        $as = $this->actingAsUser($user);

        $id = $as->postJson('/api/car', $this->carInput())
            ->assertCreated()
            ->assertJsonPath('data.licence_plate', '245 تونس 1234') // TN as on the plate itself
            ->assertJsonPath('data.serial_number', 'VF1RJA00123456789')
            ->assertJsonPath('data.status', Car::STATUS_AVAILABLE)
            ->assertJsonPath('data.agency_id', $user->agency_id)
            ->json('data.id');

        $as->putJson("/api/car/$id", $this->carInput([ 'daily_price' => 99000, 'status' => Car::STATUS_MAINTENANCE ]))
            ->assertOk()
            ->assertJsonPath('data.daily_price', 99000)
            ->assertJsonPath('data.status', Car::STATUS_MAINTENANCE);
    }

    public function test_car_input_is_validated(): void
    {
        $user = User::factory()->create();
        $taken = Car::factory()->create(); // another agency's plate still counts: plates are national
        $as = $this->actingAsUser($user);

        $as->postJson('/api/car', $this->carInput([
            'licence_plate' => $taken->licence_plate,
            'colour' => '#red',
            'status' => 9,
            'first_circulation_date' => '2024-03-15',
            'daily_price' => 0,
        ]))->assertJsonValidationErrors([ 'licence_plate', 'colour', 'status', 'first_circulation_date', 'daily_price' ]);

        $as->putJson("/api/car/{$taken->id}", $this->carInput())->assertNotFound();
    }

    public function test_photo_replaces_the_previous_one(): void
    {
        Storage::fake();
        $car = Car::factory()->create();
        $as = $this->actingAsUser(User::factory()->create([ 'agency_id' => $car->agency_id ]));

        $as->postJson("/api/car/{$car->id}/photo", [ 'photo' => UploadedFile::fake()->create('notes.pdf') ])->assertJsonValidationErrors('photo');
        $as->postJson("/api/car/{$car->id}/photo", [ 'photo' => UploadedFile::fake()->image('a.jpg') ])->assertOk();
        $first = $car->refresh()->photo;
        $url = $as->postJson("/api/car/{$car->id}/photo", [ 'photo' => UploadedFile::fake()->image('b.jpg') ])->json('data.photo_url');

        Storage::assertMissing($first);
        Storage::assertExists($car->refresh()->photo);
        $this->assertStringContainsString($car->photo, $url);
    }

    public function test_availability_search_skips_cars_that_are_not_available(): void
    {
        $user = User::factory()->create();
        $available = Car::factory()->create([ 'agency_id' => $user->agency_id ]);
        Car::factory()->create([ 'agency_id' => $user->agency_id, 'status' => Car::STATUS_MAINTENANCE ]);

        $this->actingAsUser($user)->getJson('/api/car?starts_at=1000&ends_at=2000')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $available->id);
    }

    public function test_availability_search_flags_a_car_not_back_yet_and_lists_it_last(): void
    {
        $user = User::factory()->create();
        $late = Car::factory()->create([ 'agency_id' => $user->agency_id, 'created_at' => time() + 60 ]); // newest: first by default
        $dueAt = time() - 86400;
        Contract::factory()->for($late)->create([ 'status' => Contract::STATUS_OUT, 'starts_at' => $dueAt - 3 * 86400, 'ends_at' => $dueAt ]);
        $free = Car::factory()->create([ 'agency_id' => $user->agency_id ]);
        $now = time();

        $this->actingAsUser($user)->getJson('/api/car?starts_at=' . ($now + 3600) . '&ends_at=' . ($now + 3 * 86400))
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $free->id)
            ->assertJsonPath('data.0.overdue_since', null)
            ->assertJsonPath('data.1.id', $late->id)
            ->assertJsonPath('data.1.overdue_since', $dueAt);
    }
}
