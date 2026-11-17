<?php

namespace Tests\Feature;

use App\Models\Car;
use App\Models\Client;
use App\Models\Contract;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClientApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_list_and_search_only_the_agencys_clients(): void
    {
        $user = User::factory()->create();
        Client::factory()->create([ 'agency_id' => $user->agency_id, 'first_name' => 'Amira', 'last_name' => 'Gharbi', 'phone' => '+21622111222' ]);
        Client::factory()->create([ 'agency_id' => $user->agency_id, 'first_name' => 'Sami', 'last_name' => 'Mejri' ]);
        Client::factory()->create([ 'first_name' => 'Amira' ]); // another agency

        $this->actingAsUser($user)->getJson('/api/client')->assertOk()->assertJsonPath('total', 2);
        $this->actingAsUser($user)->getJson('/api/client?search=amira')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.last_name', 'Gharbi');
        $this->actingAsUser($user)->getJson('/api/client?search=' . urlencode('22 111'))
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_create_with_only_name_and_phone(): void
    {
        $user = User::factory()->create();

        $this->actingAsUser($user)->postJson('/api/client', [ 'first_name' => 'Nour', 'last_name' => 'Sassi', 'phone' => '+216 55 123 456' ])
            ->assertCreated()
            ->assertJsonPath('data.phone', '+21655123456')
            ->assertJsonPath('data.agency_id', $user->agency_id)
            ->assertJsonPath('data.id_number', null);
    }

    public function test_create_validates_the_fields(): void
    {
        $user = User::factory()->create();
        Client::factory()->create([ 'agency_id' => $user->agency_id, 'phone' => '+21655123456' ]);
        $valid = [ 'first_name' => 'Nour', 'last_name' => 'Sassi', 'phone' => '+21698765432' ];

        $this->actingAsUser($user)->postJson('/api/client', [])->assertJsonValidationErrors([ 'first_name', 'last_name', 'phone' ]);
        $this->actingAsUser($user)->postJson('/api/client', [ ...$valid, 'phone' => '+21655123456' ])->assertJsonValidationErrors('phone');
        $this->actingAsUser($user)->postJson('/api/client', [ ...$valid, 'phone' => '12345' ])->assertJsonValidationErrors('phone');
        $this->actingAsUser($user)->postJson('/api/client', [ ...$valid, 'gender' => 3 ])->assertJsonValidationErrors('gender');
        $this->actingAsUser($user)->postJson('/api/client', [ ...$valid, 'driver_licence_delivery_date' => '01/01/2999' ])
            ->assertJsonValidationErrors('driver_licence_delivery_date');
        $this->actingAsUser($user)->postJson('/api/client', [ ...$valid, 'birth_date' => '1990-01-01' ])->assertJsonValidationErrors('birth_date');

        // The same phone is fine in another agency.
        $this->actingAsUser(User::factory()->create())->postJson('/api/client', [ ...$valid, 'phone' => '+21655123456' ])->assertCreated();
    }

    public function test_show_with_history_and_update(): void
    {
        $user = User::factory()->create();
        $client = Client::factory()->create([ 'agency_id' => $user->agency_id, 'phone' => '+21622000000' ]);
        $car = Car::factory()->create([ 'agency_id' => $user->agency_id ]);
        Contract::factory()->create([ 'car_id' => $car->id, 'client_id' => $client->id, 'starts_at' => 1000, 'ends_at' => 2000 ]);
        Contract::factory()->create([ 'car_id' => $car->id, 'client_id' => $client->id, 'starts_at' => 5000, 'ends_at' => 6000 ]);

        $this->actingAsUser($user)->getJson("/api/client/{$client->id}")
            ->assertOk()
            ->assertJsonCount(2, 'data.contracts')
            ->assertJsonPath('data.contracts.0.starts_at', 5000)
            ->assertJsonPath('data.contracts.0.car.id', $car->id);

        $this->actingAsUser($user)->putJson("/api/client/{$client->id}", [
            'first_name' => 'Hela', 'last_name' => 'Zouari', 'phone' => '+21622000000',
            'id_number' => '09876543', 'driver_licence_delivery_date' => '15/03/2015',
        ])->assertOk()->assertJsonPath('data.first_name', 'Hela')->assertJsonPath('data.id_number', '09876543');

        $other = Client::factory()->create();
        $this->actingAsUser($user)->getJson("/api/client/{$other->id}")->assertNotFound();
        $this->actingAsUser($user)->putJson("/api/client/{$other->id}", [ 'first_name' => 'x', 'last_name' => 'y', 'phone' => '+21622000001' ])->assertNotFound();
    }
}
