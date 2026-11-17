<?php

// The daily push notifications (App\Console\Commands\SendDailyAlerts), in the app's five languages.
return [
    'today' => [
        'title' => 'Aujourd\'hui à l\'agence',
        'body' => 'Départs : :pickups · Retours : :returns · En retard : :overdue',
    ],
    'paper' => [
        'title' => 'Papiers de voiture',
        'ends_in' => ':paper de :plate expire dans :days jours',
        'ends_today' => ':paper de :plate expire aujourd\'hui',
        'insurance' => 'Assurance',
        'circulation_tax' => 'Vignette',
        'technical_control' => 'Visite technique',
    ],
    // Given a pickup or a return (ContractController::notifyAssigned).
    'task' => [
        'title' => 'Nouvelle tâche',
        'pickup' => 'Remettre :plate à :client, le :date',
        'return' => 'Récupérer :plate chez :client, le :date',
    ],
];
