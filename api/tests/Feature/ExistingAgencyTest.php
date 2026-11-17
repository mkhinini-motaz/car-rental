<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Car;
use App\Models\Client;
use App\Models\Contract;
use App\Models\Expense;
use App\Models\Fine;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * An agency that joins after years of business: its cars, credits and oil changes have a past the
 * app never saw. Figures say where they start instead of passing for the whole story.
 */
class ExistingAgencyTest extends TestCase
{
    use RefreshDatabase;

    const DAY = 86400;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create()->refresh();
    }

    private function today(): CarbonImmutable
    {
        return CarbonImmutable::now(Agency::TIMEZONE)->startOfDay();
    }

    private function car(array $attributes = []): Car
    {
        return Car::factory()->create([ 'agency_id' => $this->owner->agency_id, 'daily_price' => 100000, 'mileage' => 60000, ...$attributes ]);
    }

    public function test_a_car_added_with_a_past_counts_from_the_day_it_was_added(): void
    {
        $bought = $this->today()->subYears(2);
        $old = $this->car([ 'first_circulation_date' => $bought->format('d/m/Y'), 'created_at' => time() - 30 * self::DAY ]); // added a month ago
        $this->actingAsUser($this->owner)->putJson("/api/car/{$old->id}/purchase", [ 'purchase_price' => 60000000, 'bought_at' => $bought->getTimestamp() ])->assertOk();
        Contract::factory()->state([ 'status' => Contract::STATUS_CLOSED ])->create([ 'car_id' => $old->id, 'daily_price' => 100000, 'starts_at' => time() - 10 * self::DAY, 'ends_at' => time() - 7 * self::DAY ]);

        $money = $this->actingAsUser($this->owner)->getJson("/api/car/{$old->id}")->json('data.money');
        $this->assertSame((int) $old->created_at, $money['history_since']);
        $this->assertSame(300000, $money['earned']);
        $this->assertNull($money['payback']); // two years of rentals are missing
        $this->assertSame(300000, $money['monthly_earned']); // over the one month it's been in the app, not six

        // Bought and added the same week: its whole life is in the app.
        $new = $this->car([ 'first_circulation_date' => $this->today()->subDays(5)->format('d/m/Y') ]);
        $this->actingAsUser($this->owner)->putJson("/api/car/{$new->id}/purchase", [ 'purchase_price' => 60000000, 'bought_at' => $this->today()->subDays(5)->getTimestamp() ])->assertOk();
        $money = $this->actingAsUser($this->owner)->getJson("/api/car/{$new->id}")->json('data.money');
        $this->assertNull($money['history_since']);
        $this->assertSame(0.0, (float) $money['payback']);

        // The report ranks the fleet by payback: the car with a past comes last, marked.
        $report = $this->actingAsUser($this->owner)->getJson('/api/report?year=' . $this->today()->year . '&month=' . $this->today()->month)->json('data');
        $this->assertSame([ $new->id, $old->id ], array_column(array_column($report['fleet'], 'car'), 'id'));
        $this->assertSame([ null, (int) $old->created_at ], array_column($report['fleet'], 'history_since'));
    }

    public function test_instalments_paid_before_the_app_count_as_paid(): void
    {
        $car = $this->car();
        $first = $this->today()->subMonthsNoOverflow(24)->addDays(3);
        $this->actingAsUser($this->owner)->putJson("/api/car/{$car->id}/purchase", [
            'purchase_price' => 60000000, 'instalment_amount' => 1500000, 'instalment_months' => 36, 'first_instalment_at' => $first->getTimestamp(),
            'instalments_paid_before' => 24,
        ])->assertOk()->assertJsonPath('data.instalments_paid_before', 24);
        $this->actingAsUser($this->owner)->putJson("/api/car/{$car->id}/purchase", [ 'instalments_paid_before' => -1 ])->assertJsonValidationErrors('instalments_paid_before');

        $financing = $this->actingAsUser($this->owner)->getJson("/api/car/{$car->id}")->json('data.money.financing');
        $this->assertSame(24, $financing['paid']);
        $this->assertSame(12 * 1500000, $financing['remaining']);
        $this->assertSame($first->addMonthsNoOverflow(24)->getTimestamp(), $financing['next_due_at']); // in 3 days, not two years ago

        $bounds = '?starts_at=' . $this->today()->getTimestamp() . '&ends_at=' . $this->today()->addDay()->getTimestamp();
        $due = $this->actingAsUser($this->owner)->getJson("/api/dashboard$bounds")->json('data.instalments_due');
        $this->assertSame([ $financing['next_due_at'] ], array_column($due, 'next_due_at'));
    }

    public function test_an_oil_change_never_recorded_counts_from_the_first_registration(): void
    {
        $old = $this->car([ 'first_circulation_date' => $this->today()->subYears(2)->format('d/m/Y'), 'oil_change_every_km' => 10000, 'oil_change_every_months' => 12 ]);
        $new = $this->car([ 'first_circulation_date' => $this->today()->subMonthNoOverflow()->format('d/m/Y'), 'mileage' => 1500, 'oil_change_every_km' => 10000, 'oil_change_every_months' => 12 ]);

        $oil = $this->actingAsUser($this->owner)->getJson("/api/car/{$old->id}")->json('data.oil_change');
        $this->assertNull($oil['last_at']); // unknown: the app shows it as missing
        $this->assertTrue($oil['is_due']);
        $oil = $this->actingAsUser($this->owner)->getJson("/api/car/{$new->id}")->json('data.oil_change');
        $this->assertSame(10000, $oil['due_mileage']);
        $this->assertSame($this->today()->subMonthNoOverflow()->addMonthsNoOverflow(12)->getTimestamp(), $oil['due_at']);
        $this->assertFalse($oil['is_due']);

        $bounds = '?starts_at=' . $this->today()->getTimestamp() . '&ends_at=' . $this->today()->addDay()->getTimestamp();
        $this->assertSame([ $old->id ], array_column($this->actingAsUser($this->owner)->getJson("/api/dashboard$bounds")->json('data.maintenance_due'), 'id'));

        // Once the last one is entered with its date, it counts from there.
        $this->owner->agency->expenses()->create([ 'car_id' => $old->id, 'category' => Expense::CATEGORY_OIL_CHANGE, 'amount' => 90000, 'spent_at' => $this->today()->subMonth()->getTimestamp(), 'mileage' => 58000 ]);
        $oil = $this->actingAsUser($this->owner)->getJson("/api/car/{$old->id}")->json('data.oil_change');
        $this->assertSame(68000, $oil['due_mileage']);
        $this->assertFalse($oil['is_due']);
    }

    public function test_the_report_has_no_data_before_the_agency_joined(): void
    {
        $joined = $this->today()->startOfMonth()->subMonths(2)->addDays(10);
        $this->owner->agency->forceFill([ 'created_at' => $joined->getTimestamp() ])->save();

        $report = $this->actingAsUser($this->owner)->getJson('/api/report?year=' . $this->today()->year . '&month=' . $this->today()->month)->json('data');
        $this->assertSame($joined->getTimestamp(), $report['since']);
        $this->assertSame(9, collect($report['months'])->whereNull('revenue')->count()); // the joining month counts
        $this->assertSame(0, $report['months'][9]['revenue']);

        // The joining month has nothing to compare with.
        $first = $this->actingAsUser($this->owner)->getJson("/api/report?year={$joined->year}&month={$joined->month}")->json('data');
        $this->assertSame([ 'revenue' => null, 'net' => null, 'utilization_rate' => null ], $first['previous']);
        $this->assertNotNull($report['previous']['revenue']);

        // Rentals entered from the notebook open the months they cover.
        $older = $joined->subMonths(3);
        Contract::factory()->state([ 'status' => Contract::STATUS_CLOSED ])->create([ 'car_id' => $this->car()->id, 'starts_at' => $older->getTimestamp(), 'ends_at' => $older->addDays(2)->getTimestamp() ]);
        $report = $this->actingAsUser($this->owner)->getJson('/api/report?year=' . $this->today()->year . '&month=' . $this->today()->month)->json('data');
        $this->assertSame($older->getTimestamp(), $report['since']);
        $this->assertSame(6, collect($report['months'])->whereNull('revenue')->count());
    }

    public function test_old_rentals_or_what_the_car_brought_in_before_fill_the_gap(): void
    {
        $bought = $this->today()->subYears(2);
        $car = $this->car([ 'first_circulation_date' => $bought->format('d/m/Y') ]);
        $this->actingAsUser($this->owner)->putJson("/api/car/{$car->id}/purchase", [ 'purchase_price' => 60000000, 'bought_at' => $bought->getTimestamp() ])->assertOk();
        $this->assertNotNull($this->actingAsUser($this->owner)->getJson("/api/car/{$car->id}")->json('data.money.history_since'));

        // Its rentals from the paper notebook, entered back to its first weeks: the history is whole.
        Contract::factory()->state([ 'status' => Contract::STATUS_CLOSED ])->create([ 'car_id' => $car->id, 'daily_price' => 100000, 'starts_at' => $bought->addDays(10)->getTimestamp(), 'ends_at' => $bought->addDays(13)->getTimestamp() ]);
        $money = $this->actingAsUser($this->owner)->getJson("/api/car/{$car->id}")->json('data.money');
        $this->assertNull($money['history_since']);
        $this->assertEqualsWithDelta(0.005, $money['payback'], 0.0005); // 300 of 60 000 TND

        // Or, for another car, one figure for what it brought in before the app.
        $other = $this->car([ 'first_circulation_date' => $bought->format('d/m/Y') ]);
        $this->actingAsUser($this->owner)->putJson("/api/car/{$other->id}/purchase", [ 'purchase_price' => 60000000, 'earned_before' => 30000000 ])
            ->assertOk()->assertJsonPath('data.earned_before', 30000000);
        $money = $this->actingAsUser($this->owner)->getJson("/api/car/{$other->id}")->json('data.money');
        $this->assertNull($money['history_since']);
        $this->assertSame(30000000, $money['earned']);
        $this->assertSame(30000000, $money['earned_before']);
        $this->assertEquals(0.5, $money['payback']);
    }

    public function test_a_car_already_out_when_the_agency_joined_is_handed_over_at_its_real_times(): void
    {
        $car = $this->car();
        $contract = Contract::factory()->create([ 'car_id' => $car->id, 'daily_price' => 100000, 'starts_at' => time() - 12 * self::DAY, 'ends_at' => time() - 2 * self::DAY ]);
        $this->owner->agency->forceFill([ 'pricing' => [ 'late_per' => 'day' ] ])->save(); // a day's rent per day late
        $as = $this->actingAsUser($this->owner);

        $as->postJson("/api/contract/{$contract->id}/pickup", [ 'mileage' => 60000, 'at' => $contract->starts_at - 3600 ])->assertJsonValidationErrors('at'); // before its booked start
        $as->postJson("/api/contract/{$contract->id}/pickup", [ 'mileage' => 60000, 'at' => $contract->starts_at ])->assertOk()->assertJsonPath('data.picked_up_at', $contract->starts_at);

        // A fine from its first days finds it.
        $fine = $as->postJson('/api/fine', [ 'car_id' => $car->id, 'committed_at' => $contract->starts_at + self::DAY, 'amount' => 40000 ])->assertCreated();
        $this->assertSame($contract->id, $fine->json('data.contract_id'));

        // Back on time two days ago, as the notebook says: not two days late.
        $late = fn (string $at) => collect($as->getJson("/api/contract/{$contract->id}/charges?mileage=61000$at")->json('data.charges'))->firstWhere('type', 'late');
        $this->assertNotNull($late('')); // returned now: two days late
        $this->assertNull($late('&at=' . $contract->ends_at));
        $as->postJson("/api/contract/{$contract->id}/return", [ 'mileage' => 61000, 'at' => $contract->starts_at - 60 ])->assertJsonValidationErrors('at'); // before the pickup
        $as->postJson("/api/contract/{$contract->id}/return", [ 'mileage' => 61000, 'at' => $contract->ends_at ])->assertOk()->assertJsonPath('data.returned_at', $contract->ends_at);
    }

    public function test_a_fine_from_a_rental_kept_on_paper_names_the_renter(): void
    {
        $car = $this->car();
        $client = Client::factory()->create([ 'agency_id' => $this->owner->agency_id ]);
        $foreign = Client::factory()->create();
        $rented = Contract::factory()->create([ 'car_id' => $car->id, 'starts_at' => time() - 3 * self::DAY, 'ends_at' => time() - self::DAY ]);
        $as = $this->actingAsUser($this->owner);

        $fine = $as->postJson('/api/fine', [ 'car_id' => $car->id, 'committed_at' => time() - 90 * self::DAY, 'amount' => 60000 ])->assertCreated()->assertJsonPath('data.contract_id', null)->json('data');
        $as->putJson("/api/fine/{$fine['id']}/client", [ 'client_id' => $foreign->id ])->assertJsonValidationErrors('client_id'); // another agency's
        $as->putJson("/api/fine/{$fine['id']}/client", [ 'client_id' => $client->id ])->assertOk()
            ->assertJsonPath('data.client_id', $client->id)->assertJsonPath('data.client.first_name', $client->first_name);

        // It counts against them, and the report says who owes it.
        $stats = $as->getJson("/api/client/{$client->id}")->json('data.stats');
        $this->assertSame([ 60000, 'risk' ], [ $stats['fines_unpaid'], $stats['badge'] ]);
        $unpaid = $as->getJson('/api/report?year=' . $this->today()->year . '&month=' . $this->today()->month)->json('data.unpaid_fines');
        $this->assertSame($client->id, $unpaid[0]['client']['id']);

        // A fine the app matched to a rental keeps that rental's client.
        $matched = $as->postJson('/api/fine', [ 'car_id' => $car->id, 'committed_at' => $rented->starts_at + 3600, 'amount' => 20000 ])->json('data.id');
        $as->putJson("/api/fine/$matched/client", [ 'client_id' => $client->id ])->assertJsonPath('errors.client_id.0', 'fine:client:contract');
        $as->putJson("/api/fine/{$fine['id']}/client", [ 'client_id' => null ])->assertOk()->assertJsonPath('data.client_id', null);
        $this->assertSame(0, Fine::where('client_id', $client->id)->count());
    }
}
