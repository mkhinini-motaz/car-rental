<?php

namespace Tests\Feature;

use App\Models\Car;
use App\Models\Client;
use App\Models\Contract;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ContractApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private Car $car;
    private Client $client;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
        $this->car = Car::factory()->create([ 'agency_id' => $this->user->agency_id, 'daily_price' => 90000 ]);
        $this->client = Client::factory()->create([ 'agency_id' => $this->user->agency_id ]);
        Contract::factory()->create([ 'car_id' => $this->car->id, 'client_id' => $this->client->id, 'starts_at' => 1000, 'ends_at' => 2000 ]);
    }

    private function reserve(array $contracts, array $extra = [])
    {
        return $this->actingAsUser($this->user)->postJson('/api/contract', [ 'client_id' => $this->client->id, 'contracts' => $contracts, ...$extra ]);
    }

    public function test_reservation_creates_one_contract_per_slot(): void
    {
        $otherCar = Car::factory()->create([ 'agency_id' => $this->user->agency_id ]);

        $this->reserve([
            [ 'car_id' => $this->car->id, 'starts_at' => 2000, 'ends_at' => 3000 ], // back-to-back with the existing one
            [ 'car_id' => $otherCar->id, 'starts_at' => 3000, 'ends_at' => 4000, 'daily_price' => 70000 ],
        ], [ 'note' => 'Pays at pickup' ])
            ->assertCreated()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.daily_price', 90000) // defaults to the car's price
            ->assertJsonPath('data.0.note', 'Pays at pickup')
            ->assertJsonPath('data.0.client.id', $this->client->id)
            ->assertJsonPath('data.1.daily_price', 70000);

        $this->assertSame(3, Contract::count());
    }

    public function test_overlapping_reservation_is_refused_and_nothing_is_saved(): void
    {
        $otherCar = Car::factory()->create([ 'agency_id' => $this->user->agency_id ]);

        $this->reserve([
            [ 'car_id' => $otherCar->id, 'starts_at' => 500, 'ends_at' => 1500 ],
            [ 'car_id' => $this->car->id, 'starts_at' => 1500, 'ends_at' => 2500 ],
        ])->assertUnprocessable()->assertJsonPath('errors', [ 'contracts.1' => [ 'contract:overlap' ] ]);

        // Two slots of the same car that overlap each other.
        $this->reserve([
            [ 'car_id' => $otherCar->id, 'starts_at' => 3000, 'ends_at' => 5000 ],
            [ 'car_id' => $otherCar->id, 'starts_at' => 4000, 'ends_at' => 6000 ],
        ])->assertUnprocessable()->assertJsonValidationErrors('contracts.1');

        $this->assertSame(1, Contract::count());
    }

    public function test_reservation_is_validated_and_scoped(): void
    {
        $foreignCar = Car::factory()->create();
        $foreignClient = Client::factory()->create();

        $this->reserve([])->assertJsonValidationErrors('contracts');
        $this->reserve([ [ 'car_id' => $this->car->id, 'starts_at' => 5000, 'ends_at' => 4000 ] ])->assertJsonValidationErrors('contracts.0.ends_at');
        $this->reserve([ [ 'car_id' => $foreignCar->id, 'starts_at' => 5000, 'ends_at' => 6000 ] ])->assertJsonValidationErrors('contracts.0.car_id');
        $this->reserve([ [ 'car_id' => $this->car->id, 'starts_at' => 5000, 'ends_at' => 6000 ] ], [ 'client_id' => $foreignClient->id ])
            ->assertJsonValidationErrors('client_id');
    }

    public function test_extend_change_and_cancel_a_contract(): void
    {
        $contract = Contract::first();
        Contract::factory()->create([ 'car_id' => $this->car->id, 'client_id' => $this->client->id, 'starts_at' => 5000, 'ends_at' => 6000 ]);
        $newClient = Client::factory()->create([ 'agency_id' => $this->user->agency_id ]);
        $as = $this->actingAsUser($this->user);

        $as->getJson("/api/contract/{$contract->id}")->assertOk()->assertJsonPath('data.car.id', $this->car->id);

        $as->putJson("/api/contract/{$contract->id}", [ 'ends_at' => 5000, 'daily_price' => 80000, 'client_id' => $newClient->id, 'note' => 'Extended' ])
            ->assertOk()
            ->assertJsonPath('data.ends_at', 5000)
            ->assertJsonPath('data.daily_price', 80000)
            ->assertJsonPath('data.client.id', $newClient->id);

        $as->putJson("/api/contract/{$contract->id}", [ 'ends_at' => 5500 ])->assertJsonValidationErrors('ends_at'); // runs into the next one
        $as->putJson("/api/contract/{$contract->id}", [ 'ends_at' => 900 ])->assertJsonValidationErrors('ends_at'); // before the start

        $as->deleteJson("/api/contract/{$contract->id}")->assertNoContent();
        $this->assertSoftDeleted($contract);
        $this->reserve([ [ 'car_id' => $this->car->id, 'starts_at' => 1000, 'ends_at' => 2000 ] ])->assertCreated(); // the car is free again
    }

    public function test_another_agencys_contract_is_not_found(): void
    {
        $foreign = Contract::factory()->create();
        $as = $this->actingAsUser($this->user);

        $as->getJson("/api/contract/{$foreign->id}")->assertNotFound();
        $as->putJson("/api/contract/{$foreign->id}", [ 'daily_price' => 1 ])->assertNotFound();
        $as->deleteJson("/api/contract/{$foreign->id}")->assertNotFound();
    }
}
