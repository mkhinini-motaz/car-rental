<?php

namespace Tests;

use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Tymon\JWTAuth\Facades\JWTAuth;

abstract class TestCase extends BaseTestCase
{
    protected function actingAsUser(User $user): static
    {
        // The JWT guard and parser keep the first user and token they saw for the rest of the test.
        $this->app['auth']->forgetGuards();
        $this->app['tymon.jwt']->unsetToken();

        return $this->withToken(JWTAuth::fromUser($user));
    }
}
