<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Staff management, the agency's settings and prices, cars, reports, the cash book, and
        // anything that removes money or keeps a deposit. Managers run the rentals.
        Gate::define('owner', fn (User $user) => $user->isOwner());
    }
}
