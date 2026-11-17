<?php

namespace Tests\Feature;

use App\Models\Car;
use App\Models\Expense;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $manager;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create()->refresh();
        $this->manager = User::factory()->create([ 'agency_id' => $this->owner->agency_id, 'role' => User::ROLE_MANAGER, 'phone' => '+21650111222' ]);
    }

    // Requests go out without a token unless one is passed: the guard and parser keep the last one they saw.
    private function withJwt(?string $token): static
    {
        $this->app['auth']->forgetGuards();
        $this->app['tymon.jwt']->unsetToken();
        $this->defaultHeaders = [];

        return $token ? $this->withToken($token) : $this;
    }

    // The code in the SMS that the next call sends (SMS only go to the log for now).
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

    public function test_opening_the_app_swaps_the_token_for_a_fresh_one(): void
    {
        $token = $this->postJson('/api/login', [ 'phone' => '+21650111222', 'password' => 'password' ])->assertOk()->json('data.access_token');
        $fresh = $this->withJwt($token)->postJson('/api/refresh')->assertOk()->assertJsonPath('data.id', $this->manager->id)->json('data.access_token');

        $this->assertNotSame($token, $fresh);
        $this->withJwt($fresh)->getJson('/api/me')->assertOk();
    }

    public function test_a_new_password_logs_out_the_other_devices(): void
    {
        $phone = $this->postJson('/api/login', [ 'phone' => '+21650111222', 'password' => 'password' ])->json('data.access_token');
        $laptop = $this->withJwt(null)->postJson('/api/login', [ 'phone' => '+21650111222', 'password' => 'password' ])->json('data.access_token');

        $kept = $this->withJwt($laptop)->putJson('/api/me', [ 'current_password' => 'password', 'password' => 'newsecret1' ])->assertOk()->json('data.access_token');
        $this->withJwt($phone)->getJson('/api/me')->assertUnauthorized();
        $this->withJwt($kept)->getJson('/api/me')->assertOk();

        // The owner setting a password locks the staff member's devices out too.
        $this->actingAsUser($this->owner)->putJson("/api/user/{$this->manager->id}", [ 'password' => 'fromowner1' ])->assertOk();
        $this->withJwt($kept)->getJson('/api/me')->assertUnauthorized();
    }

    public function test_a_forgotten_password_is_reset_with_a_code_sent_by_sms(): void
    {
        $old = $this->postJson('/api/login', [ 'phone' => '+21650111222', 'password' => 'password' ])->json('data.access_token');

        // Same answer for a phone without an account, and nothing is sent.
        $this->assertNull($this->smsCode(fn () => $this->withJwt(null)->postJson('/api/otp/request', [ 'phone' => '+21699999999' ])->assertNoContent()));
        $code = $this->smsCode(fn () => $this->postJson('/api/otp/request', [ 'phone' => '+21650111222', 'lang' => 'tnfr' ])->assertNoContent());
        $this->assertMatchesRegularExpression('/^\d{6}$/', $code);
        // One SMS a minute per account.
        $this->assertNull($this->smsCode(fn () => $this->postJson('/api/otp/request', [ 'phone' => '+21650111222' ])->assertNoContent()));

        $reset = fn (string $otp, string $password = 'newsecret1') => $this->postJson('/api/password/reset', [ 'phone' => '+21650111222', 'otp' => $otp, 'password' => $password, 'password_confirmation' => $password ]);
        $reset($code, 'short')->assertJsonValidationErrors('password');
        $reset($code === '000000' ? '111111' : '000000')->assertJsonPath('errors.otp.0', 'otp:validation:wrong');
        $token = $reset($code)->assertOk()->json('data.access_token');

        $this->withJwt($token)->getJson('/api/me')->assertOk();
        $this->withJwt($old)->getJson('/api/me')->assertUnauthorized();
        $this->withJwt(null)->postJson('/api/login', [ 'phone' => '+21650111222', 'password' => 'newsecret1' ])->assertOk();
        $reset($code)->assertJsonValidationErrors('otp'); // used once
    }

    public function test_a_code_stops_working_after_five_wrong_guesses(): void
    {
        $code = $this->manager->issuePasswordCode(User::CODE_TTL);
        $wrong = $code === '000000' ? '111111' : '000000';
        foreach (range(1, User::CODE_ATTEMPTS) as $attempt) {
            $this->assertFalse($this->manager->refresh()->usePasswordCode($wrong, 'newsecret1'));
        }
        $this->assertFalse($this->manager->refresh()->usePasswordCode($code, 'newsecret1'));

        $code = $this->manager->issuePasswordCode(User::CODE_TTL);
        $this->manager->forceFill([ 'password_code_expires_at' => time() - 1 ])->save();
        $this->assertFalse($this->manager->refresh()->usePasswordCode($code, 'newsecret1'));
    }

    public function test_the_owner_invites_staff_who_choose_their_own_password(): void
    {
        $response = $this->actingAsUser($this->owner)->postJson('/api/user', [ 'first_name' => 'Nour', 'last_name' => 'Ayari', 'phone' => '+21622333444', 'role' => User::ROLE_MANAGER ])
            ->assertCreated()->assertJsonPath('data.invited', true);
        $code = $response->json('invite_code');
        $this->assertMatchesRegularExpression('/^\d{6}$/', $code);
        $this->withJwt(null)->postJson('/api/login', [ 'phone' => '+21622333444', 'password' => 'anything' ])->assertUnauthorized(); // no password yet

        // A new code replaces the first one; managers can't send any.
        $code = $this->smsCode(fn () => $this->actingAsUser($this->owner)->postJson('/api/user/' . $response->json('data.id') . '/invite')->assertOk());
        $this->actingAsUser($this->manager)->postJson('/api/user/' . $response->json('data.id') . '/invite')->assertForbidden();

        $this->withJwt(null)->postJson('/api/password/reset', [ 'phone' => '+21622333444', 'otp' => $code, 'password' => 'mysecret1', 'password_confirmation' => 'mysecret1' ])
            ->assertOk()->assertJsonPath('data.invited', false)->assertJsonPath('data.role', User::ROLE_MANAGER);
        $this->postJson('/api/login', [ 'phone' => '+21622333444', 'password' => 'mysecret1' ])->assertOk();
    }

    public function test_managers_dont_see_what_cars_earn_or_how_they_are_paid_for(): void
    {
        $car = Car::factory()->create([ 'agency_id' => $this->owner->agency_id ]);
        $expense = fn (int $category, ?int $carId) => $this->owner->agency->expenses()->create([ 'car_id' => $carId, 'category' => $category, 'amount' => 50000, 'spent_at' => time(), 'user_id' => $this->owner->id ]);
        $expense(Expense::CATEGORY_FUEL, $car->id);
        $expense(Expense::CATEGORY_INSTALMENT, $car->id);
        $expense(Expense::CATEGORY_RENT, null);

        $this->actingAsUser($this->owner)->getJson("/api/car/{$car->id}")->assertJsonCount(2, 'data.expenses')->assertJsonStructure([ 'data' => [ 'profit', 'revenue', 'money' ] ]);
        $this->actingAsUser($this->owner)->getJson('/api/expense')->assertJsonCount(3, 'data');

        $this->actingAsUser($this->manager)->getJson("/api/car/{$car->id}")->assertOk()->assertJsonCount(1, 'data.expenses')
            ->assertJsonMissingPath('data.profit')->assertJsonMissingPath('data.revenue')->assertJsonMissingPath('data.money');
        $this->actingAsUser($this->manager)->getJson('/api/expense')->assertJsonCount(1, 'data');
        $this->actingAsUser($this->manager)->postJson('/api/expense', [ 'car_id' => $car->id, 'category' => Expense::CATEGORY_INSTALMENT, 'amount' => 1000, 'spent_at' => time() ])->assertForbidden();
        $this->actingAsUser($this->manager)->postJson('/api/expense', [ 'car_id' => $car->id, 'category' => Expense::CATEGORY_FUEL, 'amount' => 1000, 'spent_at' => time() ])->assertCreated();
    }
}
