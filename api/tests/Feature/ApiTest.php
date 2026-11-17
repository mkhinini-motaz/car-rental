<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Car;
use App\Models\Client;
use App\Models\Contract;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_me_and_logout(): void
    {
        $user = User::factory()->create([ 'phone' => '+21611111111', 'password' => 'secret' ]);

        $this->getJson('/api/car')->assertUnauthorized();
        $this->get('/api/car')->assertUnauthorized(); // no Accept header: no redirect to a login page

        $token = $this->postJson('/api/login', [ 'phone' => '+21611111111', 'password' => 'secret' ])
            ->assertOk()
            ->json('data.access_token');

        $this->withToken($token)->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.agency_id', $user->agency_id);

        $this->withToken($token)->postJson('/api/logout')->assertOk();
        $this->withToken($token)->getJson('/api/me')->assertUnauthorized();
    }

    public function test_failed_login_does_not_echo_the_credentials(): void
    {
        User::factory()->create([ 'phone' => '+21611111111', 'password' => 'secret' ]);

        $response = $this->postJson('/api/login', [ 'phone' => '+21611111111', 'password' => 'wrong-password' ]);

        $response->assertUnauthorized()->assertExactJson([ 'error' => 'Unauthorized' ]);
        $this->assertStringNotContainsString('wrong-password', $response->getContent());

        $this->postJson('/api/login', [ 'phone' => '+21611111111' ])->assertUnprocessable();
    }

    public function test_login_is_throttled(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/login', [ 'phone' => '+21611111111', 'password' => 'x' ])->assertUnauthorized();
        }

        $this->postJson('/api/login', [ 'phone' => '+21611111111', 'password' => 'x' ])->assertTooManyRequests();
    }

    public function test_users_only_see_their_own_agency(): void
    {
        $user = User::factory()->create();
        $ownCar = Car::factory()->create([ 'agency_id' => $user->agency_id ]);
        $otherCar = Car::factory()->create();
        Contract::factory()->create([ 'car_id' => $ownCar->id ]);
        Contract::factory()->create([ 'car_id' => $otherCar->id ]);

        $this->actingAsUser($user)->getJson('/api/car')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $ownCar->id)
            ->assertJsonPath('data.0.agency_id', $user->agency_id);

        $this->actingAsUser($user)->getJson("/api/car/{$ownCar->id}")->assertOk();
        $this->actingAsUser($user)->getJson("/api/car/{$otherCar->id}")->assertNotFound();

        $this->actingAsUser($user)->getJson('/api/contract')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.car.id', $ownCar->id);
    }

    public function test_contract_search_by_client_name(): void
    {
        $user = User::factory()->create();
        $car = Car::factory()->create([ 'agency_id' => $user->agency_id ]);
        $client = Client::factory()->create([ 'agency_id' => $user->agency_id, 'first_name' => 'Amira', 'last_name' => "O'Neil" ]);
        Contract::factory()->create([ 'car_id' => $car->id, 'client_id' => $client->id ]);
        Contract::factory()->create([ 'car_id' => $car->id ]);

        $this->actingAsUser($user)->getJson('/api/contract?search=' . urlencode("amira o'neil"))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.client.id', $client->id);

        // Used to be interpolated into raw SQL.
        $this->actingAsUser($user)->getJson('/api/contract?search=' . urlencode("' OR 1=1 --"))
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_list_parameters_are_validated(): void
    {
        $user = User::factory()->create();

        foreach ([ 'orderBy=password', 'orderDirection=sideways', 'perPage=1000', 'starts_at=1000', 'starts_at=2000&ends_at=1000' ] as $query) {
            $this->actingAsUser($user)->getJson("/api/car?$query")->assertUnprocessable();
            $this->actingAsUser($user)->getJson("/api/contract?$query")->assertUnprocessable();
        }

        $this->actingAsUser($user)->getJson('/api/car?orderBy=daily_price&orderDirection=asc&perPage=100')->assertOk();
    }

    public function test_car_availability_in_period(): void
    {
        $user = User::factory()->create();
        $car = Car::factory()->create([ 'agency_id' => $user->agency_id ]);
        $at = fn (string $date) => strtotime("$date 18:00:00");
        Contract::factory()->create([ 'car_id' => $car->id, 'starts_at' => $at('10-07-2025'), 'ends_at' => $at('15-07-2025') ]);
        Contract::factory()->create([ 'car_id' => $car->id, 'starts_at' => $at('20-06-2025'), 'ends_at' => $at('01-07-2025') ]);
        $start = $at('01-07-2025');
        $end = $at('20-07-2025');

        $this->actingAsUser($user)->getJson("/api/car?starts_at=$start&ends_at=$end")
            ->assertOk()
            ->assertJsonPath('data.0.availability_in_period', [
                [ $start, $at('10-07-2025') ],
                [ $at('15-07-2025'), $end ],
            ]);
    }

    public function test_availability_does_not_depend_on_contract_order(): void
    {
        $car = new Car();
        $car->setRelation('contracts', collect([
            (new Contract())->forceFill([ 'starts_at' => 300, 'ends_at' => 400 ]),
            (new Contract())->forceFill([ 'starts_at' => 100, 'ends_at' => 200 ]),
        ]));

        $this->assertSame([ [ 0, 100 ], [ 200, 300 ], [ 400, 500 ] ], $car->availabilityInPeriod(0, 500));
    }

    public function test_seeded_demo_data(): void
    {
        Storage::fake(); // the inspection photos and papers
        $this->seed();

        $token = $this->postJson('/api/login', [ 'phone' => '+21623456109', 'password' => 'azerty' ])
            ->assertOk()
            ->json('data.access_token');
        $now = time();

        $this->withToken($token)->getJson('/api/car')->assertOk()->assertJsonPath('total', 9);
        $rentedNow = $this->withToken($token)->getJson('/api/contract?starts_at=' . $now . '&ends_at=' . ($now + 1))
            ->assertOk()
            ->json('total');
        $this->assertGreaterThan(0, $rentedNow);
        $this->assertSame(2, Agency::count());

        // The airport manager sees the airport's three cars and the one in no branch.
        $this->actingAsUser(User::where('phone', '+21655667788')->first());
        $this->getJson('/api/car')->assertOk()->assertJsonPath('total', 4);
    }
}
