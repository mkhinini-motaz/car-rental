<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    // Push notifications (App\Support\Push): the path to the Firebase service account's JSON key.
    'fcm' => [
        'credentials' => env('FCM_CREDENTIALS'),
    ],

    // Password and sign-up codes (App\Support\Sms). `driver`: log (no gateway: the log only),
    // winsms, orange or http. `key`: WinSMS's API key, or Orange's authorization header
    // ("Basic ..."). `sender`: the sender name registered with the gateway. For any other
    // gateway, `http` calls `url` (GET) or posts `body` (JSON) with {to} {message} {sender} {key}
    // filled in; {to} is 216XXXXXXXX.
    'sms' => [
        'driver' => env('SMS_DRIVER', 'log'),
        'key'    => env('SMS_API_KEY'),
        'sender' => env('SMS_SENDER'),
        'url'    => env('SMS_URL'),
        'body'   => env('SMS_BODY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
