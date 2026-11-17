<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Car;
use App\Models\Contract;
use App\Models\Expense;
use App\Models\Income;
use App\Models\Payment;
use App\Models\SalaryPayment;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FleetMoneyTest extends TestCase
{
    use RefreshDatabase;

    const DAY = 86400;

    private User $owner;
    private User $manager;
    private Car $car;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create()->refresh();
        $this->manager = User::factory()->create([ 'agency_id' => $this->owner->agency_id, 'role' => User::ROLE_MANAGER ]);
        $this->car = Car::factory()->create([ 'agency_id' => $this->owner->agency_id, 'daily_price' => 100000, 'first_circulation_date' => '01/01/2025' ]);
    }

    private function asOwner(): static
    {
        return $this->actingAsUser($this->owner);
    }

    private function today(): CarbonImmutable
    {
        return CarbonImmutable::now(Agency::TIMEZONE)->startOfDay();
    }

    public function test_purchase_financing_and_payback(): void
    {
        $firstInstalment = $this->today()->subMonthsNoOverflow(2)->getTimestamp();
        $this->actingAsUser($this->manager)->putJson("/api/car/{$this->car->id}/purchase", [ 'purchase_price' => 60000000 ])->assertForbidden();
        $this->asOwner()->putJson("/api/car/{$this->car->id}/purchase", [ 'instalment_amount' => 1000000 ])->assertJsonValidationErrors('instalment_months');
        $this->asOwner()->putJson("/api/car/{$this->car->id}/purchase", [
            'purchase_price' => 60000000, 'purchase_fees' => 1000000, 'supplier' => 'Ennakl', 'bought_at' => $firstInstalment - 30 * self::DAY,
            'advance' => 20000000, 'instalment_amount' => 1000000, 'instalment_months' => 48, 'first_instalment_at' => $firstInstalment, 'lender' => 'Attijari Leasing',
        ])->assertOk();
        $this->car->forceFill([ 'created_at' => $firstInstalment - 30 * self::DAY ])->save(); // in the app since it was bought

        // Two instalments paid; running costs: insurance and an oil change; a fine the agency bore.
        $expense = fn (int $category, int $amount, array $extra = []) => $this->asOwner()->postJson('/api/expense', [ 'car_id' => $this->car->id, 'category' => $category, 'amount' => $amount, 'spent_at' => time(), ...$extra ]);
        $expense(Expense::CATEGORY_INSTALMENT, 1000000)->assertCreated();
        $expense(Expense::CATEGORY_INSTALMENT, 1000000)->assertCreated();
        $expense(Expense::CATEGORY_INSURANCE, 1500000)->assertCreated();
        $expense(Expense::CATEGORY_OIL_CHANGE, 100000, [ 'mileage' => 20000 ])->assertCreated();
        $this->asOwner()->postJson('/api/expense', [ 'category' => Expense::CATEGORY_INSTALMENT, 'amount' => 1000000, 'spent_at' => time() ])->assertJsonPath('errors.car_id.0', 'expense:instalment:car');
        Contract::factory()->state([ 'status' => Contract::STATUS_CLOSED ])->create([ 'car_id' => $this->car->id, 'daily_price' => 100000, 'starts_at' => time() - 20 * self::DAY, 'ends_at' => time() - 10 * self::DAY ]);

        $money = $this->asOwner()->getJson("/api/car/{$this->car->id}")->assertOk()->json('data.money');
        $this->assertSame(1000000, $money['earned']);
        $this->assertSame(8000000, $money['interest']); // 20 000 + 48 × 1 000 − 60 000 TND
        $this->assertSame([ 'insurance' => 1500000, 'technical_visit' => 0, 'tax' => 0, 'maintenance' => 100000, 'other' => 0, 'fines' => 0, 'commissions' => 0 ], $money['costs']);
        $this->assertSame(1600000, $money['running_total']); // instalments aren't running costs
        $this->assertSame(70600000, $money['total_cost']);
        $this->assertEqualsWithDelta(0.014, $money['payback'], 0.0005);
        $this->assertSame(2, $money['financing']['paid']);
        $this->assertSame(46000000, $money['financing']['remaining']);
        $this->assertSame($this->today()->subMonthsNoOverflow(2)->addMonthsNoOverflow(2)->getTimestamp(), $money['financing']['next_due_at']);
        $this->assertSame(CarbonImmutable::create(2028, 1, 1, 0, 0, 0, Agency::TIMEZONE)->getTimestamp(), $money['fleet_deadline']); // 3 years after first registration

        // Managers see neither what the car cost nor its credit.
        $asManager = $this->actingAsUser($this->manager)->getJson("/api/car/{$this->car->id}")->assertOk();
        $this->assertArrayNotHasKey('money', $asManager->json('data'));
        $this->assertArrayNotHasKey('purchase_price', $asManager->json('data'));

        // The third instalment is due now: it shows for the owner, one tap from being paid.
        $bounds = '?starts_at=' . $this->today()->getTimestamp() . '&ends_at=' . $this->today()->addDay()->getTimestamp();
        $due = $this->asOwner()->getJson("/api/dashboard$bounds")->json('data.instalments_due');
        $this->assertSame([ $this->car->id ], array_column(array_column($due, 'car'), 'id'));
        $this->assertArrayNotHasKey('instalments_due', $this->actingAsUser($this->manager)->getJson("/api/dashboard$bounds")->json('data'));
    }

    public function test_a_car_is_sold_at_the_end_of_its_time_in_the_fleet(): void
    {
        $this->car->update([ 'first_circulation_date' => $this->today()->subYears(3)->addMonths(4)->format('d/m/Y') ]);
        $bounds = '?starts_at=' . $this->today()->getTimestamp() . '&ends_at=' . $this->today()->addDay()->getTimestamp();
        $this->assertSame([ $this->car->id ], array_column(array_column($this->asOwner()->getJson("/api/dashboard$bounds")->json('data.fleet_deadlines'), 'car'), 'id'));
        // The rule may change: with four years, the car isn't due yet.
        $this->asOwner()->putJson('/api/agency', [ 'fleet_max_years' => 4 ])->assertOk();
        $this->assertSame([], $this->asOwner()->getJson("/api/dashboard$bounds")->json('data.fleet_deadlines'));

        $sale = [ 'sale_price' => 25000000, 'buyer_name' => 'Karim Ben Ali', 'buyer_phone' => '+21698123456', 'sale_method' => Payment::METHOD_CASH ];
        $booked = Contract::factory()->create([ 'car_id' => $this->car->id, 'starts_at' => time() + 5 * self::DAY, 'ends_at' => time() + 7 * self::DAY ]);
        $this->asOwner()->postJson("/api/car/{$this->car->id}/sale", $sale)->assertJsonPath('errors.car.0', 'car:sale:busy');
        $this->asOwner()->deleteJson("/api/contract/{$booked->id}")->assertNoContent();
        $this->actingAsUser($this->manager)->postJson("/api/car/{$this->car->id}/sale", $sale)->assertForbidden();
        $this->asOwner()->postJson('/api/income', [ 'car_id' => $this->car->id, 'category' => Income::CATEGORY_INSURANCE_PAYOUT, 'amount' => 3000000 ])->assertCreated();
        $money = $this->asOwner()->postJson("/api/car/{$this->car->id}/sale", $sale)->assertOk()
            ->assertJsonPath('data.status', Car::STATUS_SOLD)->json('data.money');
        $this->assertSame(3000000 + 25000000 - $money['total_cost'] + $money['earned'], $money['result']);

        // Gone from the fleet, the dashboard and booking; kept in the sold list; the cash is in the till.
        $this->assertSame([], $this->asOwner()->getJson('/api/car')->json('data'));
        $this->assertSame([ $this->car->id ], array_column($this->asOwner()->getJson('/api/car?sold=1')->json('data'), 'id'));
        $this->asOwner()->getJson("/api/dashboard$bounds")->assertJsonPath('data.cars_total', 0);
        $client = Contract::factory()->create()->client;
        $this->asOwner()->postJson('/api/contract', [ 'client_id' => $client->id, 'contracts' => [ [ 'car_id' => $this->car->id, 'starts_at' => time() + self::DAY, 'ends_at' => time() + 2 * self::DAY ] ] ])
            ->assertStatus(422);
        $lines = $this->asOwner()->getJson('/api/cashbook?date=' . $this->today()->format('Y-m-d'))->json('data.lines');
        $this->assertEqualsCanonicalizing([ 'income' => 3000000, 'car_sale' => 25000000 ], collect($lines)->pluck('amount', 'kind')->all());

        // A sale recorded by mistake is undone.
        $this->asOwner()->deleteJson("/api/car/{$this->car->id}/sale")->assertOk()->assertJsonPath('data.status', Car::STATUS_AVAILABLE)->assertJsonPath('data.sold_at', null);
    }

    public function test_payroll_is_the_owners_and_lands_in_the_cash_book(): void
    {
        $this->actingAsUser($this->manager)->getJson('/api/employee')->assertForbidden();
        $this->actingAsUser($this->manager)->postJson('/api/employee', [ 'first_name' => 'Sami', 'monthly_salary' => 900000 ])->assertForbidden();

        // A staff account is on the payroll list by itself; a washer has no login.
        $this->asOwner()->postJson('/api/user', [ 'first_name' => 'Nour', 'last_name' => 'Ayari', 'phone' => '+21622333444', 'password' => 'secret123', 'role' => User::ROLE_MANAGER ])->assertCreated();
        $washer = $this->asOwner()->postJson('/api/employee', [ 'first_name' => 'Sami', 'role_label' => 'Lavage', 'monthly_salary' => 900000 ])->assertCreated()->json('data.id');
        $this->assertCount(2, $this->asOwner()->getJson('/api/employee')->json('data'));

        // An advance in cash mid-month, the rest by transfer at the end: nothing left to pay.
        $this->asOwner()->postJson("/api/employee/$washer/payment", [ 'type' => SalaryPayment::TYPE_ADVANCE, 'amount' => 300000, 'method' => Payment::METHOD_CASH ])->assertCreated();
        $employee = collect($this->asOwner()->getJson('/api/employee')->json('data'))->firstWhere('id', $washer);
        $this->assertSame(600000, $employee['due_this_month']);
        $this->asOwner()->postJson("/api/employee/$washer/payment", [ 'type' => SalaryPayment::TYPE_SALARY, 'amount' => 600000, 'method' => Payment::METHOD_TRANSFER ])->assertCreated();
        $this->asOwner()->getJson("/api/employee/$washer")->assertJsonPath('data.due_this_month', 0)->assertJsonPath('data.paid_this_month', 900000)->assertJsonPath('data.year_total', 900000);

        $lines = $this->asOwner()->getJson('/api/cashbook?date=' . $this->today()->format('Y-m-d'))->json('data.lines');
        $this->assertSame([ [ 'kind' => 'salary', 'amount' => -300000 ] ], collect($lines)->map(fn ($line) => [ 'kind' => $line['kind'], 'amount' => $line['amount'] ])->all());
    }

    public function test_overhead_branches_and_recurring_bills(): void
    {
        $this->actingAsUser($this->manager)->getJson('/api/branch')->assertForbidden();
        $center = $this->asOwner()->postJson('/api/branch', [ 'name' => "M'saken centre", 'monthly_rent' => 800000 ])->assertCreated()->json('data.id');
        $airport = $this->asOwner()->postJson('/api/branch', [ 'name' => 'Aéroport Monastir', 'monthly_rent' => 1200000 ])->assertCreated()->json('data.id');
        $employee = $this->asOwner()->postJson('/api/employee', [ 'first_name' => 'Sami', 'monthly_salary' => 900000 ])->json('data.id');

        $expense = fn (array $data) => $this->asOwner()->postJson('/api/expense', [ 'spent_at' => time(), ...$data ]);
        $expense([ 'category' => Expense::CATEGORY_RENT, 'amount' => 800000, 'branch_id' => $center ])->assertCreated()->assertJsonPath('data.branch.id', $center);
        $expense([ 'category' => Expense::CATEGORY_PHONE, 'amount' => 20000, 'employee_id' => $employee ])->assertCreated()->assertJsonPath('data.employee.first_name', 'Sami');
        $expense([ 'category' => Expense::CATEGORY_RENT, 'amount' => 800000, 'car_id' => $this->car->id ])->assertJsonPath('errors.car_id.0', 'expense:agency:no_car');
        $this->assertCount(2, $this->asOwner()->getJson('/api/expense?group=agency')->json('data'));

        // A car has a home branch (the agency's own only).
        $car = $this->asOwner()->getJson("/api/car/{$this->car->id}")->json('data');
        $input = collect($car)->only([ 'daily_price', 'licence_plate', 'serial_number', 'manufacturer', 'model_name', 'model_year', 'fiscal_horse_power', 'number_of_cylinders', 'transmission_type', 'fuel_type', 'type', 'first_circulation_date', 'circulation_tax_ends_at', 'insurance_ends_at', 'technical_control_ends_at' ])->all();
        $this->asOwner()->putJson("/api/car/{$this->car->id}", [ ...$input, 'branch_id' => $airport ])->assertOk()->assertJsonPath('data.branch_id', $airport);
        $foreign = \App\Models\Branch::forceCreate([ 'name' => 'x', 'agency_id' => Car::factory()->create()->agency_id ]);
        $this->asOwner()->putJson("/api/car/{$this->car->id}", [ ...$input, 'branch_id' => $foreign->id ])->assertJsonValidationErrors('branch_id');

        // Internet, due today: on the dashboard until paid, then a month later.
        $bill = $this->asOwner()->postJson('/api/recurring-bill', [ 'category' => Expense::CATEGORY_INTERNET, 'amount' => 60000, 'every_months' => 1, 'next_due_at' => $this->today()->getTimestamp(), 'branch_id' => $airport ])
            ->assertCreated()->json('data.id');
        $this->asOwner()->postJson('/api/recurring-bill', [ 'category' => Expense::CATEGORY_FUEL, 'amount' => 1, 'every_months' => 1, 'next_due_at' => 0 ])->assertJsonValidationErrors('category'); // agency costs only
        $bounds = '?starts_at=' . $this->today()->getTimestamp() . '&ends_at=' . $this->today()->addDay()->getTimestamp();
        $this->assertSame([ $bill ], array_column($this->asOwner()->getJson("/api/dashboard$bounds")->json('data.bills_due'), 'id'));
        $this->asOwner()->postJson("/api/recurring-bill/$bill/pay", [ 'method' => Payment::METHOD_CASH ])->assertCreated()->assertJsonPath('data.category', Expense::CATEGORY_INTERNET)->assertJsonPath('data.branch_id', $airport);
        $this->assertSame([], $this->asOwner()->getJson("/api/dashboard$bounds")->json('data.bills_due'));
        $this->assertSame($this->today()->addMonthNoOverflow()->getTimestamp(), $this->asOwner()->getJson('/api/recurring-bill')->json('data.0.next_due_at'));
    }
}
