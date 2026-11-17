<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Needs `* * * * * php artisan schedule:run` in the server's crontab.
Schedule::command('alerts:daily')->dailyAt('08:00')->timezone('Africa/Tunis');
