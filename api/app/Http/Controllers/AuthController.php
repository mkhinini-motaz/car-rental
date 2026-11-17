<?php

namespace App\Http\Controllers;

use App\Http\Resources\UserResource;
use App\Models\User;
use App\Support\Sms;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'phone'    => 'required|string',
            'password' => 'required|string',
        ]);

        if (! $token = auth()->attempt($credentials)) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $user = auth()->user();
        $user->access_token = $token;
        return new UserResource($user);
    }

    public function me(Request $request)
    {
        return new UserResource($request->user());
    }

    /**
     * The apps call this on start instead of `me` and keep the fresh 30-day token, so staff who
     * open the app at least once a month stay logged in. The old token isn't blacklisted, so
     * requests already on their way don't fail; it runs out on its own, and a new password ends it.
     */
    public function refresh(Request $request)
    {
        $user = $request->user();
        $user->access_token = auth()->login($user);

        return new UserResource($user);
    }

    /**
     * Sends a password code by SMS. The answer is the same whether the phone has an account or
     * not, and a phone gets at most one SMS a minute.
     */
    public function requestCode(Request $request)
    {
        $data = $request->validate([
            'phone' => 'required|string',
            'lang'  => 'nullable|string|max:5',
        ]);
        $user = User::where('phone', $data['phone'])->first();
        if ($user) {
            RateLimiter::attempt('password-code:' . $user->id, 1, fn () => Sms::sendCode($user->phone, $user->issuePasswordCode(User::CODE_TTL), $data['lang'] ?? null));
        }

        return response()->noContent();
    }

    /**
     * Sets a new password with a code from requestCode or from the owner's invitation, and logs in.
     */
    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'phone'    => 'required|string',
            'otp'      => 'required|string',
            'password' => 'required|string|min:8|max:100|confirmed',
        ]);
        $user = User::where('phone', $data['phone'])->first();
        if (! $user?->usePasswordCode($data['otp'], $data['password'])) {
            throw ValidationException::withMessages([ 'otp' => 'otp:validation:wrong' ]);
        }
        $user->access_token = auth()->login($user);

        return new UserResource($user);
    }

    /**
     * Every user edits their own name and phone, and changes their password with the current one.
     */
    public function updateMe(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'first_name'       => 'sometimes|required|string|max:255',
            'last_name'        => 'sometimes|required|string|max:255',
            'phone'            => [ 'sometimes', 'required', 'string', 'regex:/^\+216[234579]\d{7}$/', Rule::unique('users')->ignore($user->id) ],
            'current_password' => 'required_with:password|string',
            'password'         => 'sometimes|required|string|min:8|max:100',
        ]);
        if (isset($data['password']) && ! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages([ 'current_password' => 'user:password:wrong' ]);
        }

        $user->fill(collect($data)->except('current_password')->all())->save();
        if (isset($data['password'])) {
            $user->access_token = auth()->login($user); // the old token no longer matches the password
        }

        return new UserResource($user);
    }

    public function logout()
    {
        auth()->logout();

        return response()->json(['message' => 'Successfully logged out']);
    }
}
