<?php

namespace Tests\Feature;

use App\Models\Car;
use App\Models\Client;
use App\Models\Contract;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BookingSourceTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_broker_booking_carries_its_commission_into_the_report_and_the_car(): void
    {
        $owner = User::factory()->create();
        $car = Car::factory()->create([ 'agency_id' => $owner->agency_id ]);
        $client = Client::factory()->create([ 'agency_id' => $owner->agency_id ]);
        $start = CarbonImmutable::create(2026, 9, 10, 10, 0, 0, 'Africa/Tunis')->getTimestamp();
        $book = fn (array $data, int $offset) => $this->actingAsUser($owner)->postJson('/api/contract', [
            'client_id' => $client->id, ...$data,
            'contracts' => [ [ 'car_id' => $car->id, 'starts_at' => $start + $offset, 'ends_at' => $start + $offset + 2 * 86400, 'daily_price' => 100000 ] ],
        ]);

        // A broker must be named.
        $book([ 'source' => Contract::SOURCE_BROKER, 'commission' => 20000 ], 0)->assertUnprocessable()->assertJsonValidationErrors('broker');
        $id = $book([ 'source' => Contract::SOURCE_BROKER, 'broker' => 'Hôtel Marhaba', 'commission' => 20000 ], 0)->assertCreated()
            ->assertJsonPath('data.0.source', Contract::SOURCE_BROKER)->assertJsonPath('data.0.commission', 20000)->json('data.0.id');
        $book([ 'source' => Contract::SOURCE_BROKER, 'broker' => ' hôtel marhaba', 'commission' => 15000 ], 5 * 86400)->assertCreated();
        $book([ 'source' => Contract::SOURCE_WHATSAPP ], 10 * 86400)->assertCreated()->assertJsonPath('data.0.commission', 0);
        $this->actingAsUser($owner)->putJson("/api/contract/$id", [ 'source' => 99 ])->assertUnprocessable();

        $report = $this->actingAsUser($owner)->getJson('/api/report?year=2026&month=9')->assertOk();
        $report->assertJsonPath('data.commissions', 35000)
            ->assertJsonPath('data.commissions_by_broker', [ [ 'broker' => 'Hôtel Marhaba', 'contracts' => 2, 'amount' => 35000 ] ]);
        $this->assertSame($report->json('data.revenue') + $report->json('data.other_income') - $report->json('data.expenses'), $report->json('data.net'));

        // Once the car went out, the commission is one of its running costs.
        Contract::find($id)->forceFill([ 'status' => Contract::STATUS_OUT ])->save();
        $this->actingAsUser($owner)->getJson("/api/car/{$car->id}")->assertJsonPath('data.money.costs.commissions', 20000);
    }
}
