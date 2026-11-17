<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Car;
use App\Models\Contract;
use App\Models\Expense;
use App\Models\Fine;
use App\Models\User;
use App\Support\Sms;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class StaffBranchSignupTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $manager;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create()->refresh();
        $this->manager = User::factory()->create([ 'agency_id' => $this->owner->agency_id, 'role' => User::ROLE_MANAGER ]);
    }

    private function smsCode(callable $send): ?string
    {
        $code = null;
        Log::listen(function ($message) use (&$code) {
            if (preg_match('/^SMS to \+\d+: .*?\b(\d{6})\b/u', $message->message, $match)) {
                $code = $match[1];
            }
        });
        $send();

        return $code;
    }

    public function test_every_change_to_a_staff_account_is_in_its_history(): void
    {
        $branch = $this->owner->agency->branches()->create([ 'name' => 'Sousse' ]);
        $staff = $this->actingAsUser($this->owner)->postJson('/api/user', [ 'first_name' => 'Nour', 'last_name' => 'Ayari', 'phone' => '+21622333444', 'role' => User::ROLE_MANAGER, 'branch_id' => $branch->id ])
            ->assertCreated()->assertJsonPath('data.branch_id', $branch->id)->json('data.id');

        $update = fn (array $data) => $this->actingAsUser($this->owner)->putJson("/api/user/$staff", $data)->assertOk();
        $update([ 'role' => User::ROLE_OWNER ])->assertJsonPath('data.branch_id', null); // owners see every branch
        $update([ 'role' => User::ROLE_OWNER, 'disabled' => true ]); // same role: only the disabling is logged
        $update([ 'disabled' => false ]);
        $update([ 'password' => 'newsecret1' ]);
        $this->actingAsUser($this->owner)->postJson("/api/user/$staff/invite")->assertOk();

        $history = $this->actingAsUser($this->owner)->getJson("/api/user/$staff/activity")->assertOk()->json('data');
        $this->assertSame([ 'invited', 'password_set', 'enabled', 'disabled', 'updated', 'staff_added' ], array_column($history, 'action'));
        $this->assertSame([ 'role' => [ User::ROLE_MANAGER, User::ROLE_OWNER ], 'branch' => [ 'Sousse', null ] ], $history[4]['changes']);
        $this->assertSame([ 'role' => User::ROLE_MANAGER, 'branch' => 'Sousse' ], $history[5]['changes']);
        $this->assertSame($this->owner->id, $history[0]['user']['id']);
        $this->assertNull($history[1]['changes']); // never the password or the code

        $this->actingAsUser($this->manager)->getJson("/api/user/$staff/activity")->assertForbidden();
        $other = User::factory()->create();
        $this->actingAsUser($other)->getJson("/api/user/$staff/activity")->assertNotFound();
    }

    public function test_a_manager_tied_to_a_branch_works_on_its_cars_only(): void
    {
        $agency = $this->owner->agency;
        [ $sousse, $monastir ] = [ $agency->branches()->create([ 'name' => 'Sousse' ]), $agency->branches()->create([ 'name' => 'Monastir' ]) ];
        $mine = Car::factory()->create([ 'agency_id' => $agency->id, 'branch_id' => $sousse->id ]);
        $theirs = Car::factory()->create([ 'agency_id' => $agency->id, 'branch_id' => $monastir->id ]);
        $shared = Car::factory()->create([ 'agency_id' => $agency->id, 'branch_id' => null ]);
        $myContract = Contract::factory()->create([ 'car_id' => $mine->id ]);
        $theirContract = Contract::factory()->create([ 'car_id' => $theirs->id ]);
        $theirFine = Fine::forceCreate([ 'agency_id' => $agency->id, 'car_id' => $theirs->id, 'amount' => 20000, 'committed_at' => time(), 'status' => Fine::STATUS_UNPAID ]);
        Expense::forceCreate([ 'agency_id' => $agency->id, 'car_id' => $theirs->id, 'category' => Expense::CAR_CATEGORIES[0], 'amount' => 5000, 'spent_at' => time() ]);
        $this->actingAsUser($this->owner)->putJson('/api/user/' . $this->manager->id, [ 'branch_id' => $sousse->id ])->assertOk();

        $manager = $this->actingAsUser($this->manager);
        $this->assertEqualsCanonicalizing([ $mine->id, $shared->id ], array_column($manager->getJson('/api/car')->assertOk()->json('data'), 'id'));
        $manager->getJson("/api/car/{$theirs->id}")->assertNotFound();
        $manager->getJson("/api/contract/{$theirContract->id}")->assertNotFound();
        $manager->getJson("/api/contract/{$myContract->id}")->assertOk();
        $this->assertSame([ $myContract->id ], array_column($manager->getJson('/api/contract')->json('data'), 'id'));
        $manager->getJson("/api/fine/{$theirFine->id}")->assertNotFound();
        $this->assertSame([], $manager->getJson('/api/expense')->json('data'));
        $this->assertSame(2, $manager->getJson('/api/dashboard?starts_at=' . time() . '&ends_at=' . (time() + 86400))->json('data.cars_total'));
        $manager->postJson('/api/contract', [ 'client_id' => $myContract->client_id, 'contracts' => [ [ 'car_id' => $theirs->id, 'starts_at' => time() + 86400 * 30, 'ends_at' => time() + 86400 * 32 ] ] ])
            ->assertNotFound();

        // The owner, and a manager without a branch, see the whole agency.
        $this->assertCount(3, $this->actingAsUser($this->owner)->getJson('/api/car')->json('data'));
        $this->actingAsUser($this->owner)->putJson('/api/user/' . $this->manager->id, [ 'branch_id' => null ])->assertOk();
        $this->assertCount(3, $this->actingAsUser($this->manager)->getJson('/api/car')->json('data'));

        // Deleting a branch frees its managers.
        $this->actingAsUser($this->owner)->putJson('/api/user/' . $this->manager->id, [ 'branch_id' => $sousse->id ])->assertOk();
        $this->actingAsUser($this->owner)->deleteJson("/api/branch/{$sousse->id}")->assertNoContent();
        $this->assertNull($this->manager->refresh()->branch_id);
    }

    public function test_invoice_numbers_run_across_branches(): void
    {
        $agency = $this->owner->agency;
        $sousse = $agency->branches()->create([ 'name' => 'Sousse' ]);
        $theirs = Contract::factory()->create([ 'car_id' => Car::factory()->create([ 'agency_id' => $agency->id, 'branch_id' => $agency->branches()->create([ 'name' => 'Monastir' ])->id ])->id ]);
        $mine = Contract::factory()->create([ 'car_id' => Car::factory()->create([ 'agency_id' => $agency->id, 'branch_id' => $sousse->id ])->id ]);
        $this->manager->forceFill([ 'branch_id' => $sousse->id ])->save();

        $this->actingAsUser($this->owner)->postJson("/api/contract/{$theirs->id}/pdf", [ 'kind' => 'invoice', 'lang' => 'fr' ])->assertOk();
        $this->actingAsUser($this->manager)->postJson("/api/contract/{$mine->id}/pdf", [ 'kind' => 'invoice', 'lang' => 'fr' ])->assertOk();
        $year = date('Y');
        $this->assertSame([ "$year-0001", "$year-0002" ], [ $theirs->refresh()->invoice_number, Contract::withoutGlobalScopes()->find($mine->id)->invoice_number ]);
    }

    public function test_sms_go_through_the_configured_gateway(): void
    {
        Http::fake([
            'api.orange.com/oauth/*' => Http::response([ 'access_token' => 'tok', 'expires_in' => 3600 ]),
            'down.test/*' => Http::response('down', 500),
            '*' => Http::response([ 'ok' => true ]),
        ]);

        config([ 'services.sms' => [ 'driver' => 'winsms', 'key' => 'k1', 'sender' => 'Agence', 'url' => null, 'body' => null ] ]);
        Sms::send('+21650111222', 'Bonjour');
        Http::assertSent(fn (HttpRequest $request) => str_starts_with($request->url(), 'https://www.winsmspro.com/sms/sms/api?')
            && $request['api_key'] === 'k1' && $request['to'] === '21650111222' && $request['from'] === 'Agence' && $request['sms'] === 'Bonjour');

        config([ 'services.sms' => [ 'driver' => 'orange', 'key' => 'Basic abc', 'sender' => 'Agence', 'url' => null, 'body' => null ] ]);
        Sms::send('+21650111222', 'Bonjour');
        Http::assertSent(fn (HttpRequest $request) => $request->url() === 'https://api.orange.com/oauth/v3/token' && $request->header('Authorization')[0] === 'Basic abc');
        Http::assertSent(fn (HttpRequest $request) => $request->url() === 'https://api.orange.com/smsmessaging/v1/outbound/tel%3A%2B2160000/requests'
            && $request->header('Authorization')[0] === 'Bearer tok'
            && $request['outboundSMSMessageRequest']['address'] === 'tel:+21650111222' && $request['outboundSMSMessageRequest']['outboundSMSTextMessage']['message'] === 'Bonjour');

        config([ 'services.sms' => [ 'driver' => 'http', 'key' => 'k2', 'sender' => 'Agence', 'url' => 'https://sms.test/send?key={key}&to={to}', 'body' => '{"text":"{message}","from":"{sender}"}' ] ]);
        Sms::send('+21650111222', 'Code "1" ok');
        Http::assertSent(fn (HttpRequest $request) => $request->url() === 'https://sms.test/send?key=k2&to=21650111222' && $request->method() === 'POST'
            && $request['text'] === 'Code "1" ok' && $request['from'] === 'Agence');

        // A failing gateway is logged, never thrown at the request.
        config([ 'services.sms.url' => 'https://down.test/send?to={to}', 'services.sms.body' => null ]);
        Log::spy();
        Sms::send('+21650111222', 'Bonjour');
        Log::shouldHaveReceived('error')->once();
    }

    public function test_a_new_agency_signs_up_with_a_code_sent_by_sms(): void
    {
        $this->postJson('/api/signup/code', [ 'phone' => $this->owner->phone ])->assertJsonValidationErrors('phone'); // has an account: log in
        $code = $this->smsCode(fn () => $this->postJson('/api/signup/code', [ 'phone' => '+21698111222', 'lang' => 'ar' ])->assertNoContent());
        $this->assertMatchesRegularExpression('/^\d{6}$/', $code);
        $this->assertNull($this->smsCode(fn () => $this->postJson('/api/signup/code', [ 'phone' => '+21698111222' ])->assertNoContent())); // one a minute

        $signup = fn (string $otp) => $this->postJson('/api/signup', [
            'agency_name' => 'Rent Sahel', 'first_name' => 'Sami', 'last_name' => 'Trabelsi', 'phone' => '+21698111222',
            'otp' => $otp, 'password' => 'mysecret1', 'password_confirmation' => 'mysecret1',
        ]);
        $signup($code === '000000' ? '111111' : '000000')->assertJsonPath('errors.otp.0', 'otp:validation:wrong');
        $token = $signup($code)->assertCreated()->assertJsonPath('data.role', User::ROLE_OWNER)->json('data.access_token');

        $agency = Agency::where('name', 'Rent Sahel')->firstOrFail();
        $this->assertNotSame($this->owner->agency_id, $agency->id);
        $this->assertSame(1, $agency->employees()->count());
        $this->assertFalse((bool) $agency->takes_deposit);
        $this->app['auth']->forgetGuards(); // a fresh request: the guard otherwise keeps the new user
        $this->withToken($token)->getJson('/api/me')->assertOk()->assertJsonPath('data.agency_id', $agency->id);
        $signup($code)->assertJsonValidationErrors('phone'); // done once
    }
}
