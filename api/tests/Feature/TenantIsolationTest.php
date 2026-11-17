<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\CarBlock;
use App\Models\ContractDamage;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Routing\Route as RouteInfo;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * An agency never reaches another agency's records. Every route behind sign-in is walked,
 * so a new route is covered without touching this file: another agency's record must answer exactly
 * like a record that doesn't exist, whether it is named in the path, the body or the query.
 */
class TenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    const MISSING = 900000; // no record has this id

    // A valid body for the routes that validate before they look the record up, or it is never reached.
    const BODIES = [
        'POST api/contract/{contractId}/pdf' => [ 'kind' => 'receipt', 'lang' => 'fr' ],
        'POST api/car/{carId}/block' => [ 'starts_at' => 2000000000, 'ends_at' => 2000086400, 'reason' => CarBlock::REASON_OTHER ],
        'PUT api/client/{clientId}' => [ 'first_name' => 'Amine', 'last_name' => 'Ben Salah', 'phone' => '+21622000111' ],
        'PUT api/car/{carId}' => [
            'daily_price' => 95000, 'licence_plate' => '245 تونس 9999', 'serial_number' => 'VF1RJA00999999999', 'manufacturer' => 'Renault',
            'model_name' => 'Clio 5', 'model_year' => 2024, 'fiscal_horse_power' => 5, 'number_of_cylinders' => 3, 'transmission_type' => 1,
            'fuel_type' => 1, 'type' => 1, 'first_circulation_date' => '15/03/2024', 'circulation_tax_ends_at' => 1790000000,
            'insurance_ends_at' => 1790000000, 'technical_control_ends_at' => 1790000000,
        ],
    ];

    private Agency $main;
    private Agency $other;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(); // the seed writes inspection photos and papers
        $this->seed();
        $this->main = User::where('phone', '+21623456109')->firstOrFail()->agency;
        $this->other = User::where('phone', '+21698765432')->firstOrFail()->agency;
        // The second agency has no payroll or branches in the seed; the checks below need one of each.
        $this->other->branches()->create([ 'name' => 'Sahloul' ]);
        $this->other->employees()->create([ 'first_name' => 'Hela', 'last_name' => 'Mansour' ]);
    }

    public function test_another_agencys_record_in_the_path_is_a_404_like_a_missing_one(): void
    {
        $attacker = $this->other->users()->where('role', User::ROLE_OWNER)->firstOrFail();

        foreach ($this->routes() as [ $method, $route ]) {
            $params = $route->parameterNames();
            if (! $params) {
                continue;
            }
            $foreign = $this->uri($route, fn ($param) => $this->recordOf($this->main, $param, $route->uri()));
            $missing = $this->uri($route, fn () => self::MISSING);
            $label = "$method {$route->uri()}";
            $body = self::BODIES[$label] ?? [];

            $response = $this->send($attacker, $method, $foreign, $body);
            $this->assertSame(404, $response->status(), "$label answered {$response->status()} for another agency's record");
            $this->assertSameAnswer($response, $this->send($attacker, $method, $missing, $body), $label);
            $this->assertNoDataOf($this->main, $response, $label);

            // Nested records: the agency's own car, contract or employee with another agency's child.
            if (count($params) > 1) {
                $own = $this->recordOf($this->other, $params[0], $route->uri());
                $response = $this->send($attacker, $method, $this->uri($route, fn ($param) => $param === $params[0] ? $own : $this->recordOf($this->main, $param, $route->uri())), $body);
                $this->assertFalse($response->isSuccessful(), "$label with its own {$params[0]} reached another agency's record");
                $this->assertSameAnswer($response, $this->send($attacker, $method, $this->uri($route, fn ($param) => $param === $params[0] ? $own : self::MISSING), $body), "$label (own {$params[0]})");
            }
        }
    }

    public function test_another_agencys_record_in_the_body_or_query_is_refused_like_a_missing_one(): void
    {
        $attacker = $this->main->users()->where('role', User::ROLE_OWNER)->firstOrFail();
        $clients = $this->other->clients()->orderBy('id')->limit(2)->pluck('id');
        $user = $this->other->users()->value('id');
        $foreign = $this->references(fn (string $param) => $this->recordOf($this->other, $param, ''), $clients, $user);
        $missing = $this->references(fn () => self::MISSING, collect([ self::MISSING + 1, self::MISSING + 2 ]), self::MISSING + 3);

        // Deletes last, though each request is rolled back anyway.
        foreach ($this->routes()->sortBy(fn ($route) => $route[0] === 'DELETE') as [ $method, $route ]) {
            $uri = $this->uri($route, fn ($param) => $this->recordOf($this->main, $param, $route->uri()));
            $label = "$method {$route->uri()}";
            $extra = self::BODIES[$label] ?? [];

            $response = $this->send($attacker, $method, $uri, [ ...$extra, ...$foreign ]);
            $this->assertSameAnswer($response, $this->send($attacker, $method, $uri, [ ...$extra, ...$missing ]), $label);
            $this->assertNoDataOf($this->other, $response, $label);
        }
    }

    /** @return \Illuminate\Support\Collection<int, array{string, RouteInfo}> */
    private function routes()
    {
        return collect(Route::getRoutes()->getRoutes())
            ->filter(fn (RouteInfo $route) => in_array('auth', $route->gatherMiddleware()))
            ->map(fn (RouteInfo $route) => [ $route->methods()[0], $route ])
            ->values();
    }

    /** Every reference a request can carry, as the apps send them. */
    private function references(callable $id, $clients, int $user): array
    {
        return [
            'car_id' => $id('carId'),
            'client_id' => $clients[0],
            'second_driver_id' => $clients[1],
            'contract_id' => $id('contractId'),
            'contracts' => [ [ 'car_id' => $id('carId') ] ],
            'branch_id' => $id('branchId'),
            'employee_id' => $id('employeeId'),
            'payment_id' => $id('paymentId'),
            'user_id' => $user,
            'pickup_user_id' => $user,
            'return_user_id' => $user,
        ];
    }

    /** One of the agency's records a route parameter names; a new parameter fails here until added. */
    private function recordOf(Agency $agency, string $param, string $uri): int
    {
        $cars = $agency->cars()->select('cars.id');
        $query = match ($param) {
            'carId' => $agency->cars(),
            'blockId' => CarBlock::whereIn('car_id', $cars),
            'damageId' => ContractDamage::whereIn('car_id', $cars)->whereNull('repaired_at'),
            'fineId' => $agency->fines(),
            'clientId' => $agency->clients(),
            'documentId' => $agency->documents(),
            'contractId' => $agency->contracts(),
            'paymentId' => str_starts_with($uri, 'api/employee') ? $agency->salaryPayments() : Payment::whereIn('contract_id', $agency->contracts()->select('contracts.id')),
            'userId' => $agency->users(),
            'employeeId' => $agency->employees(),
            'branchId' => $agency->branches(),
            'billId' => $agency->recurringBills(),
            'incomeId' => $agency->incomes(),
            'expenseId' => $agency->expenses(),
            'movementId' => $agency->cashMovements(),
        };
        $id = $query->value($query->getModel()->getQualifiedKeyName());
        $this->assertNotNull($id, "the seed has no $param for {$agency->name}");

        return $id;
    }

    private function uri(RouteInfo $route, callable $id): string
    {
        return '/' . preg_replace_callback('/\{(\w+)\}/', fn ($match) => $id($match[1]), $route->uri());
    }

    /** Each request is rolled back, so the two compared requests see the same data. */
    private function send(User $user, string $method, string $uri, array $data = []): TestResponse
    {
        DB::beginTransaction();
        try {
            $this->actingAsUser($user); // a fresh token: logout and refresh are among the routes
            return $method === 'GET' ? $this->getJson($data ? $uri . '?' . http_build_query($data) : $uri) : $this->json($method, $uri, $data);
        } finally {
            DB::rollBack();
        }
    }

    // Same status, same invalid fields, same count: nothing tells a foreign record from a missing one.
    private function assertSameAnswer(TestResponse $foreign, TestResponse $missing, string $label): void
    {
        $this->assertSame($missing->status(), $foreign->status(), "$label: another agency's record answers differently from a missing one");
        if ($foreign->status() === 422) {
            $this->assertEqualsCanonicalizing(array_keys($missing->json('errors')), array_keys($foreign->json('errors')), "$label: another agency's record passes validation");
        }
        $total = json_decode($foreign->getContent(), true)['total'] ?? null; // lists
        if ($foreign->isSuccessful() && $total !== null) {
            $this->assertSame($missing->json('total'), $total, "$label: the count tells another agency's records");
        }
    }

    private function assertNoDataOf(Agency $agency, TestResponse $response, string $label): void
    {
        $content = $response->getContent();
        $values = [ ...$agency->cars()->pluck('licence_plate'), ...$agency->clients()->pluck('phone') ];
        foreach ($values as $value) {
            $this->assertStringNotContainsString(trim(json_encode($value), '"'), $content, "$label shows another agency's data");
        }
    }
}
