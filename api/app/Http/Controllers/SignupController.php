<?php

namespace App\Http\Controllers;

use App\Http\Resources\UserResource;
use App\Models\Agency;
use App\Models\User;
use App\Support\Sms;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * A new agency signs itself up: a code by SMS proves the phone, then the agency and its first
 * owner are created with the default settings (deposit, second driver, VAT... all off) and the
 * owner is logged in. The code lives in the cache, like a password code: hashed, 10 minutes,
 * five guesses.
 */
class SignupController extends Controller
{
    public function requestCode(Request $request)
    {
        $data = $request->validate([
            'phone' => [ 'required', 'string', 'regex:/^\+216[234579]\d{7}$/', 'unique:users,phone' ], // taken: log in instead
            'lang'  => 'nullable|string|max:5',
        ]);
        RateLimiter::attempt('signup-code:' . $data['phone'], 1, function () use ($data) {
            $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            Cache::put($this->key($data['phone']), [ 'hash' => Hash::make($code), 'attempts' => 0, 'expires_at' => time() + User::CODE_TTL ], User::CODE_TTL);
            Sms::sendCode($data['phone'], $code, $data['lang'] ?? null, 'signup');
        });

        return response()->noContent();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'agency_name' => 'required|string|max:255',
            'first_name'  => 'required|string|max:255',
            'last_name'   => 'required|string|max:255',
            'phone'       => [ 'required', 'string', 'regex:/^\+216[234579]\d{7}$/', 'unique:users,phone' ],
            'otp'         => 'required|string',
            'password'    => 'required|string|min:8|max:100|confirmed',
        ]);
        if (! $this->useCode($data['phone'], $data['otp'])) {
            throw ValidationException::withMessages([ 'otp' => 'otp:validation:wrong' ]);
        }

        $user = DB::transaction(function () use ($data) {
            $agency = Agency::create([ 'name' => $data['agency_name'], 'phone' => $data['phone'] ]);
            $user = $agency->users()->create([ ...collect($data)->only([ 'first_name', 'last_name', 'phone', 'password' ])->all(), 'role' => User::ROLE_OWNER ]);
            // Everyone who works at the agency is on the payroll list, as for staff added by an owner.
            $agency->employees()->create([ 'first_name' => $user->first_name, 'last_name' => $user->last_name, 'phone' => $user->phone, 'user_id' => $user->id ]);

            return $user;
        })->refresh(); // with its defaults (deleted_at...) for the resource
        $user->access_token = auth()->login($user);

        return (new UserResource($user))->response()->setStatusCode(201);
    }

    private function useCode(string $phone, string $code): bool
    {
        $entry = Cache::get($this->key($phone));
        if (! $entry || $entry['attempts'] >= User::CODE_ATTEMPTS) {
            return false;
        }
        if (! Hash::check($code, $entry['hash'])) {
            Cache::put($this->key($phone), [ ...$entry, 'attempts' => $entry['attempts'] + 1 ], max(1, $entry['expires_at'] - time()));
            return false;
        }
        Cache::forget($this->key($phone));

        return true;
    }

    private function key(string $phone): string
    {
        return 'signup-otp:' . $phone; // not the rate limiter's key
    }
}
