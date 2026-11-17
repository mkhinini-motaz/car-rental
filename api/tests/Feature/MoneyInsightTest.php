<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Car;
use App\Models\Client;
use App\Models\Contract;
use App\Models\Expense;
use App\Models\Fine;
use App\Models\Payment;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MoneyInsightTest extends TestCase
{
    use RefreshDatabase;

    const DAY = 86400;

    private User $user;
    private Car $car;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create()->refresh(); // refresh: the role comes from the column default
        $this->car = Car::factory()->create([ 'agency_id' => $this->user->agency_id, 'daily_price' => 100000, 'mileage' => 20000 ]);
    }

    private function as()
    {
        return $this->actingAsUser($this->user);
    }

    private function tunis(string $date): int
    {
        return CarbonImmutable::parse($date, Agency::TIMEZONE)->getTimestamp();
    }

    public function test_pricing_rules_quote_and_default_the_reservation_price(): void
    {
        $this->as()->putJson('/api/agency/pricing', [ 'seasons' => [ [ 'name' => 'x', 'from' => '32/01', 'to' => '01/02', 'percent' => 10 ] ], 'discounts' => [], 'extras' => [] ])
            ->assertJsonValidationErrors('seasons.0.from');
        $this->as()->putJson('/api/agency/pricing', [
            'seasons' => [ [ 'name' => 'Summer', 'from' => '01/07', 'to' => '31/08', 'percent' => 20 ], [ 'name' => 'New year', 'from' => '20/12', 'to' => '05/01', 'percent' => 50 ] ],
            'discounts' => [ [ 'min_days' => 30, 'percent' => 20 ], [ 'min_days' => 7, 'percent' => 10 ] ],
            'extras' => [ [ 'name' => 'Child seat', 'price' => 5000, 'per' => 'day' ] ],
        ])->assertOk()->assertJsonPath('data.discounts.0.min_days', 7);

        $quote = fn (string $from, int $days) => $this->as()
            ->getJson("/api/car/{$this->car->id}/quote?starts_at={$this->tunis($from)}&ends_at=" . ($this->tunis($from) + $days * self::DAY))->json('data');

        $this->assertSame(100000, $quote('2026-03-10 10:00', 3)['daily_price']); // no rule applies
        $this->assertSame(120000, $quote('2026-07-10 10:00', 3)['daily_price']); // summer
        $this->assertSame(108000, $quote('2026-07-10 10:00', 7)['daily_price']); // summer, a week off
        $this->assertSame(110000, $quote('2026-06-29 10:00', 4)['daily_price']); // two days out of season, two in
        $this->assertSame([ 'New year' ], $quote('2026-12-30 10:00', 10)['seasons']); // runs over the new year
        $this->assertSame(80000, $quote('2026-03-01 10:00', 30)['daily_price']);

        $client = Client::factory()->create([ 'agency_id' => $this->user->agency_id ]);
        $this->as()->postJson('/api/contract', [ 'client_id' => $client->id, 'contracts' => [
            [ 'car_id' => $this->car->id, 'starts_at' => $this->tunis('2026-07-10 10:00'), 'ends_at' => $this->tunis('2026-07-13 10:00') ],
        ] ])->assertCreated()->assertJsonPath('data.0.daily_price', 120000);
    }

    public function test_extras_are_charged_with_the_rent(): void
    {
        $contract = Contract::factory()->create([ 'car_id' => $this->car->id, 'daily_price' => 100000, 'starts_at' => 0, 'ends_at' => 3 * self::DAY ]);

        $this->as()->putJson("/api/contract/{$contract->id}", [ 'extras' => [ [ 'name' => 'Seat', 'price' => 5000, 'per' => 'week' ] ] ])
            ->assertJsonValidationErrors('extras.0.per');
        $this->as()->putJson("/api/contract/{$contract->id}", [ 'extras' => [
            [ 'name' => 'Seat', 'price' => 5000, 'per' => 'day' ],
            [ 'name' => 'Airport', 'price' => 30000, 'per' => 'rental' ],
        ] ])
            ->assertOk()
            ->assertJsonPath('data.rent_price', 300000)
            ->assertJsonPath('data.extras_price', 45000)
            ->assertJsonPath('data.total_price', 345000);
    }

    public function test_expenses_profit_and_oil_change(): void
    {
        $contract = Contract::factory()->create([ 'car_id' => $this->car->id, 'daily_price' => 100000, 'starts_at' => 0, 'ends_at' => 2 * self::DAY ]);
        $contract->status = Contract::STATUS_CLOSED;
        $contract->save();
        Contract::factory()->create([ 'car_id' => $this->car->id, 'starts_at' => time() + self::DAY, 'ends_at' => time() + 3 * self::DAY ]); // booked, not earned
        $foreignCar = Car::factory()->create();

        $this->as()->postJson('/api/expense', [ 'car_id' => $foreignCar->id, 'category' => Expense::CATEGORY_FUEL, 'amount' => 1000, 'spent_at' => time() ])
            ->assertJsonValidationErrors('car_id');
        $this->as()->postJson('/api/expense', [ 'car_id' => $this->car->id, 'category' => Expense::CATEGORY_OIL_CHANGE, 'amount' => 150000, 'spent_at' => time() - 30 * self::DAY, 'mileage' => 10400, 'garage' => 'Garage Sahel' ])
            ->assertCreated();
        $id = $this->as()->postJson('/api/expense', [ 'category' => Expense::CATEGORY_OTHER, 'amount' => 500000, 'spent_at' => time() ])->json('data.id'); // agency-wide
        Fine::forceCreate([ 'agency_id' => $this->user->agency_id, 'car_id' => $this->car->id, 'committed_at' => 5, 'amount' => 20000, 'status' => Fine::STATUS_PAID_BY_AGENCY ]);

        $this->as()->getJson("/api/car/{$this->car->id}")
            ->assertJsonPath('data.revenue', 200000)
            ->assertJsonPath('data.expenses_total', 170000) // the oil change and the fine; agency-wide costs aren't the car's
            ->assertJsonPath('data.profit', 30000)
            ->assertJsonPath('data.oil_change.due_mileage', 20400)
            ->assertJsonPath('data.oil_change.is_due', true) // 20000 km, due at 20400
            ->assertJsonCount(1, 'data.expenses');

        $this->as()->getJson('/api/expense')->assertJsonCount(2, 'data');
        $this->as()->deleteJson("/api/expense/$id")->assertNoContent();
        $this->as()->deleteJson("/api/expense/$id")->assertNotFound();

        $dayStart = strtotime('today');
        $this->as()->getJson('/api/dashboard?starts_at=' . $dayStart . '&ends_at=' . ($dayStart + self::DAY))
            ->assertJsonPath('data.maintenance_due.0.id', $this->car->id);
    }

    public function test_fines_find_the_rental_and_can_come_out_of_the_deposit(): void
    {
        $contract = Contract::factory()->create([ 'car_id' => $this->car->id, 'starts_at' => 1000 * self::DAY, 'ends_at' => 1003 * self::DAY ]);
        $contract->forceFill([ 'status' => Contract::STATUS_RETURNED, 'picked_up_at' => 1000 * self::DAY, 'returned_at' => 1002 * self::DAY, 'deposit' => 100000, 'deposit_method' => Payment::METHOD_CASH ])->save();

        $fine = fn (int $at, int $amount = 60000) => $this->as()->postJson('/api/fine', [ 'car_id' => $this->car->id, 'committed_at' => $at, 'amount' => $amount, 'reference' => 'PV 1' ]);
        $fine(1001 * self::DAY)->assertCreated()->assertJsonPath('data.contract.client.id', $contract->client_id);
        $fine(1002 * self::DAY + 3600)->assertCreated()->assertJsonPath('data.contract_id', null); // returned early: nobody had it
        $id = Fine::first()->id;

        $this->as()->putJson("/api/fine/$id", [ 'status' => Fine::STATUS_FROM_DEPOSIT ])->assertOk()->assertJsonPath('data.status', Fine::STATUS_FROM_DEPOSIT);
        $second = $fine(1001 * self::DAY, 50000)->json('data.id');
        $this->as()->putJson("/api/fine/$second", [ 'status' => Fine::STATUS_FROM_DEPOSIT ])->assertJsonPath('errors.status', [ 'fine:deposit:unavailable' ]); // 110 > 100

        $this->as()->getJson("/api/contract/{$contract->id}")->assertJsonPath('data.fines_from_deposit', 60000);
        $this->as()->postJson("/api/contract/{$contract->id}/payment", [ 'amount' => $contract->totalPrice(), 'method' => Payment::METHOD_CASH ]);
        $this->as()->postJson("/api/contract/{$contract->id}/close", [ 'deposit_kept' => 50000, 'deposit_kept_reason' => 'Fuel' ])->assertJsonValidationErrors('deposit_kept');
        $this->as()->postJson("/api/contract/{$contract->id}/close", [ 'deposit_kept' => 40000, 'deposit_kept_reason' => 'Fuel' ])->assertOk();

        $this->as()->putJson("/api/fine/$id", [ 'status' => Fine::STATUS_UNPAID ])->assertJsonPath('errors.status', [ 'fine:deposit:settled' ]);
        $this->as()->putJson("/api/fine/$second", [ 'status' => Fine::STATUS_PAID_BY_CLIENT ])->assertOk()->assertJsonPath('data.settled_at', fn ($at) => $at > 0);
        $this->as()->getJson('/api/fine?status[]=' . Fine::STATUS_UNPAID)->assertJsonCount(1, 'data');

        $foreign = Fine::forceCreate([ 'agency_id' => Car::factory()->create()->agency_id, 'car_id' => Car::first()->id, 'committed_at' => 1, 'amount' => 1 ]);
        $this->as()->getJson("/api/fine/{$foreign->id}")->assertNotFound();
    }

    public function test_monthly_report_and_export(): void
    {
        // 10 days in September at 100 TND, 5 of them in the month; a car of 30-day September.
        $contract = Contract::factory()->create([ 'car_id' => $this->car->id, 'daily_price' => 100000, 'starts_at' => $this->tunis('2026-09-26 00:00'), 'ends_at' => $this->tunis('2026-10-06 00:00') ]);
        $contract->forceFill([ 'status' => Contract::STATUS_OUT, 'deposit' => 300000 ])->save();
        $contract->payments()->create([ 'amount' => 200000, 'method' => Payment::METHOD_CASH, 'paid_at' => $this->tunis('2026-09-26 10:00') ]);
        $this->user->agency->expenses()->create([ 'category' => Expense::CATEGORY_WASHING, 'amount' => 20000, 'spent_at' => $this->tunis('2026-09-10 10:00') ]);
        $this->car->forceFill([ 'created_at' => $this->tunis('2026-01-01 00:00') ])->save();

        $report = $this->as()->getJson('/api/report?year=2026&month=9')
            ->assertOk()
            ->assertJsonPath('data.revenue', 500000)
            ->assertJsonPath('data.expenses', 20000)
            ->assertJsonPath('data.net', 480000)
            ->assertJsonPath('data.payments_received', 200000)
            ->assertJsonPath('data.utilization.0.days_rented', 5)
            ->assertJsonPath('data.utilization.0.rate', 0.167)
            ->assertJsonPath('data.owed_rent', 800000)
            ->assertJsonPath('data.deposits_held', 300000)
            ->assertJsonPath('data.months.11.month', '2026-09')
            ->assertJsonCount(12, 'data.months');
        $this->as()->getJson('/api/report?year=2026&month=10')->assertJsonPath('data.revenue', 500000);

        $export = $this->get($report->json('data.export_url'))->assertOk()->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString($this->car->licence_plate, $export->getContent());
        $this->get(str_replace('month=9', 'month=8', $report->json('data.export_url')))->assertForbidden();

        $manager = User::factory()->create([ 'agency_id' => $this->user->agency_id, 'role' => User::ROLE_MANAGER ]);
        $this->actingAsUser($manager)->getJson('/api/report?year=2026&month=9')->assertForbidden();
    }

    public function test_photo_links_are_permanent_and_signed(): void
    {
        Storage::fake();
        $this->as()->postJson("/api/car/{$this->car->id}/photo", [ 'photo' => UploadedFile::fake()->image('a.jpg') ])->assertOk();
        $url = $this->as()->getJson("/api/car/{$this->car->id}")->json('data.photo_url');

        $this->assertSame($url, $this->as()->getJson("/api/car/{$this->car->id}")->json('data.photo_url')); // stable, so phones cache it
        $this->travel(400)->days();
        $this->get($url)->assertOk()->assertHeader('Cache-Control', 'immutable, max-age=31536000, private');
        $this->get(str_replace('signature=', 'signature=0', $url))->assertForbidden();
    }

    public function test_a_colour_outside_the_palette_is_a_name(): void
    {
        $car = fn (string $colour) => $this->as()->putJson("/api/car/{$this->car->id}", [ ...$this->car->toArray(), 'colour' => $colour ]);

        $car('Vert pomme')->assertOk()->assertJsonPath('data.colour', 'Vert pomme');
        $car('#12')->assertJsonValidationErrors('colour');
    }
}
