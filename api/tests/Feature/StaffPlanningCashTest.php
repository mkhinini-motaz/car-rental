<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Car;
use App\Models\CarBlock;
use App\Models\CashMovement;
use App\Models\Client;
use App\Models\Contract;
use App\Models\ContractPhoto;
use App\Models\Expense;
use App\Models\Fine;
use App\Models\Payment;
use App\Models\User;
use App\Support\Pricing;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class StaffPlanningCashTest extends TestCase
{
    use RefreshDatabase;

    const DAY = 86400;
    const HOUR = 3600;

    private User $owner;
    private User $manager;
    private Car $car;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake();
        $this->owner = User::factory()->create()->refresh();
        $this->manager = User::factory()->create([ 'agency_id' => $this->owner->agency_id, 'role' => User::ROLE_MANAGER ]);
        $this->car = Car::factory()->create([ 'agency_id' => $this->owner->agency_id, 'daily_price' => 100000, 'mileage' => 20000 ]);
    }

    private function contract(array $attributes = []): Contract
    {
        return Contract::factory()->create([ 'car_id' => $this->car->id, 'daily_price' => 100000, 'starts_at' => time() - 3 * self::DAY, 'ends_at' => time() - self::DAY, ...$attributes ]);
    }

    private function pickUp(Contract $contract, User $user, int $deposit = 500000, int $method = Payment::METHOD_CHEQUE)
    {
        return $this->actingAsUser($user)->postJson("/api/contract/{$contract->id}/pickup", [ 'mileage' => 20000, 'deposit' => $deposit, 'deposit_method' => $method ]);
    }

    public function test_the_owner_manages_staff_and_managers_are_kept_out_of_owner_actions(): void
    {
        $this->actingAsUser($this->owner)->postJson('/api/user', [ 'first_name' => 'Nour', 'last_name' => 'Ayari', 'phone' => '+21622333444', 'password' => 'secret123', 'role' => User::ROLE_MANAGER ])
            ->assertCreated()->assertJsonPath('data.role', User::ROLE_MANAGER)->assertJsonPath('data.disabled', false);
        $this->postJson('/api/login', [ 'phone' => '+21622333444', 'password' => 'secret123' ])->assertOk();
        $this->actingAsUser($this->owner)->getJson('/api/user')->assertOk()->assertJsonCount(3, 'data');

        // Disabled: no login, and the token in hand stops working.
        $nour = User::where('phone', '+21622333444')->first();
        $this->actingAsUser($this->owner)->putJson("/api/user/{$nour->id}", [ 'disabled' => true ])->assertOk()->assertJsonPath('data.disabled', true);
        $this->postJson('/api/login', [ 'phone' => '+21622333444', 'password' => 'secret123' ])->assertUnauthorized();
        $this->actingAsUser($nour)->getJson('/api/me')->assertUnauthorized();
        $this->actingAsUser($this->owner)->getJson('/api/user')->assertJsonCount(3, 'data');
        $this->actingAsUser($this->owner)->putJson("/api/user/{$nour->id}", [ 'disabled' => false, 'password' => 'secret234' ])->assertOk();
        $this->postJson('/api/login', [ 'phone' => '+21622333444', 'password' => 'secret234' ])->assertOk();

        // The owner can't lock themselves out.
        $this->actingAsUser($this->owner)->putJson("/api/user/{$this->owner->id}", [ 'role' => User::ROLE_MANAGER ])->assertJsonPath('errors.role', [ 'user:self' ]);
        $this->actingAsUser($this->owner)->putJson("/api/user/{$this->owner->id}", [ 'disabled' => true ])->assertJsonPath('errors.role', [ 'user:self' ]);

        // Another agency's staff is a 404.
        $stranger = User::factory()->create();
        $this->actingAsUser($this->owner)->putJson("/api/user/{$stranger->id}", [ 'first_name' => 'x' ])->assertNotFound();

        $contract = $this->contract([ 'starts_at' => time() + self::DAY, 'ends_at' => time() + 2 * self::DAY ]);
        $manager = $this->actingAsUser($this->manager);
        $manager->getJson('/api/user')->assertForbidden();
        $manager->putJson('/api/agency/pricing', [ 'seasons' => [], 'discounts' => [], 'extras' => [] ])->assertForbidden();
        $manager->putJson("/api/car/{$this->car->id}", [ 'daily_price' => 1 ])->assertForbidden();
        $manager->getJson('/api/report?year=2026&month=1')->assertForbidden();
        $manager->getJson('/api/cashbook?date=2026-01-01')->assertForbidden();
        $manager->deleteJson("/api/contract/{$contract->id}")->assertForbidden();
        // What managers do all day still works.
        $manager->getJson('/api/agency/pricing')->assertOk();
        $manager->putJson("/api/contract/{$contract->id}", [ 'daily_price' => 90000 ])->assertOk();
    }

    public function test_managers_close_contracts_but_only_the_owner_keeps_deposit_or_removes_payments(): void
    {
        $contract = $this->contract();
        $this->pickUp($contract, $this->manager)->assertOk();
        $this->actingAsUser($this->manager)->postJson("/api/contract/{$contract->id}/return", [ 'mileage' => 20300 ])->assertOk();
        $payment = $this->actingAsUser($this->manager)->postJson("/api/contract/{$contract->id}/payment", [ 'amount' => 200000, 'method' => Payment::METHOD_CASH ])->json('data');

        $this->actingAsUser($this->manager)->deleteJson("/api/contract/{$contract->id}/payment/{$payment['id']}")->assertForbidden();
        $this->actingAsUser($this->manager)->postJson("/api/contract/{$contract->id}/close", [ 'deposit_kept' => 50000, 'deposit_kept_reason' => 'Fuel' ])->assertForbidden();
        $this->actingAsUser($this->manager)->postJson("/api/contract/{$contract->id}/close", [ 'deposit_kept' => 0 ])
            ->assertOk()->assertJsonPath('data.deposit_returned', 500000);
    }

    public function test_the_activity_log_records_who_did_what(): void
    {
        $client = Client::factory()->create([ 'agency_id' => $this->owner->agency_id, 'first_name' => 'Amira', 'last_name' => 'Trabelsi' ]);
        $contract = $this->actingAsUser($this->manager)->postJson('/api/contract', [
            'client_id' => $client->id,
            'contracts' => [ [ 'car_id' => $this->car->id, 'starts_at' => time() + self::DAY, 'ends_at' => time() + 3 * self::DAY, 'daily_price' => 100000 ] ],
        ])->assertCreated()->json('data.0');

        $other = Client::factory()->create([ 'agency_id' => $this->owner->agency_id, 'first_name' => 'Karim', 'last_name' => 'Gharbi' ]);
        $this->actingAsUser($this->owner)->putJson("/api/contract/{$contract['id']}", [ 'daily_price' => 80000, 'client_id' => $other->id, 'note' => null ])->assertOk();
        $this->actingAsUser($this->owner)->putJson("/api/contract/{$contract['id']}", [ 'daily_price' => 80000 ])->assertOk(); // nothing changed, nothing logged
        $payment = $this->actingAsUser($this->manager)->postJson("/api/contract/{$contract['id']}/payment", [ 'amount' => 50000, 'method' => Payment::METHOD_CARD ])->json('data');
        $this->actingAsUser($this->owner)->deleteJson("/api/contract/{$contract['id']}/payment/{$payment['id']}")->assertNoContent();

        $activities = $this->actingAsUser($this->owner)->getJson("/api/contract/{$contract['id']}")->json('data.activities');
        $this->assertSame([ 'payment_removed', 'payment_added', 'updated', 'created' ], array_column($activities, 'action'));
        $this->assertSame($this->manager->first_name, $activities[3]['user']['first_name']);
        $this->assertSame([ 'daily_price' => [ 100000, 80000 ], 'client' => [ 'Amira Trabelsi', 'Karim Gharbi' ] ], $activities[2]['changes']);
        $this->assertSame([ 'amount' => 50000, 'method' => Payment::METHOD_CARD ], $activities[0]['changes']);
    }

    public function test_flagged_clients_are_recognised_by_phone_id_or_licence(): void
    {
        $bad = Client::factory()->create([ 'agency_id' => $this->owner->agency_id, 'id_number' => '01234567', 'driver_licence_number' => '12/345678' ]);
        $this->actingAsUser($this->owner)->putJson("/api/client/{$bad->id}", [ 'first_name' => $bad->first_name, 'last_name' => $bad->last_name, 'phone' => $bad->phone, 'flag' => Client::FLAG_DAMAGE, 'notes' => 'Scratched the whole side' ])
            ->assertOk()->assertJsonPath('data.flag', Client::FLAG_DAMAGE)->assertJsonPath('data.warnings.0.matched_on', [ 'self' ]);

        // Back with a new phone and the same ID card.
        $again = $this->actingAsUser($this->owner)->postJson('/api/client', [ 'first_name' => 'Same', 'last_name' => 'Person', 'phone' => '+21629000111', 'id_number' => '01234567' ])
            ->assertCreated()->assertJsonPath('data.warnings.0.id', $bad->id)->assertJsonPath('data.warnings.0.matched_on', [ 'id_number' ])
            ->assertJsonPath('data.warnings.0.notes', 'Scratched the whole side')->json('data');
        $this->actingAsUser($this->owner)->getJson("/api/client/{$again['id']}")->assertJsonCount(1, 'data.warnings');

        $clean = Client::factory()->create([ 'agency_id' => $this->owner->agency_id ]);
        $this->actingAsUser($this->owner)->getJson("/api/client/{$clean->id}")->assertJsonCount(0, 'data.warnings');
        // Another agency's flag stays there.
        Client::factory()->create([ 'id_number' => $clean->id_number, 'flag' => Client::FLAG_UNPAID ]);
        $this->actingAsUser($this->owner)->getJson("/api/client/{$clean->id}")->assertJsonCount(0, 'data.warnings');
    }

    public function test_blocks_take_a_car_off_the_planning_and_out_of_bookings(): void
    {
        $day = CarbonImmutable::parse('2026-10-05 00:00', Agency::TIMEZONE)->getTimestamp();
        $contract = $this->contract([ 'starts_at' => $day + self::DAY, 'ends_at' => $day + 3 * self::DAY ]);
        $block = fn (int $from, int $to) => $this->actingAsUser($this->manager)->postJson("/api/car/{$this->car->id}/block", [ 'starts_at' => $from, 'ends_at' => $to, 'reason' => CarBlock::REASON_MAINTENANCE, 'note' => 'Brakes' ]);

        $block($day + 2 * self::DAY, $day + 4 * self::DAY)->assertJsonPath('errors.starts_at', [ 'contract:overlap' ]);
        $blockId = $block($day + 3 * self::DAY, $day + 5 * self::DAY)->assertCreated()->json('data.id');
        $block($day + 4 * self::DAY, $day + 6 * self::DAY)->assertJsonPath('errors.starts_at', [ 'contract:overlap' ]);

        // Reservations can't land on it.
        $this->actingAsUser($this->manager)->postJson('/api/contract', [
            'client_id' => $contract->client_id,
            'contracts' => [ [ 'car_id' => $this->car->id, 'starts_at' => $day + 4 * self::DAY, 'ends_at' => $day + 6 * self::DAY ] ],
        ])->assertJsonPath('errors', [ 'contracts.0' => [ 'contract:overlap' ] ]);

        // The availability search skips it.
        $search = $this->actingAsUser($this->manager)->getJson('/api/car?starts_at=' . $day . '&ends_at=' . ($day + 7 * self::DAY))->json('data.0.availability_in_period');
        $this->assertSame([ [ $day, $day + self::DAY ], [ $day + 5 * self::DAY, $day + 7 * self::DAY ] ], $search);
        $this->actingAsUser($this->manager)->getJson('/api/car?starts_at=' . ($day + 3 * self::DAY) . '&ends_at=' . ($day + 4 * self::DAY))->assertJsonCount(0, 'data');

        $planning = $this->actingAsUser($this->manager)->getJson("/api/planning?starts_at=$day&ends_at=" . ($day + 7 * self::DAY))->assertOk()->json('data.0');
        $this->assertSame($contract->id, $planning['contracts'][0]['id']);
        $this->assertNotNull($planning['contracts'][0]['client']['first_name']);
        $this->assertSame('Brakes', $planning['blocks'][0]['note']);
        $this->actingAsUser($this->manager)->getJson("/api/planning?starts_at=$day&ends_at=" . ($day + 90 * self::DAY))->assertJsonValidationErrors('ends_at');
        // Overdue: still out after its end, it stays on the board.
        $contract->forceFill([ 'status' => Contract::STATUS_OUT ])->save();
        $this->actingAsUser($this->manager)->getJson('/api/planning?starts_at=' . ($day + 10 * self::DAY) . '&ends_at=' . ($day + 17 * self::DAY))
            ->assertJsonPath('data.0.contracts.0.id', $contract->id);

        $this->actingAsUser($this->manager)->deleteJson("/api/car/{$this->car->id}/block/$blockId")->assertNoContent();
        $this->actingAsUser($this->manager)->getJson("/api/planning?starts_at=$day&ends_at=" . ($day + 7 * self::DAY))->assertJsonCount(0, 'data.0.blocks');
    }

    public function test_return_charges_extra_km_lateness_and_damage(): void
    {
        $this->actingAsUser($this->owner)->putJson('/api/agency/pricing', [
            'seasons' => [], 'discounts' => [], 'extras' => [],
            'charge_extra_km' => true, 'km_per_day' => 200, 'extra_km_price' => 250, 'late_grace_hours' => 2, 'late_per' => 'hour', 'late_hour_price' => 10000,
        ])->assertOk()->assertJsonPath('data.late_per', 'hour')->assertJsonPath('data.second_driver_price', 0);

        // Two days booked, due back (just under) 5 hours ago: 400 km allowed.
        $endsAt = time() - 5 * self::HOUR + 60;
        $contract = $this->contract([ 'starts_at' => $endsAt - 2 * self::DAY, 'ends_at' => $endsAt ]);
        $this->pickUp($contract, $this->manager, 100000)->assertOk();

        $this->actingAsUser($this->manager)->getJson("/api/contract/{$contract->id}/charges?mileage=20500")->assertOk()
            ->assertJsonPath('data.charges', [ [ 'type' => 'km', 'quantity' => 100, 'amount' => 25000 ], [ 'type' => 'late', 'unit' => 'hour', 'quantity' => 5, 'amount' => 50000 ] ])
            ->assertJsonPath('data.deposit_available', 100000);

        // Lateness waived, one damage priced, taken from the deposit.
        $this->actingAsUser($this->manager)->postJson("/api/contract/{$contract->id}/return", [
            'mileage' => 20500,
            'waived' => [ 'late' ],
            'charges_from_deposit' => true,
            'damages' => [ [ 'x' => 100, 'y' => 200, 'note' => 'Dent', 'amount' => 120000 ], [ 'x' => 300, 'y' => 200, 'note' => 'Old scratch' ] ],
        ])->assertOk()
            ->assertJsonPath('data.charges', [ [ 'type' => 'km', 'quantity' => 100, 'amount' => 25000 ], [ 'type' => 'damage', 'quantity' => 1, 'amount' => 120000 ] ])
            ->assertJsonPath('data.charges_price', 145000)
            ->assertJsonPath('data.total_price', 345000)
            ->assertJsonPath('data.paid', 100000) // all the deposit there was
            ->assertJsonPath('data.payments.0.method', Payment::METHOD_DEPOSIT)
            ->assertJsonPath('data.deposit_available', 0)
            ->assertJsonPath('data.damages.0.amount', 120000);

        $this->actingAsUser($this->manager)->postJson("/api/contract/{$contract->id}/payment", [ 'amount' => 1000, 'method' => Payment::METHOD_DEPOSIT ])
            ->assertJsonPath('errors.amount', [ 'payment:deposit:unavailable' ]);
        $this->actingAsUser($this->manager)->postJson("/api/contract/{$contract->id}/payment", [ 'amount' => 245000, 'method' => Payment::METHOD_CASH ])->assertCreated();
        $this->actingAsUser($this->owner)->postJson("/api/contract/{$contract->id}/close", [ 'deposit_kept' => 1 ])->assertJsonValidationErrors('deposit_kept');
        $this->actingAsUser($this->manager)->postJson("/api/contract/{$contract->id}/close", [ 'deposit_kept' => 0 ])
            ->assertOk()->assertJsonPath('data.deposit_returned', 0);

        // Kilometres are only charged when the agency switches it on.
        $this->actingAsUser($this->owner)->putJson('/api/agency/pricing', [ 'seasons' => [], 'discounts' => [], 'extras' => [], 'charge_extra_km' => false ])
            ->assertJsonPath('data.charge_extra_km', false)->assertJsonPath('data.km_per_day', 200);
        $this->assertSame([ 'late' ], array_column(Pricing::returnCharges($this->owner->agency->refresh(), $contract, 20500, time()), 'type'));
    }

    public function test_second_driver_and_delivery_places(): void
    {
        $this->actingAsUser($this->owner)->putJson('/api/agency/pricing', [
            'seasons' => [], 'discounts' => [], 'extras' => [],
            'second_driver_price' => 10000, 'locations' => [ [ 'name' => 'Enfidha airport', 'fee' => 40000 ] ],
        ])->assertOk()->assertJsonPath('data.locations.0.fee', 40000);

        $client = Client::factory()->create([ 'agency_id' => $this->owner->agency_id ]);
        $driver = Client::factory()->create([ 'agency_id' => $this->owner->agency_id, 'driver_licence_number' => null ]);
        $request = fn (array $data) => $this->actingAsUser($this->manager)->postJson('/api/contract', [
            'client_id' => $client->id,
            'contracts' => [ [ 'car_id' => $this->car->id, 'starts_at' => time() + self::HOUR, 'ends_at' => time() + self::HOUR + 2 * self::DAY, 'daily_price' => 100000 ] ],
            ...$data,
        ]);
        $request([ 'second_driver_id' => $client->id ])->assertJsonValidationErrors('second_driver_id');
        $contract = $request([
            'second_driver_id' => $driver->id,
            'pickup_location' => 'Enfidha airport',
            'return_location' => null,
            'extras' => [
                [ 'name' => 'Second driver', 'price' => 10000, 'per' => 'day', 'kind' => 'driver' ],
                [ 'name' => 'Delivery: Enfidha airport', 'price' => 40000, 'per' => 'rental', 'kind' => 'pickup' ],
            ],
        ])->assertCreated()->assertJsonPath('data.0.pickup_location', 'Enfidha airport')->assertJsonPath('data.0.total_price', 260000)->json('data.0');

        $this->actingAsUser($this->manager)->getJson("/api/contract/{$contract['id']}")
            ->assertJsonPath('data.second_driver.id', $driver->id)->assertJsonPath('data.extras.1.kind', 'pickup');

        // The insurance needs the second driver's licence.
        $this->actingAsUser($this->manager)->postJson("/api/contract/{$contract['id']}/pickup", [ 'mileage' => 20000 ])->assertJsonPath('errors.second_driver', [ 'client:incomplete' ]);
        $this->actingAsUser($this->manager)->putJson("/api/contract/{$contract['id']}", [ 'second_driver_id' => null ])->assertOk()->assertJsonPath('data.second_driver_id', null);
        $this->actingAsUser($this->manager)->postJson("/api/contract/{$contract['id']}/pickup", [ 'mileage' => 20000 ])->assertOk();

        // The dashboard shows where to go.
        $this->actingAsUser($this->manager)->getJson('/api/dashboard?starts_at=' . (time() - self::DAY) . '&ends_at=' . (time() + 3 * self::DAY))
            ->assertJsonPath('data.returns.0.pickup_location', 'Enfidha airport');
    }

    public function test_the_cash_book_adds_up_the_till(): void
    {
        $today = CarbonImmutable::now(Agency::TIMEZONE)->startOfDay();
        $date = $today->format('Y-m-d');
        $at = fn (int $hour) => $today->setHour($hour)->getTimestamp();
        $agency = $this->owner->agency;
        $agency->forceFill([ 'created_at' => $today->subDays(2)->getTimestamp() ])->save(); // joined the app two days ago
        $agency->cashMovements()->create([ 'type' => CashMovement::TYPE_ADDED, 'amount' => 100000, 'moved_at' => $today->subDays(2)->getTimestamp(), 'user_id' => $this->owner->id ]);
        // A cash expense dated before the agency joined is history, not the till's.
        $agency->expenses()->create([ 'category' => Expense::CATEGORY_WASHING, 'amount' => 70000, 'spent_at' => $today->subDays(3)->getTimestamp(), 'method' => Payment::METHOD_CASH ]);

        // Today: a cash deposit and a cash payment taken by the manager, a card payment, a
        // cash expense, a bank deposit by the owner.
        $contract = $this->contract([ 'starts_at' => $at(1), 'ends_at' => $at(1) + 2 * self::DAY ]);
        $this->pickUp($contract, $this->manager, 300000, Payment::METHOD_CASH)->assertOk();
        $this->actingAsUser($this->manager)->postJson("/api/contract/{$contract->id}/payment", [ 'amount' => 150000, 'method' => Payment::METHOD_CASH, 'paid_at' => $at(9) ])->assertCreated();
        $this->actingAsUser($this->manager)->postJson("/api/contract/{$contract->id}/payment", [ 'amount' => 50000, 'method' => Payment::METHOD_CARD, 'paid_at' => $at(9) ])->assertCreated();
        $this->actingAsUser($this->manager)->postJson('/api/expense', [ 'category' => Expense::CATEGORY_WASHING, 'amount' => 15000, 'spent_at' => $at(10) ])->assertCreated();
        $this->actingAsUser($this->owner)->postJson('/api/expense', [ 'category' => Expense::CATEGORY_TYRES, 'amount' => 400000, 'spent_at' => $at(10), 'method' => Payment::METHOD_TRANSFER ])->assertCreated();
        $this->actingAsUser($this->owner)->postJson('/api/cash-movement', [ 'type' => CashMovement::TYPE_BANK_DEPOSIT, 'amount' => 200000, 'moved_at' => $at(11), 'note' => 'BIAT' ])->assertCreated();
        // Fines: one the client paid in cash comes in, one the agency bore by card stays out of
        // the till, one the client paid the authority directly moves nothing. One the agency paid
        // at the recette in cash and the client repaid in cash goes out and comes back in.
        $fine = fn (int $amount) => $this->actingAsUser($this->owner)->postJson('/api/fine', [ 'car_id' => $this->car->id, 'committed_at' => $at(2), 'amount' => $amount ])->json('data.id');
        $this->actingAsUser($this->owner)->putJson('/api/fine/' . $fine(60000), [ 'status' => Fine::STATUS_PAID_BY_CLIENT ])->assertOk()->assertJsonPath('data.method', Payment::METHOD_CASH);
        $this->actingAsUser($this->owner)->putJson('/api/fine/' . $fine(40000), [ 'status' => Fine::STATUS_PAID_BY_AGENCY, 'paid_out_method' => Payment::METHOD_CARD ])
            ->assertOk()->assertJsonPath('data.paid_out_method', Payment::METHOD_CARD)->assertJsonPath('data.method', null);
        $this->actingAsUser($this->owner)->putJson('/api/fine/' . $fine(30000), [ 'status' => Fine::STATUS_PAID_BY_CLIENT, 'method' => null ])->assertOk()->assertJsonPath('data.method', null);
        $repaid = $fine(25000);
        $this->actingAsUser($this->manager)->postJson("/api/fine/$repaid/payout", [ 'method' => Payment::METHOD_CASH ])->assertOk()->assertJsonPath('data.status', Fine::STATUS_UNPAID);
        $this->actingAsUser($this->manager)->putJson("/api/fine/$repaid", [ 'status' => Fine::STATUS_PAID_BY_CLIENT, 'method' => Payment::METHOD_CASH ])->assertOk();

        $book = $this->actingAsUser($this->owner)->getJson("/api/cashbook?date=$date")->assertOk()->json('data');
        $this->assertSame(100000, $book['opening']);
        $this->assertSame(535000, $book['cash_in']);
        $this->assertSame(240000, $book['cash_out']);
        $this->assertSame(395000, $book['closing']);
        $this->assertEqualsCanonicalizing([ [ 'method' => Payment::METHOD_CASH, 'amount' => 150000 ], [ 'method' => Payment::METHOD_CARD, 'amount' => 50000 ] ], $book['payments_by_method']);
        $this->assertEqualsCanonicalizing([ 'deposit_taken', 'payment', 'expense', 'fine', 'fine', 'fine_payout', 'movement' ], array_column($book['lines'], 'kind'));
        $this->assertSame($this->manager->id, collect($book['lines'])->firstWhere('kind', 'deposit_taken')['user']['id']); // from the contract's history

        $mine = $this->actingAsUser($this->owner)->getJson("/api/cashbook?date=$date&user_id={$this->manager->id}")->json('data');
        $this->assertNull($mine['closing']);
        $this->assertSame(475000, $mine['cash_in']);
        $this->assertSame(40000, $mine['cash_out']);

        // Undoing the payout of a fine the agency bears is refused: undo that first.
        $borne = collect($this->actingAsUser($this->owner)->getJson('/api/fine')->json('data'))->firstWhere('amount', 40000)['id'];
        $this->actingAsUser($this->owner)->deleteJson("/api/fine/$borne/payout")->assertUnprocessable()->assertJsonPath('errors.status.0', 'fine:payout:agency');
        $this->actingAsUser($this->owner)->deleteJson("/api/fine/$repaid/payout")->assertOk()->assertJsonPath('data.paid_out_at', null);
        $this->actingAsUser($this->manager)->postJson("/api/fine/$repaid/payout", [ 'method' => Payment::METHOD_CASH ])->assertOk();

        // A deposit given back in cash goes out; tomorrow opens where today closed.
        $this->actingAsUser($this->manager)->postJson("/api/contract/{$contract->id}/return", [ 'mileage' => 20100 ])->assertOk();
        $this->actingAsUser($this->manager)->postJson("/api/contract/{$contract->id}/close", [ 'deposit_kept' => 0 ])->assertOk();
        $closedToday = $this->actingAsUser($this->owner)->getJson("/api/cashbook?date=$date")->json('data.lines');
        $this->assertSame(-300000, collect($closedToday)->firstWhere('kind', 'deposit_returned')['amount']);
        $this->assertSame(95000, $this->actingAsUser($this->owner)->getJson('/api/cashbook?date=' . $today->addDay()->format('Y-m-d'))->json('data.opening'));

        $movement = collect($closedToday)->firstWhere('kind', 'movement');
        $this->actingAsUser($this->owner)->deleteJson("/api/cash-movement/{$movement['id']}")->assertNoContent();
    }
}
