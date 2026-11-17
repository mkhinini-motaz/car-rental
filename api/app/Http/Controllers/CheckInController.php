<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Models\Client;
use App\Models\Contract;
use App\Models\Document;
use App\Support\Pdf;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\ValidationException;

use function App\Support\Helpers\fileUrl;
use function App\Support\Helpers\uploadFile;

/**
 * The client's pre-arrival check-in: staff send a link before the pickup, the client fills in
 * their ID and licence (and the second driver's), photographs them and may sign the contract
 * after reading it, so the counter only checks. The page is carweb's /checkin; it calls the signed
 * routes here, which work without a session until the rental ends, and only while the car hasn't
 * been handed over.
 */
class CheckInController extends Controller
{
    const DETAILS = [ 'birth_date', 'id_number', 'driver_licence_number', 'driver_licence_delivery_date', 'driver_licence_expiry_date' ];

    public function link(Request $request, $contractId)
    {
        $contract = Contract::whereHas('car', fn ($query) => $query->where('agency_id', $request->user()->agency_id))->findOrFail($contractId);
        if ($contract->status !== Contract::STATUS_RESERVED) {
            throw ValidationException::withMessages([ 'contract' => 'checkin:too_late' ]);
        }
        $expires = min(max($contract->ends_at, time() + 86400), time() + 30 * 86400); // until the rental ends, a month at most
        $api = URL::temporarySignedRoute('checkin', CarbonImmutable::createFromTimestamp($expires), [ 'contract' => $contract->id ], absolute: false);

        return response()->json([ 'data' => [ 'url' => rtrim(config('app.web_url'), '/') . '/checkin?link=' . urlencode($api) ] ]);
    }

    public function show(int $contract)
    {
        $contract = $this->open($contract);
        $agency = $contract->car->agency;
        $person = fn (?Client $client) => $client ? [
            'first_name' => $client->first_name, 'last_name' => $client->last_name, 'phone' => $client->phone,
            ...collect(self::DETAILS)->mapWithKeys(fn ($field) => [ $field => $client->$field ])->all(),
        ] : null;

        return response()->json([ 'data' => [
            'agency' => [ 'name' => $agency->name, 'phone' => $agency->phone, 'logo_url' => fileUrl($agency->logo) ],
            'car' => [ 'manufacturer' => $contract->car->manufacturer, 'model_name' => $contract->car->model_name ],
            'starts_at' => $contract->starts_at,
            'ends_at' => $contract->ends_at,
            'pickup_location' => $contract->pickup_location,
            'client' => $person($contract->client),
            'second_driver' => $person($contract->secondDriver),
            'documents' => $contract->client->documents()->pluck('type'), // already photographed
            'signature' => $contract->signature,
            'signed_at' => $contract->signed_at,
            // The terms to read before signing, for a day (the page asks for them again when reloaded).
            'contract_urls' => collect(Pdf::LANGS)->mapWithKeys(fn ($lang) => [ $lang => url(URL::temporarySignedRoute('pdf', now()->addDay(), [
                'kind' => 'contract', 'contract' => $contract->id, 'lang' => $lang,
            ], absolute: false)) ]),
        ] ]);
    }

    public function store(Request $request, int $contract)
    {
        $contract = $this->open($contract);
        $person = [
            'birth_date' => 'nullable|date_format:d/m/Y|before:today',
            'id_number' => 'nullable|string|max:20',
            'driver_licence_number' => 'nullable|string|max:20',
            'driver_licence_delivery_date' => 'nullable|date_format:d/m/Y|before_or_equal:today',
            'driver_licence_expiry_date' => 'nullable|date_format:d/m/Y',
        ];
        $data = $request->validate([
            'client.first_name' => 'required|string|max:255',
            'client.last_name' => 'required|string|max:255',
            ...collect($person)->mapWithKeys(fn ($rule, $field) => [ "client.$field" => $rule ])->all(),
            'second_driver' => 'nullable|array',
            'second_driver.first_name' => 'required_with:second_driver|string|max:255',
            'second_driver.last_name' => 'required_with:second_driver|string|max:255',
            'second_driver.phone' => [ 'required_with:second_driver', 'string', 'regex:/^\+216[234579]\d{7}$/' ],
            ...collect($person)->mapWithKeys(fn ($rule, $field) => [ "second_driver.$field" => $rule ])->all(),
            'id_photo' => 'nullable|image|max:8192',
            'licence_photo' => 'nullable|image|max:8192',
            // After reading the contract. Not `signature`: the link's own signature is in the query.
            'contract_signature' => [ 'sometimes', ...PdfController::SIGNATURE_RULES ],
        ]);
        $client = $contract->client;
        $driver = $data['second_driver'] ?? null;
        if ($driver && $driver['phone'] === $client->phone) {
            throw ValidationException::withMessages([ 'second_driver.phone' => 'driver:second:same' ]);
        }

        DB::transaction(function () use ($request, $contract, $client, $data, $driver) {
            $client->update($data['client']);
            if ($driver) {
                // Someone the agency knows keeps their record; their details are completed.
                $second = Client::where('agency_id', $client->agency_id)->where('phone', $driver['phone'])->first()
                    ?? tap(new Client(), fn (Client $new) => $new->agency_id = $client->agency_id);
                $second->fill(array_filter($driver, fn ($value) => $value !== null))->save();
                $contract->second_driver_id = $second->id;
                $contract->save();
            }
            foreach ([ 'id_photo' => Document::TYPE_ID_CARD, 'licence_photo' => Document::TYPE_DRIVER_LICENCE ] as $field => $type) {
                if ($request->hasFile($field)) {
                    $client->documents()->create([ 'type' => $type, 'path' => uploadFile($request->file($field), "clients/{$client->id}"), 'agency_id' => $client->agency_id ]);
                }
            }
            Activity::record($contract, 'checked_in');
            if (isset($data['contract_signature'])) {
                $contract->forceFill([ 'signature' => $data['contract_signature'], 'signed_at' => time() ])->save();
                Activity::record($contract, 'signed_remotely');
            }
        });

        return response()->noContent();
    }

    // The link stops working once the car is handed over (or the booking cancelled).
    private function open(int $id): Contract
    {
        $contract = Contract::with([ 'car.agency', 'client', 'secondDriver' ])->findOrFail($id);
        abort_unless($contract->status === Contract::STATUS_RESERVED, 410, 'checkin:too_late');

        return $contract;
    }
}
