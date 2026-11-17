<?php

namespace App\Http\Controllers;

use App\Models\DeviceToken;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The phone's push token, sent after sign-in and whenever Firebase renews it.
 */
class DeviceTokenController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'token' => 'required|string|max:255',
            'platform' => [ 'required', Rule::in([ 'android', 'ios' ]) ],
            'lang' => [ 'sometimes', Rule::in(DeviceToken::LANGS) ],
        ]);
        // The phone may have changed hands: the token follows whoever signed in last.
        DeviceToken::updateOrCreate([ 'token' => $data['token'] ], [ ...$data, 'user_id' => $request->user()->id ]);

        return response()->noContent();
    }

    /**
     * On sign-out, when the session is already gone: knowing the token is enough to stop it.
     */
    public function destroy(string $token)
    {
        DeviceToken::where('token', $token)->delete();

        return response()->noContent();
    }
}
