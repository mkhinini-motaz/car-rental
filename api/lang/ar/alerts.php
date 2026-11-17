<?php

// The daily push notifications (App\Console\Commands\SendDailyAlerts), in the app's five languages.
return [
    'today' => [
        'title' => 'اليوم في الوكالة',
        'body' => 'خروج: :pickups · رجوع: :returns · متأخرة: :overdue',
    ],
    'paper' => [
        'title' => 'وثائق السيارة',
        'ends_in' => ':paper للسيارة :plate تنتهي بعد :days أيام',
        'ends_today' => ':paper للسيارة :plate تنتهي اليوم',
        'insurance' => 'التأمين',
        'circulation_tax' => 'معلوم الجولان',
        'technical_control' => 'الفحص الفني',
    ],
    // Given a pickup or a return (ContractController::notifyAssigned).
    'task' => [
        'title' => 'مهمة جديدة',
        'pickup' => 'تسليم :plate إلى :client، :date',
        'return' => 'استلام :plate من :client، :date',
    ],
];
