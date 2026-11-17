<?php

namespace Tests\Feature;

use App\Models\Car;
use App\Models\Contract;
use App\Models\DeviceToken;
use App\Models\User;
use App\Support\Push;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PushAlertsTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_phone_registers_its_token_and_gets_the_morning_alerts_in_its_language(): void
    {
        $user = User::factory()->create();
        $this->actingAsUser($user)->postJson('/api/device-token', [ 'token' => 'phone-1', 'platform' => 'android', 'lang' => 'fr' ])->assertNoContent();
        // The same phone, signed in by someone else: the token moves.
        $other = User::factory()->create();
        $this->actingAsUser($other)->postJson('/api/device-token', [ 'token' => 'phone-1', 'platform' => 'android', 'lang' => 'fr' ])->assertNoContent();
        $this->assertSame($other->id, DeviceToken::sole()->user_id);
        $this->actingAsUser($user)->postJson('/api/device-token', [ 'token' => 'phone-1', 'platform' => 'android', 'lang' => 'fr' ])->assertNoContent();

        $today = CarbonImmutable::now('Africa/Tunis')->startOfDay();
        $car = Car::factory()->create([
            'agency_id' => $user->agency_id, 'licence_plate' => '200 TN 1234',
            'insurance_ends_at' => $today->addDays(7)->addHours(12)->getTimestamp(), // a week away
            'circulation_tax_ends_at' => $today->addDays(8)->getTimestamp(), // no alert on day 8
            'technical_control_ends_at' => $today->addHours(12)->getTimestamp(), // today
        ]);
        Contract::factory()->create([ 'car_id' => $car->id, 'status' => Contract::STATUS_RESERVED, 'starts_at' => $today->addHours(10)->getTimestamp(), 'ends_at' => $today->addDays(3)->getTimestamp() ]);
        // Another agency's car and phone stay out of it.
        $stranger = User::factory()->create();
        DeviceToken::create([ 'token' => 'phone-2', 'platform' => 'ios', 'user_id' => $stranger->id ]);

        $sent = [];
        $this->app->instance(Push::class, new class($sent) extends Push {
            public function __construct(private array &$sent) {}
            public function send(DeviceToken $device, string $title, string $body, array $data = []): void
            {
                $this->sent[] = [ $device->token, $title, $body, $data ];
            }
        });
        $this->artisan('alerts:daily')->assertSuccessful();

        $this->assertSame([
            [ 'phone-1', "Aujourd'hui à l'agence", 'Départs : 1 · Retours : 0 · En retard : 0', [ 'screen' => 'Today' ] ],
            [ 'phone-1', 'Papiers de voiture', "Assurance de \u{202A}200 TN 1234\u{202C} expire dans 7 jours", [ 'car_id' => $car->id ] ],
            [ 'phone-1', 'Papiers de voiture', "Visite technique de \u{202A}200 TN 1234\u{202C} expire aujourd'hui", [ 'car_id' => $car->id ] ],
        ], $sent);

        // Signing out drops the token, with no session needed.
        $this->deleteJson('/api/device-token/phone-1')->assertNoContent();
        $this->assertSame(1, DeviceToken::count());
    }

    public function test_with_a_service_account_it_sends_through_fcm_and_forgets_dead_tokens(): void
    {
        $key = openssl_pkey_new([ 'private_key_bits' => 2048 ]);
        openssl_pkey_export($key, $privateKey);
        $path = tempnam(sys_get_temp_dir(), 'fcm');
        file_put_contents($path, json_encode([ 'project_id' => 'car-test', 'client_email' => 'push@car-test.iam.gserviceaccount.com', 'private_key' => $privateKey ]));
        config([ 'services.fcm.credentials' => $path ]);
        Http::fake([
            'oauth2.googleapis.com/*' => Http::response([ 'access_token' => 'oauth-token' ]),
            'fcm.googleapis.com/*' => Http::sequence()
                ->push([ 'name' => 'projects/car-test/messages/1' ])
                ->push([ 'error' => [ 'code' => 404, 'details' => [ [ 'errorCode' => 'UNREGISTERED' ] ] ] ], 404),
        ]);
        $user = User::factory()->create();
        $alive = DeviceToken::create([ 'token' => 'alive', 'platform' => 'android', 'user_id' => $user->id ]);
        $dead = DeviceToken::create([ 'token' => 'dead', 'platform' => 'ios', 'user_id' => $user->id ]);

        app(Push::class)->send($alive, 'Title', 'Body', [ 'car_id' => 3 ]);
        app(Push::class)->send($dead, 'Title', 'Body');

        Http::assertSent(fn ($request) => $request->url() === 'https://fcm.googleapis.com/v1/projects/car-test/messages:send'
            && $request->hasHeader('Authorization', 'Bearer oauth-token')
            && $request['message']['token'] === 'alive'
            && $request['message']['data'] === [ 'car_id' => '3' ]);
        $this->assertModelExists($alive);
        $this->assertModelMissing($dead);
        unlink($path);
    }
}
