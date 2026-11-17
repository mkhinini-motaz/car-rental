<?php

namespace App\Support;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Text messages through the gateway set in `services.sms` (SMS_DRIVER, SMS_API_KEY, SMS_SENDER).
 * Without one (`log`, the default) messages only go to the log, and the owner hands out
 * invitation codes from Staff. A gateway that fails is logged and never breaks the request.
 */
class Sms
{
    public static function send(string $phone, string $message): void
    {
        $config = config('services.sms');
        $to = ltrim($phone, '+'); // 216XXXXXXXX, as the gateways want it
        $ready = match ($config['driver']) { 'winsms', 'orange' => (bool) $config['key'], 'http' => (bool) $config['url'], default => false };
        if (! $ready) {
            Log::info("SMS to $phone: $message");
            return;
        }

        try {
            $response = match ($config['driver']) {
                'winsms' => self::winsms($to, $message, $config),
                'orange' => self::orange($to, $message, $config),
                'http'   => self::http($to, $message, $config),
            };
            if ($response->failed()) {
                Log::error("SMS to $phone failed ({$config['driver']}): {$response->status()} {$response->body()}");
            }
        } catch (\Throwable $e) {
            Log::error("SMS to $phone failed ({$config['driver']}): {$e->getMessage()}");
        }
    }

    // https://www.winsms.tn: one GET with the API key from the client dashboard.
    private static function winsms(string $to, string $message, array $config): Response
    {
        return Http::timeout(10)->get('https://www.winsmspro.com/sms/sms/api', [
            'action' => 'send-sms', 'api_key' => $config['key'], 'to' => $to, 'from' => $config['sender'], 'sms' => $message, 'response' => 'json',
        ]);
    }

    // Orange Developer, SMS Africa and Middle East: a token from the app's authorization header
    // (kept for its hour), then the message from Tunisia's sender address.
    private static function orange(string $to, string $message, array $config): Response
    {
        $token = Cache::remember('sms:orange-token', 3000, fn () => Http::timeout(10)->asForm()
            ->withHeaders([ 'Authorization' => str_starts_with($config['key'], 'Basic ') ? $config['key'] : 'Basic ' . $config['key'] ])
            ->post('https://api.orange.com/oauth/v3/token', [ 'grant_type' => 'client_credentials' ])
            ->throw()->json('access_token'));

        return Http::timeout(10)->withToken($token)->post('https://api.orange.com/smsmessaging/v1/outbound/tel%3A%2B2160000/requests', [
            'outboundSMSMessageRequest' => array_filter([
                'address' => "tel:+$to",
                'senderAddress' => 'tel:+2160000',
                'senderName' => $config['sender'],
                'outboundSMSTextMessage' => [ 'message' => $message ],
            ]),
        ]);
    }

    // Any other gateway: its URL (GET) or JSON body (POST) with the values filled in.
    private static function http(string $to, string $message, array $config): Response
    {
        $values = [ 'to' => $to, 'message' => $message, 'sender' => (string) $config['sender'], 'key' => (string) $config['key'] ];
        $fill = fn (string $template, callable $escape) => strtr($template, collect($values)->mapWithKeys(fn ($value, $name) => [ '{' . $name . '}' => $escape($value) ])->all());
        $url = $fill($config['url'], 'rawurlencode');

        return $config['body'] ?
            Http::timeout(10)->withBody($fill($config['body'], fn ($value) => substr(json_encode($value, JSON_UNESCAPED_UNICODE), 1, -1)), 'application/json')->post($url) :
            Http::timeout(10)->get($url);
    }

    /**
     * A one-time code: `reset` for a forgotten password, `invite` from the agency (`agency` is
     * its name), `signup` to create an agency. `lang` is the app's language; Tunisian Arabic and
     * French read the Arabic and French texts.
     */
    public static function sendCode(string $phone, string $code, ?string $lang, string $text = 'reset', ?string $agency = null): void
    {
        $lang = [ 'tnar' => 'ar', 'tnfr' => 'fr' ][$lang] ?? $lang;
        $texts = self::TEXTS[$lang] ?? self::TEXTS['fr'];
        self::send($phone, strtr($texts[$text], [ ':code' => $code, ':agency' => $agency ]));
    }

    private const TEXTS = [
        'fr' => [
            'reset'  => ':code est votre code pour choisir un nouveau mot de passe. Il expire dans 10 minutes.',
            'invite' => ':agency vous invite sur son application. Votre code : :code (valable 7 jours). Dans l\'application, touchez « Mot de passe oublié ? ».',
            'signup' => ':code est votre code pour créer votre agence. Il expire dans 10 minutes.',
        ],
        'ar' => [
            'reset'  => ':code هو رمزك لاختيار كلمة سر جديدة. صالح لمدة 10 دقائق.',
            'invite' => ':agency تدعوك إلى تطبيقها. رمزك: :code (صالح 7 أيام). في التطبيق، اضغط على «نسيت كلمة المرور ؟».',
            'signup' => ':code هو رمزك لإنشاء وكالتك. صالح لمدة 10 دقائق.',
        ],
        'en' => [
            'reset'  => ':code is your code to choose a new password. It expires in 10 minutes.',
            'invite' => ':agency invites you to its app. Your code: :code (valid 7 days). In the app, tap "Forgot password ?".',
            'signup' => ':code is your code to create your agency. It expires in 10 minutes.',
        ],
    ];
}
