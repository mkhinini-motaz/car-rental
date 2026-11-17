<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EligibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_agency_rules_a_client_breaks_are_listed_on_the_client(): void
    {
        $user = User::factory()->create();
        $today = CarbonImmutable::now('Africa/Tunis');
        $client = Client::factory()->create([
            'agency_id' => $user->agency_id,
            'birth_date' => $today->subYears(20)->format('d/m/Y'),
            'driver_licence_delivery_date' => $today->subYear()->subDay()->format('d/m/Y'),
            'driver_licence_expiry_date' => $today->subDay()->format('d/m/Y'),
        ]);

        // No rules yet (the default): only the expired licence.
        $this->actingAsUser($user)->getJson("/api/client/{$client->id}")
            ->assertOk()
            ->assertJsonPath('data.eligibility', [ [ 'code' => 'licence_expired', 'date' => $client->driver_licence_expiry_date ] ]);

        $this->actingAsUser($user)->putJson('/api/agency', [ 'min_driver_age' => 21, 'min_licence_years' => 2 ])->assertOk()
            ->assertJsonPath('data.min_driver_age', 21);
        $this->actingAsUser($user)->getJson("/api/client/{$client->id}")
            ->assertJsonPath('data.eligibility.0', [ 'code' => 'age', 'min' => 21, 'value' => 20 ])
            ->assertJsonPath('data.eligibility.1', [ 'code' => 'licence_years', 'min' => 2, 'value' => 1 ]);

        $this->actingAsUser($user)->putJson("/api/client/{$client->id}", [
            'first_name' => $client->first_name, 'last_name' => $client->last_name, 'phone' => $client->phone,
            'birth_date' => $today->subYears(30)->format('d/m/Y'),
            'driver_licence_delivery_date' => $today->subYears(5)->format('d/m/Y'),
            'driver_licence_expiry_date' => $today->addYears(5)->format('d/m/Y'),
        ])->assertOk();
        $this->actingAsUser($user)->getJson("/api/client/{$client->id}")->assertJsonPath('data.eligibility', []);
    }
}
