<?php

namespace Tests\Feature;

use App\Models\Car;
use App\Models\Contract;
use App\Models\DeviceToken;
use App\Models\User;
use App\Support\Push;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StaffTasksTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_pickup_and_return_are_given_to_staff_who_get_a_push(): void
    {
        $owner = User::factory()->create([ 'role' => User::ROLE_OWNER ]);
        $manager = User::factory()->create([ 'agency_id' => $owner->agency_id, 'role' => User::ROLE_MANAGER, 'first_name' => 'Sami', 'last_name' => 'Ben Ali' ]);
        DeviceToken::create([ 'token' => 'sami-phone', 'platform' => 'android', 'lang' => 'fr', 'user_id' => $manager->id ]);
        $car = Car::factory()->create([ 'agency_id' => $owner->agency_id, 'licence_plate' => '200 TN 1234' ]);
        // 10:00 on 1 June 2026 in Tunis.
        $contract = Contract::factory()->create([ 'car_id' => $car->id, 'starts_at' => 1780304400, 'ends_at' => 1780304400 + 86400 ]);
        $client = $contract->client->first_name . ' ' . $contract->client->last_name;
        $sent = [];
        $this->app->instance(Push::class, new class($sent) extends Push {
            public function __construct(private array &$sent) {}
            public function send(DeviceToken $device, string $title, string $body, array $data = []): void
            {
                $this->sent[] = [ $device->token, $title, $body, $data ];
            }
        });

        // The staff list comes with the agency.
        $this->actingAsUser($owner)->getJson('/api/agency')->assertJsonCount(2, 'data.staff')->assertJsonFragment([ 'id' => $manager->id, 'first_name' => 'Sami', 'last_name' => 'Ben Ali', 'branch_id' => null ]);
        $this->actingAsUser($owner)->putJson("/api/contract/{$contract->id}", [ 'pickup_user_id' => $manager->id, 'return_user_id' => $owner->id ])
            ->assertOk()
            ->assertJsonPath('data.pickup_user_id', $manager->id)
            ->assertJsonPath('data.return_user_id', $owner->id)
            ->assertJsonPath('data.activities.0.changes.pickup_user', [ null, 'Sami Ben Ali' ]);
        // Only Sami is told: the owner gave the return to themselves.
        $this->assertSame([ [ 'sami-phone', 'Nouvelle tâche', "Remettre \u{202A}200 TN 1234\u{202C} à $client, le 01/06 10:00", [ 'contract_id' => $contract->id ] ] ], $sent);
        // Saving it again tells no one.
        $this->actingAsUser($owner)->putJson("/api/contract/{$contract->id}", [ 'pickup_user_id' => $manager->id ])->assertOk();
        $this->assertCount(1, $sent);

        // Someone of another agency, or a branch manager of another branch, can't be given the car.
        $stranger = User::factory()->create();
        $elsewhere = User::factory()->create([ 'agency_id' => $owner->agency_id, 'branch_id' => $owner->agency->branches()->create([ 'name' => 'Airport' ])->id ]);
        foreach ([ $stranger, $elsewhere ] as $user) {
            $this->actingAsUser($owner)->putJson("/api/contract/{$contract->id}", [ 'return_user_id' => $user->id ])->assertJsonValidationErrors('return_user_id');
        }
    }

    public function test_a_returned_car_is_to_clean_until_ticked_or_out_again(): void
    {
        $user = User::factory()->create();
        $car = Car::factory()->create([ 'agency_id' => $user->agency_id ]);
        $now = time();
        $returned = Contract::factory()->create([ 'car_id' => $car->id, 'status' => Contract::STATUS_CLOSED, 'starts_at' => $now - 3 * 86400, 'ends_at' => $now - 3600, 'returned_at' => $now - 3600 ]);
        $dashboard = fn () => $this->actingAsUser($user)->getJson('/api/dashboard?starts_at=' . ($now - 86400) . '&ends_at=' . ($now + 86400));

        $dashboard()->assertJsonCount(1, 'data.to_clean')->assertJsonPath('data.to_clean.0.id', $returned->id);
        // A reservation can't be cleaned.
        $reserved = Contract::factory()->create([ 'car_id' => $car->id, 'starts_at' => $now + 86400, 'ends_at' => $now + 2 * 86400 ]);
        $this->actingAsUser($user)->postJson("/api/contract/{$reserved->id}/cleaned", [ 'cleaned' => true ])->assertJsonValidationErrors('status');

        $this->actingAsUser($user)->postJson("/api/contract/{$returned->id}/cleaned", [ 'cleaned' => true ])->assertOk()->assertJsonPath('data.activities.0.action', 'cleaned');
        $dashboard()->assertJsonCount(0, 'data.to_clean');
        $this->actingAsUser($user)->postJson("/api/contract/{$returned->id}/cleaned", [ 'cleaned' => false ])->assertOk()->assertJsonPath('data.cleaned_at', null);
        $dashboard()->assertJsonCount(1, 'data.to_clean');

        // Handed over again without the tick: no longer at the agency to clean.
        $reserved->forceFill([ 'status' => Contract::STATUS_OUT, 'picked_up_at' => $now ])->save();
        $dashboard()->assertJsonCount(0, 'data.to_clean');
    }

    public function test_a_car_back_dirty_is_charged_its_wash_and_a_clean_one_has_nothing_to_clean(): void
    {
        $user = User::factory()->create();
        $car = Car::factory()->create([ 'agency_id' => $user->agency_id ]);
        $out = fn () => Contract::factory()->create([ 'car_id' => $car->id, 'status' => Contract::STATUS_OUT, 'starts_at' => time() - 86400, 'ends_at' => time() + 3600, 'picked_up_at' => time() - 86400, 'pickup_mileage' => 1000 ]);

        // The usual wash, prefilled by the apps; the owner can change it.
        $this->actingAsUser($user)->getJson('/api/agency/pricing')->assertJsonPath('data.washing_price', 20000);

        $dirty = $out();
        $this->actingAsUser($user)->postJson("/api/contract/{$dirty->id}/return", [ 'mileage' => 1200, 'dirty' => true, 'washing' => 30000 ])
            ->assertOk()
            ->assertJsonPath('data.charges', [ [ 'type' => 'washing', 'quantity' => 1, 'amount' => 30000 ] ])
            ->assertJsonPath('data.total_price', $dirty->rentPrice() + 30000)
            ->assertJsonPath('data.cleaned_at', null);

        $clean = $out();
        $this->actingAsUser($user)->postJson("/api/contract/{$clean->id}/return", [ 'mileage' => 1200, 'dirty' => false, 'washing' => 30000 ])
            ->assertOk()
            ->assertJsonPath('data.charges', [])
            ->assertJsonPath('data.cleaned_at', $clean->refresh()->returned_at);
    }
}
