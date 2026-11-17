<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;

/**
 * A token carries a fingerprint of the password it was issued under (User::getJWTCustomClaims), so
 * a new password, whether changed, reset or set by the owner, logs out every other device.
 */
class TokenMatchesPassword
{
    public function handle(Request $request, Closure $next)
    {
        if (auth()->payload()->get('pwd') !== $request->user()->passwordFingerprint()) {
            throw new AuthenticationException;
        }

        return $next($request);
    }
}
