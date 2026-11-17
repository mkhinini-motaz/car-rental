<?php

// The daily push notifications (App\Console\Commands\SendDailyAlerts), in the app's five languages.
return [
    'today' => [
        'title' => 'Today at the agency',
        'body' => 'Pickups: :pickups · Returns: :returns · Overdue: :overdue',
    ],
    'paper' => [
        'title' => 'Car papers',
        'ends_in' => ':paper for :plate ends in :days days',
        'ends_today' => ':paper for :plate ends today',
        'insurance' => 'Insurance',
        'circulation_tax' => 'Road tax',
        'technical_control' => 'Technical inspection',
    ],
    // Given a pickup or a return (ContractController::notifyAssigned).
    'task' => [
        'title' => 'New task',
        'pickup' => 'Hand over :plate to :client, :date',
        'return' => 'Take back :plate from :client, :date',
    ],
];
