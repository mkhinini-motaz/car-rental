<?php

namespace App\Support;

use App\Models\DeviceToken;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Push notifications through Firebase Cloud Messaging (HTTP v1), for both platforms. Without the
 * Firebase service account (`FCM_CREDENTIALS`, a path to its JSON key) messages are only logged,
 * so development and tests need no Firebase project.
 */
class Push
{
    public function send(DeviceToken $device, string $title, string $body, array $data = []): void
    {
        $account = $this->account();
        if (! $account) {
            Log::info('push', [ 'user_id' => $device->user_id, 'title' => $title, 'body' => $body, 'data' => $data ]);
            return;
        }

        $response = Http::withToken($this->accessToken($account))
            ->post("https://fcm.googleapis.com/v1/projects/{$account['project_id']}/messages:send", [ 'message' => [
                'token' => $device->token,
                'notification' => [ 'title' => $title, 'body' => $body ],
                'data' => array_map('strval', $data), // FCM data values are strings
                'android' => [ 'priority' => 'high' ],
            ] ]);
        // The app was uninstalled or the token replaced: stop sending to it.
        if (in_array($response->json('error.details.0.errorCode'), [ 'UNREGISTERED', 'INVALID_ARGUMENT' ], true)) {
            $device->delete();
        } elseif ($response->failed()) {
            Log::warning('push failed', [ 'status' => $response->status(), 'body' => $response->body() ]);
        }
    }

    private function account(): ?array
    {
        $path = config('services.fcm.credentials');

        return $path && is_file($path) ? json_decode(file_get_contents($path), true) : null;
    }

    /**
     * An OAuth token for the service account (a JWT signed with its key), kept for 50 minutes.
     */
    private function accessToken(array $account): string
    {
        return Cache::remember('fcm_access_token', 50 * 60, function () use ($account) {
            $encode = fn ($value) => rtrim(strtr(base64_encode(is_string($value) ? $value : json_encode($value)), '+/', '-_'), '=');
            $now = time();
            $unsigned = $encode([ 'alg' => 'RS256', 'typ' => 'JWT' ]) . '.' . $encode([
                'iss' => $account['client_email'],
                'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
                'aud' => 'https://oauth2.googleapis.com/token',
                'iat' => $now,
                'exp' => $now + 3600,
            ]);
            openssl_sign($unsigned, $signature, $account['private_key'], OPENSSL_ALGO_SHA256);

            return Http::asForm()->post('https://oauth2.googleapis.com/token', [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => $unsigned . '.' . $encode($signature),
            ])->throw()->json('access_token');
        });
    }
}
