<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Car;
use App\Models\CarBlock;
use App\Models\Client;
use App\Models\Contract;
use App\Models\Expense;
use App\Models\Income;
use App\Models\Payment;
use App\Models\SalaryPayment;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportsClientsTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create()->refresh();
    }

    private function tunis(string $date): int
    {
        return CarbonImmutable::parse($date, Agency::TIMEZONE)->getTimestamp();
    }

    private function rental(Car $car, Client $client, string $from, string $to, array $attributes = [], bool $paid = true): Contract
    {
        $contract = Contract::factory()->create([ 'car_id' => $car->id, 'client_id' => $client->id, 'daily_price' => $car->daily_price, 'starts_at' => $this->tunis($from), 'ends_at' => $this->tunis($to) ]);
        $contract->forceFill([ 'status' => Contract::STATUS_CLOSED, 'returned_at' => $this->tunis($to), ...$attributes ])->save();
        if ($paid) {
            $contract->payments()->create([ 'amount' => $contract->totalPrice(), 'method' => Payment::METHOD_CASH, 'paid_at' => $contract->ends_at ]);
        }

        return $contract;
    }

    public function test_the_monthly_report_counts_everything_once(): void
    {
        $agency = $this->owner->agency;
        $agency->forceFill([ 'employer_charges_rate' => 1657, 'created_at' => $this->tunis('2026-01-01') ])->save(); // in the app since January
        $carA = Car::factory()->create([ 'agency_id' => $agency->id, 'daily_price' => 100000, 'mileage' => 21000 ]);
        $carB = Car::factory()->create([ 'agency_id' => $agency->id, 'daily_price' => 50000 ]);
        foreach ([ $carA, $carB ] as $car) {
            $car->forceFill([ 'created_at' => $this->tunis('2026-01-01') ])->save();
        }
        [ $ali, $sara ] = Client::factory()->count(2)->create([ 'agency_id' => $agency->id ]);

        // August: Ali 10 days on A, back 5 hours late with 80 TND of damage, taken from his
        // deposit (kept at close: not revenue a second time); Sara 5 days on B. July: Sara 10 days on B.
        $this->rental($carA, $ali, '2026-08-01', '2026-08-11', [
            'returned_at' => $this->tunis('2026-08-11 05:00'), 'charges' => [ [ 'type' => 'damage', 'quantity' => 1, 'amount' => 80000 ] ],
            'deposit' => 300000, 'deposit_kept' => 80000, 'pickup_mileage' => 20000, 'return_mileage' => 21000,
        ]);
        $this->rental($carB, $sara, '2026-08-20', '2026-08-25');
        $this->rental($carB, $sara, '2026-07-01', '2026-07-11');
        $cancelled = Contract::factory()->create([ 'car_id' => $carA->id, 'starts_at' => $this->tunis('2026-08-15'), 'ends_at' => $this->tunis('2026-08-16') ]);
        $cancelled->forceFill([ 'status' => Contract::STATUS_CANCELLED ])->save();
        $cancelled->forceFill([ 'deleted_at' => $this->tunis('2026-08-14') ])->save();
        CarBlock::forceCreate([ 'car_id' => $carB->id, 'starts_at' => $this->tunis('2026-08-26'), 'ends_at' => $this->tunis('2026-08-29'), 'reason' => CarBlock::REASON_MAINTENANCE ]);

        // Costs: an oil change and an instalment on A, the branch's rent, a CNSS payment (the same
        // money as the employer's charges, so left out), a salary; income: an insurance payout.
        $spent = fn (array $data) => $agency->expenses()->create([ 'spent_at' => $this->tunis('2026-08-12'), ...$data ]);
        $spent([ 'car_id' => $carA->id, 'category' => Expense::CATEGORY_OIL_CHANGE, 'amount' => 100000, 'mileage' => 21000 ]);
        $spent([ 'car_id' => $carA->id, 'category' => Expense::CATEGORY_INSTALMENT, 'amount' => 1000000 ]);
        $branch = $agency->branches()->create([ 'name' => 'Centre', 'monthly_rent' => 800000 ]);
        $spent([ 'category' => Expense::CATEGORY_RENT, 'amount' => 800000, 'branch_id' => $branch->id ]);
        $spent([ 'category' => Expense::CATEGORY_CNSS, 'amount' => 50000 ]);
        $employee = $agency->employees()->create([ 'first_name' => 'Sami', 'monthly_salary' => 900000 ]);
        $employee->salaryPayments()->create([ 'month' => '2026-08', 'type' => SalaryPayment::TYPE_SALARY, 'amount' => 900000, 'paid_at' => $this->tunis('2026-08-31 18:00') ]);
        $agency->incomes()->create([ 'category' => Income::CATEGORY_INSURANCE_PAYOUT, 'amount' => 200000, 'received_at' => $this->tunis('2026-08-20') ]);

        $report = $this->actingAsUser($this->owner)->getJson('/api/report?year=2026&month=8')->assertOk()->json('data');

        $this->assertSame(1330000, $report['revenue']); // 1 000 + 80 (damage, once) + 250 TND
        $this->assertSame(200000, $report['other_income']);
        $this->assertSame([ 100000, 1000000, 800000, 900000, 149130 ], [ $report['car_costs'], $report['instalments'], $report['overhead'], $report['payroll'], $report['employer_charges'] ]);
        $this->assertSame(1330000 + 200000 - 2949130, $report['net']);
        $this->assertSame([ 'revenue' => 500000, 'net' => 500000, 'utilization_rate' => 0.161 ], $report['previous']); // 10 of 62 car-days
        $this->assertSame(0.242, $report['utilization_rate']); // 15 of 62
        $this->assertSame([
            'average_daily_rate' => 83333, 'contracts_started' => 2, 'contracts_cancelled' => 1, 'average_days' => 7.5,
            'late_returns' => 1, 'late_hours' => 5, 'overdue_now' => 0,
        ], $report['kpis']);
        $this->assertSame([ [ 'branch' => [ 'id' => $branch->id, 'name' => 'Centre' ], 'amount' => 800000 ] ], $report['overhead_by_branch']);
        $this->assertSame(400000, $report['overhead_per_car']);
        $this->assertSame(900000, $report['payroll_by_employee'][0]['amount']);

        $b = collect($report['utilization'])->firstWhere('car.id', $carB->id);
        $this->assertSame([ 5, 3, 23 ], [ $b['days_rented'], $b['maintenance_days'], $b['idle_days'] ]);
        $this->assertSame(100, collect($report['utilization'])->firstWhere('car.id', $carA->id)['cost_per_km']); // 100 TND over 1 000 km (the instalment isn't a running cost)

        // Clients by revenue: Ali first, a risk (damage); Sara good.
        $this->assertSame([ [ $ali->id, 'risk' ], [ $sara->id, 'good' ] ], collect($report['clients'])->map(fn ($row) => [ $row['client']['id'], $row['badge'] ])->all());

        $csv = $this->get($report['export_url'])->assertOk()->getContent();
        $this->assertStringStartsWith("\u{FEFF}\"Revenue (TND)\",1330.000", $csv);
    }

    public function test_client_numbers_and_badge(): void
    {
        $agency = $this->owner->agency;
        $car = Car::factory()->create([ 'agency_id' => $agency->id, 'daily_price' => 100000 ]);
        $client = Client::factory()->create([ 'agency_id' => $agency->id ]);
        $show = fn () => $this->actingAsUser($this->owner)->getJson("/api/client/{$client->id}")->assertOk()->json('data.stats');

        $this->assertSame('new', $show()['badge']);

        // One rental paid, one late by 3 hours with 100 TND unpaid: watch.
        $this->rental($car, $client, '2026-06-01', '2026-06-04');
        $late = $this->rental($car, $client, '2026-07-01', '2026-07-03', [ 'returned_at' => $this->tunis('2026-07-03 03:00') ], false);
        $late->payments()->create([ 'amount' => 100000, 'method' => Payment::METHOD_CASH, 'paid_at' => $late->ends_at ]);
        $stats = $show();
        $this->assertSame([ 2, 500000, 250000, 2.5, 100000, 1, 3, 'watch' ], [
            $stats['contracts_count'], $stats['revenue'], $stats['average_value'], $stats['average_days'], $stats['outstanding'], $stats['late_returns'], $stats['late_hours'], $stats['badge'],
        ]);

        // A no-show (cancelled after its start) and a repair on his rental not charged to him: risk,
        // and the repair comes off what he brought in.
        $noShow = Contract::factory()->create([ 'car_id' => $car->id, 'client_id' => $client->id, 'starts_at' => $this->tunis('2026-08-01'), 'ends_at' => $this->tunis('2026-08-02') ]);
        $noShow->forceFill([ 'status' => Contract::STATUS_CANCELLED, 'deleted_at' => $this->tunis('2026-08-01 12:00') ])->save();
        $this->actingAsUser($this->owner)->postJson('/api/expense', [ 'category' => Expense::CATEGORY_REPAIR, 'amount' => 150000, 'spent_at' => time(), 'contract_id' => $late->id ])
            ->assertCreated()->assertJsonPath('data.car_id', $car->id);
        $stats = $show();
        $this->assertSame([ 1, 1, 150000, 'risk' ], [ $stats['cancellations'], $stats['no_shows'], $stats['repair_costs'], $stats['badge'] ]);
        $this->assertSame(500000 - 150000 - 100000, $stats['net']);

        // Staff's flag always wins.
        $good = Client::factory()->create([ 'agency_id' => $agency->id, 'flag' => Client::FLAG_OTHER ]);
        $this->actingAsUser($this->owner)->getJson("/api/client/{$good->id}")->assertJsonPath('data.stats.badge', 'risk');
    }
}
