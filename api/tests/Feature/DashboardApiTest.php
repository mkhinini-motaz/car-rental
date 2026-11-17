<?php

namespace Tests\Feature;

use App\Models\Car;
use App\Models\Contract;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DashboardApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_lists_what_to_do_today(): void
    {
        $user = User::factory()->create();
        $dayStart = strtotime('today');
        $dayEnd = $dayStart + 86400;
        $later = time() + 30 * 86400;
        $car = fn (array $attributes = []) => Car::factory()->create([
            'agency_id' => $user->agency_id,
            'insurance_ends_at' => $later, 'circulation_tax_ends_at' => $later, 'technical_control_ends_at' => $later,
            ...$attributes,
        ]);
        $contract = fn (Car $car, int $status, int $startsAt, int $endsAt) => Contract::factory()
            ->state([ 'status' => $status ])
            ->create([ 'car_id' => $car->id, 'starts_at' => $startsAt, 'ends_at' => $endsAt ]);

        $pickupToday = $contract($car(), Contract::STATUS_RESERVED, $dayStart + 3600, $dayEnd + 86400);
        $contract($car(), Contract::STATUS_RESERVED, $dayEnd + 3600, $dayEnd + 86400); // tomorrow
        $overdue = $contract($car(), Contract::STATUS_OUT, $dayStart - 5 * 86400, $dayStart - 86400);
        $contract($car(), Contract::STATUS_OUT, $dayStart - 86400, $dayEnd + 86400); // back later
        $car([ 'status' => Car::STATUS_MAINTENANCE, 'insurance_ends_at' => time() + 86400 ]);
        Contract::factory()->create(); // another agency's

        $this->actingAsUser($user)->getJson("/api/dashboard?starts_at=$dayStart&ends_at=$dayEnd")
            ->assertOk()
            ->assertJsonCount(1, 'data.pickups')
            ->assertJsonPath('data.pickups.0.id', $pickupToday->id)
            ->assertJsonCount(1, 'data.returns')
            ->assertJsonPath('data.returns.0.id', $overdue->id)
            ->assertJsonPath('data.returns.0.client.id', $overdue->client_id)
            ->assertJsonPath('data.cars_total', 5)
            ->assertJsonPath('data.cars_available', 2) // not out, not in maintenance
            ->assertJsonPath('data.cars_out', 2)
            ->assertJsonPath('data.overdue', 1)
            ->assertJsonCount(1, 'data.expiring_cars');

        // Handled today: listed at their real time. Tomorrow: only what is booked for tomorrow.
        $handedOver = $contract($car(), Contract::STATUS_OUT, $dayStart - 3600, $dayEnd + 5 * 86400);
        $handedOver->forceFill([ 'picked_up_at' => $dayStart + 600 ])->save();
        $backEarly = $contract($car(), Contract::STATUS_RETURNED, $dayStart - 2 * 86400, $dayEnd + 2 * 86400);
        $backEarly->forceFill([ 'returned_at' => $dayStart + 1200 ])->save();
        $today = $this->actingAsUser($user)->getJson("/api/dashboard?starts_at=$dayStart&ends_at=$dayEnd")->json('data');
        $this->assertSame([ $handedOver->id, $pickupToday->id ], array_column($today['pickups'], 'id'));
        $this->assertSame([ $overdue->id, $backEarly->id ], array_column($today['returns'], 'id'));
        $tomorrow = $this->actingAsUser($user)->getJson('/api/dashboard?starts_at=' . $dayEnd . '&ends_at=' . ($dayEnd + 86400))->json('data');
        $this->assertCount(1, $tomorrow['pickups']); // no late ones: the range doesn't hold now
        $this->assertCount(0, $tomorrow['returns']); // nothing out is due back tomorrow; the overdue one stays on today
        $this->actingAsUser($user)->getJson('/api/dashboard?starts_at=0&ends_at=' . (40 * 86400))->assertJsonValidationErrors('ends_at');

        // The fleet list says where each car is: its rental out, if any.
        $cars = collect($this->actingAsUser($user)->getJson('/api/car?perPage=100')->json('data'));
        $this->assertSame([ $handedOver->id ], array_column($cars->firstWhere('id', $handedOver->car_id)['contracts'], 'id'));
        $this->assertSame([], $cars->firstWhere('id', $pickupToday->car_id)['contracts']);

        $this->actingAsUser($user)->getJson('/api/dashboard')->assertJsonValidationErrors([ 'starts_at', 'ends_at' ]);
    }

    public function test_agency_details_and_logo(): void
    {
        Storage::fake();
        $user = User::factory()->create();
        $as = $this->actingAsUser($user);

        $as->putJson('/api/agency', [ 'name' => 'Rent Sahel', 'phone' => '+21673 123 456' ])->assertJsonValidationErrors('phone');
        $as->putJson('/api/agency', [ 'name' => 'Rent Sahel', 'phone' => '+21673123456', 'address' => "M'saken" ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Rent Sahel')
            ->assertJsonPath('data.logo_url', null);
        $as->postJson('/api/agency/logo', [ 'logo' => UploadedFile::fake()->image('logo.png') ])->assertOk();

        // No deposit by default; an agency that takes one sets how much is suggested at pickup.
        $as->getJson('/api/agency')->assertJsonPath('data.takes_deposit', false);
        $as->putJson('/api/agency', [ 'name' => 'Rent Sahel', 'takes_deposit' => true, 'default_deposit' => 300000, 'default_deposit_method' => 9 ])->assertJsonValidationErrors('default_deposit_method');
        $as->putJson('/api/agency', [ 'name' => 'Rent Sahel', 'phone' => '+21673123456', 'address' => "M'saken", 'takes_deposit' => true, 'default_deposit' => 300000, 'default_deposit_method' => 4 ])
            ->assertJsonPath('data.takes_deposit', true)
            ->assertJsonPath('data.default_deposit', 300000);

        $as->getJson('/api/agency')
            ->assertJsonPath('data.phone', '+21673123456')
            ->assertJsonPath('data.address', "M'saken")
            ->assertJsonPath('data.logo_url', fn ($url) => str_contains($url, "agencies/{$user->agency_id}/"));
    }
}
