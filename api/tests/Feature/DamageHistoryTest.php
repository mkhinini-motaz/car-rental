<?php

namespace Tests\Feature;

use App\Models\Car;
use App\Models\Contract;
use App\Models\ContractPhoto;
use App\Models\Expense;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DamageHistoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_open_damages_carry_over_to_the_next_rental_until_repaired(): void
    {
        $user = User::factory()->create();
        $car = Car::factory()->create([ 'agency_id' => $user->agency_id ]);
        $first = Contract::factory()->create([ 'car_id' => $car->id, 'status' => Contract::STATUS_CLOSED, 'starts_at' => 0, 'ends_at' => 86400 ]);
        $old = $first->damages()->create([ 'stage' => ContractPhoto::STAGE_PICKUP, 'x' => 100, 'y' => 100, 'note' => 'Old scratch' ]);
        $dent = $first->damages()->create([ 'stage' => ContractPhoto::STAGE_RETURN, 'x' => 500, 'y' => 500, 'note' => 'Dented door', 'amount' => 200000 ]);
        $next = Contract::factory()->create([ 'car_id' => $car->id, 'starts_at' => 2 * 86400, 'ends_at' => 3 * 86400 ]);

        // Both are on the car at the next pickup, not on the rental that marked them.
        $this->actingAsUser($user)->getJson("/api/contract/{$next->id}")
            ->assertOk()
            ->assertJsonCount(2, 'data.car_damages')
            ->assertJsonPath('data.car_damages.0.note', 'Old scratch')
            ->assertJsonPath('data.car_damages.1.contract_id', $first->id);
        $this->actingAsUser($user)->getJson("/api/contract/{$first->id}")->assertJsonMissingPath('data.car_damages');

        // Repaired for 180 TND: an expense on the car, against the rental that brought the dent back.
        $this->actingAsUser($user)->postJson("/api/car/{$car->id}/damage/{$dent->id}/repair", [ 'repaired_at' => 3 * 86400, 'amount' => 180000, 'garage' => 'Garage Ali' ])
            ->assertOk()
            ->assertJsonPath('data.repaired_at', 3 * 86400);
        $expense = Expense::sole();
        $this->assertSame([ Expense::CATEGORY_REPAIR, 180000, $car->id, $first->id, 'Dented door', 3 * 86400 ], [ $expense->category, $expense->amount, $expense->car_id, $expense->contract_id, $expense->note, $expense->spent_at ]);
        // Already there at pickup: repaired without a cost, and not the renter's.
        $this->actingAsUser($user)->postJson("/api/car/{$car->id}/damage/{$old->id}/repair", [ 'repaired_at' => 3 * 86400 ])->assertOk();
        $this->assertSame(1, Expense::count());

        $this->actingAsUser($user)->getJson("/api/contract/{$next->id}")->assertJsonCount(0, 'data.car_damages');
        $this->actingAsUser($user)->getJson("/api/car/{$car->id}")
            ->assertJsonCount(2, 'data.damages')
            ->assertJsonPath('data.damages.0.repaired_at', 3 * 86400);
        // Once only.
        $this->actingAsUser($user)->postJson("/api/car/{$car->id}/damage/{$dent->id}/repair", [ 'repaired_at' => 3 * 86400 ])->assertNotFound();
    }

    public function test_another_agencys_damage_is_not_found(): void
    {
        $contract = Contract::factory()->create();
        $damage = $contract->damages()->create([ 'stage' => ContractPhoto::STAGE_RETURN, 'x' => 1, 'y' => 1 ]);
        $stranger = User::factory()->create();
        $ownCar = Car::factory()->create([ 'agency_id' => $stranger->agency_id ]);

        $this->actingAsUser($stranger)->postJson("/api/car/{$contract->car_id}/damage/{$damage->id}/repair", [ 'repaired_at' => 1 ])->assertNotFound();
        $this->actingAsUser($stranger)->postJson("/api/car/{$ownCar->id}/damage/{$damage->id}/repair", [ 'repaired_at' => 1 ])->assertNotFound();
        $this->assertNull($damage->refresh()->repaired_at);
    }
}
