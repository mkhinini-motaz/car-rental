<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Car;
use App\Models\Expense;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SettingsTest extends TestCase
{
    use RefreshDatabase;

    const DAY = 86400;

    public function test_everyone_edits_their_own_account_and_password(): void
    {
        $owner = User::factory()->create();
        $manager = User::factory()->create([ 'agency_id' => $owner->agency_id, 'role' => User::ROLE_MANAGER, 'phone' => '+21650111222' ]);
        $as = fn () => $this->actingAsUser($manager->refresh()); // a new password needs a new token

        $as()->putJson('/api/me', [ 'first_name' => 'Sami', 'phone' => $owner->phone ])->assertJsonValidationErrors('phone');
        $as()->putJson('/api/me', [ 'first_name' => 'Sami', 'last_name' => 'Trabelsi', 'phone' => '+21650999888' ])
            ->assertOk()->assertJsonPath('data.first_name', 'Sami')->assertJsonPath('data.role', User::ROLE_MANAGER);

        $as()->putJson('/api/me', [ 'password' => 'newsecret1' ])->assertJsonValidationErrors('current_password');
        $as()->putJson('/api/me', [ 'current_password' => 'wrong', 'password' => 'newsecret1' ])->assertJsonPath('errors.current_password.0', 'user:password:wrong');
        $as()->putJson('/api/me', [ 'current_password' => 'password', 'password' => 'short' ])->assertJsonValidationErrors('password');
        $as()->putJson('/api/me', [ 'current_password' => 'password', 'password' => 'newsecret1' ])->assertOk();
        $this->postJson('/api/login', [ 'phone' => '+21650999888', 'password' => 'newsecret1' ])->assertOk();

        // The agency's settings are the owner's.
        $as()->putJson('/api/agency', [ 'expiry_warning_days' => 30 ])->assertForbidden();
    }

    public function test_the_agency_settings_replace_the_hard_coded_warnings(): void
    {
        $owner = User::factory()->create();
        $as = fn () => $this->actingAsUser($owner);
        $later = time() + 60 * self::DAY;
        $car = Car::factory()->create([
            'agency_id' => $owner->agency_id, 'mileage' => 20000, 'oil_change_every_km' => 10000, 'oil_change_every_months' => 12,
            'insurance_ends_at' => time() + 20 * self::DAY, 'circulation_tax_ends_at' => $later, 'technical_control_ends_at' => $later,
        ]);
        // Oil changed 9 200 km ago: due in 800 km.
        $owner->agency->expenses()->create([ 'car_id' => $car->id, 'category' => Expense::CATEGORY_OIL_CHANGE, 'amount' => 90000, 'spent_at' => time() - 30 * self::DAY, 'mileage' => 10800 ]);
        $dashboard = fn () => $as()->getJson('/api/dashboard?starts_at=' . time() . '&ends_at=' . (time() + self::DAY))->json('data');

        $this->assertCount(0, $dashboard()['expiring_cars']); // 20 days away, warned 7 days ahead
        $this->assertCount(0, $dashboard()['maintenance_due']); // 800 km away, warned 500 km ahead

        $as()->putJson('/api/agency', [ 'pickup_time' => '25:00' ])->assertJsonValidationErrors('pickup_time');
        $as()->putJson('/api/agency', [
            'tax_id' => '1234567/A/M/000', 'contract_terms' => 'Le véhicule est rendu avec le plein.', 'pickup_time' => '09:30', 'return_time' => '18:00',
            'expiry_warning_days' => 30, 'oil_warning_km' => 1000, 'oil_warning_days' => 14, 'fleet_max_years' => 4, 'employer_charges_rate' => 1657,
        ])->assertOk()->assertJsonPath('data.pickup_time', '09:30')->assertJsonPath('data.employer_charges_rate', 1657);

        $this->assertCount(1, $dashboard()['expiring_cars']);
        $this->assertCount(1, $dashboard()['maintenance_due']);
        $as()->getJson('/api/agency')->assertJsonPath('data.tax_id', '1234567/A/M/000')->assertJsonPath('data.fleet_max_years', 4);
    }

    public function test_the_owner_picks_the_agency_theme_for_everyone(): void
    {
        $owner = User::factory()->create();
        $manager = User::factory()->create([ 'agency_id' => $owner->agency_id, 'role' => User::ROLE_MANAGER, 'phone' => '+21650111222' ]);

        $this->actingAsUser($owner)->getJson('/api/agency')->assertJsonPath('data.theme', null)->assertJsonPath('data.theme_mode', Agency::THEME_MODE_DEVICE);
        $this->actingAsUser($owner)->putJson('/api/agency', [ 'theme' => 'purple', 'theme_mode' => 4 ])->assertJsonValidationErrors([ 'theme', 'theme_mode' ]);
        $this->actingAsUser($owner)->putJson('/api/agency', [ 'theme' => 'taxi', 'theme_mode' => Agency::THEME_MODE_DARK ])
            ->assertOk()->assertJsonPath('data.theme', 'taxi')->assertJsonPath('data.theme_mode', Agency::THEME_MODE_DARK);

        // The manager sees it and can't change it.
        $this->actingAsUser($manager)->getJson('/api/agency')->assertJsonPath('data.theme', 'taxi');
        $this->actingAsUser($manager)->putJson('/api/agency', [ 'theme' => 'rose' ])->assertForbidden();
        // Back to the default.
        $this->actingAsUser($owner)->putJson('/api/agency', [ 'theme' => null ])->assertOk()->assertJsonPath('data.theme', null);
    }
}
