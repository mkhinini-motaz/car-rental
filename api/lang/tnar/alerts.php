<?php

// The daily push notifications (App\Console\Commands\SendDailyAlerts), in the app's five languages.
return [
    'today' => [
        'title' => 'اليوم في الوكالة',
        'body' => 'خروج: :pickups · رجوع: :returns · معطلين: :overdue',
    ],
    'paper' => [
        'title' => 'ورق الكرهبة',
        'ends_in' => ':paper متاع :plate توفى بعد :days أيام',
        'ends_today' => ':paper متاع :plate توفى اليوم',
        'insurance' => 'الأسورانس',
        'circulation_tax' => 'الفينيات',
        'technical_control' => 'الفيزيت التقنية',
    ],
    // Given a pickup or a return (ContractController::notifyAssigned).
    'task' => [
        'title' => 'مهمة جديدة',
        'pickup' => 'سلّم :plate لـ :client، :date',
        'return' => 'رجّع :plate من عند :client، :date',
    ],
];
