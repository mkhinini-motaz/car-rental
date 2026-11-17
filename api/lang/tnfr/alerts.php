<?php

// The daily push notifications (App\Console\Commands\SendDailyAlerts), in the app's five languages.
return [
    'today' => [
        'title' => 'Lyoum fil agence',
        'body' => '5rouj: :pickups · Rjou3: :returns · M3atlin: :overdue',
    ],
    'paper' => [
        'title' => 'Wra9 el karhba',
        'ends_in' => ':paper mta3 :plate tofa b3ed :days ayyem',
        'ends_today' => ':paper mta3 :plate tofa lyoum',
        'insurance' => 'Assurance',
        'circulation_tax' => 'Vignette',
        'technical_control' => 'Visite technique',
    ],
    // Given a pickup or a return (ContractController::notifyAssigned).
    'task' => [
        'title' => 'Mission jdida',
        'pickup' => 'Sallem :plate l :client, :date',
        'return' => 'Rajja3 :plate men 3and :client, :date',
    ],
];
