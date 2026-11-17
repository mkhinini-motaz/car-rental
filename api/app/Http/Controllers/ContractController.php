<?php

namespace App\Http\Controllers;

use App\Http\Resources\ContractResource;
use App\Http\Resources\PaymentResource;
use App\Http\Resources\ResourceCollection;
use App\Models\Activity;
use App\Models\Agency;
use App\Models\Car;
use App\Models\Client;
use App\Models\Contract;
use App\Models\ContractPhoto;
use App\Models\Payment;
use App\Models\User;
use App\Repositories\ContractRepository;
use App\Support\PastRental;
use App\Support\Pricing;
use App\Support\Push;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use function App\Support\Helpers\uploadFile;

class ContractController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $request->validate([
            'page'           => 'integer|min:1',
            'perPage'        => 'integer|min:1|max:100',
            'search'         => 'nullable|string|max:100',
            'orderBy'        => 'in:starts_at,ends_at,created_at,daily_price',
            'orderDirection' => 'in:asc,desc',
            'starts_at'      => 'nullable|required_with:ends_at|integer|min:0',
            'ends_at'        => 'nullable|required_with:starts_at|integer|gt:starts_at',
            'status'         => 'array',
            'status.*'       => Rule::in(Contract::STATUSES),
        ]);

        $contracts = ContractRepository::paginate(
            $request->user()->agency,
            $request->integer('page', 1),
            $request->integer('perPage', 20),
            $request->input('search'),
            $request->input('orderBy', 'starts_at'),
            $request->input('orderDirection', 'asc'),
            $request->filled('starts_at') ? $request->integer('starts_at') : null,
            $request->filled('ends_at') ? $request->integer('ends_at') : null,
            $request->input('status'),
        );

        return ResourceCollection::jsonResponse($contracts);
    }

    /**
     * Saves a reservation: one contract per selected slot, all or nothing.
     */
    public function store(Request $request)
    {
        $agency = $request->user()->agency;
        $data = $request->validate([
            'client_id'               => [ 'required', 'integer', $this->agencyRecord('clients', $agency) ],
            'second_driver_id'        => [ 'nullable', 'integer', 'different:client_id', $this->agencyRecord('clients', $agency) ],
            'pickup_location'         => 'nullable|string|max:100',
            'return_location'         => 'nullable|string|max:100',
            ...$this->extrasRules(),
            ...$this->sourceRules(),
            'note'                    => 'nullable|string|max:1000',
            'contracts'               => 'required|array|min:1|max:10',
            'contracts.*.car_id'      => [ 'required', 'integer', $this->agencyRecord('cars', $agency) ],
            'contracts.*.starts_at'   => 'required|integer|min:0',
            'contracts.*.ends_at'     => 'required|integer|gt:contracts.*.starts_at',
            'contracts.*.daily_price' => 'nullable|integer|min:0|max:10000000',
        ]);

        $contracts = DB::transaction(function () use ($agency, $data) {
            return collect($data['contracts'])->map(function ($item, $index) use ($agency, $data) {
                $car = Contract::lockFreeCar($agency, $item['car_id'], $item['starts_at'], $item['ends_at'], "contracts.$index");

                $contract = $car->contracts()->make([
                    'client_id' => $data['client_id'],
                    'second_driver_id' => $data['second_driver_id'] ?? null,
                    'pickup_location' => $data['pickup_location'] ?? null,
                    'return_location' => $data['return_location'] ?? null,
                    'daily_price' => $item['daily_price'] ?? Pricing::quote($agency, $car, $item['starts_at'], $item['ends_at'])['daily_price'],
                    'starts_at' => $item['starts_at'],
                    'ends_at' => $item['ends_at'],
                    'note' => $data['note'] ?? null,
                    'source' => $data['source'] ?? null,
                    'broker' => $data['broker'] ?? null,
                    'commission' => $data['commission'] ?? 0, // each car's
                ]);
                $contract->extras = $data['extras'] ?? [];
                $contract->save();
                Activity::record($contract, 'created');

                return $contract->load('car', 'client');
            });
        });

        return ResourceCollection::jsonResponse($contracts)->setStatusCode(201);
    }

    /**
     * A rental kept on paper before the app, entered in one go: see App\Support\PastRental.
     */
    public function storePast(Request $request)
    {
        $agency = $request->user()->agency;
        $contract = PastRental::record($agency, $request->validate(PastRental::rules($agency)));

        return $this->contractResponse($contract)->response()->setStatusCode(201);
    }

    public function show(Request $request, $contractId)
    {
        return $this->contractResponse($this->findContract($request->user()->agency, $contractId));
    }

    /**
     * Changes the dates (extend, shorten), the price, the client, the note, or who hands the car
     * over and takes it back (pushed to them).
     */
    public function update(Request $request, $contractId)
    {
        $agency = $request->user()->agency;
        $contract = $this->findContract($agency, $contractId);
        $this->requireStatus($contract, Contract::STATUS_RESERVED, Contract::STATUS_OUT, Contract::STATUS_RETURNED);
        // Staff who can see the car: a branch manager only works for their branch.
        $staff = [ 'sometimes', 'nullable', 'integer', $this->agencyRecord('users', $agency)->where(fn ($query) => $query->whereNull('branch_id')->orWhere('branch_id', $contract->car->branch_id)) ];
        $data = $request->validate([
            'client_id'        => [ 'sometimes', 'integer', $this->agencyRecord('clients', $agency) ],
            'pickup_user_id'   => $staff,
            'return_user_id'   => $staff,
            'second_driver_id' => [ 'sometimes', 'nullable', 'integer', $this->agencyRecord('clients', $agency) ],
            'pickup_location'  => 'sometimes|nullable|string|max:100',
            'return_location'  => 'sometimes|nullable|string|max:100',
            'note'             => 'sometimes|nullable|string|max:1000',
            'starts_at'        => 'sometimes|integer|min:0',
            'ends_at'          => 'sometimes|integer',
            'daily_price'      => 'sometimes|integer|min:0|max:10000000',
            ...$this->extrasRules('sometimes'),
            ...$this->sourceRules('sometimes|'),
        ]);
        $contract->fill($data);
        // The apps send the extras with every save: only a real change is one (null and [] are the same).
        if (array_key_exists('extras', $data) && $data['extras'] != ($contract->extras ?? [])) {
            $contract->extras = $data['extras'];
        }
        if ($contract->ends_at <= $contract->starts_at) {
            throw ValidationException::withMessages([ 'ends_at' => __('validation.gt.numeric', [ 'attribute' => 'ends at', 'value' => 'starts at' ]) ]);
        }
        if ($contract->second_driver_id && $contract->second_driver_id === $contract->client_id) {
            throw ValidationException::withMessages([ 'second_driver_id' => __('validation.different', [ 'attribute' => 'second driver', 'other' => 'client' ]) ]);
        }

        // Old and new values, clients and staff by name, for the activity log.
        $name = fn (string $field, ?int $id) => str_ends_with($field, 'user_id') ? $this->userName($id) : $this->clientName($id);
        $changes = collect($contract->getDirty())->keys()->mapWithKeys(fn ($field) => str_ends_with($field, '_id') ?
            [ str_replace('_id', '', $field) => [ $name($field, $contract->getOriginal($field)), $name($field, $contract->$field) ] ] :
            [ $field => [ $contract->getOriginal($field), $contract->$field ] ]);
        $assigned = collect([ 'pickup' => 'pickup_user_id', 'return' => 'return_user_id' ])
            ->filter(fn ($field) => $contract->isDirty($field) && $contract->$field && $contract->$field !== $request->user()->id);

        DB::transaction(function () use ($agency, $contract, $changes) {
            Contract::lockFreeCar($agency, $contract->car_id, $contract->starts_at, $contract->ends_at, 'ends_at', $contract->id);
            $contract->save();
            if ($changes->isNotEmpty()) {
                Activity::record($contract, 'updated', $changes->all());
            }
        });
        $assigned->each(fn ($field, $task) => $this->notifyAssigned($contract, $task, User::find($contract->$field)));

        return $this->contractResponse($contract);
    }

    /**
     * Ticks the car cleaned after its return (or unticks it): it leaves the cars to clean. Also on a
     * closed contract, which is often settled at the counter before the car is washed.
     */
    public function cleaned(Request $request, $contractId)
    {
        $contract = $this->findContract($request->user()->agency, $contractId);
        $this->requireStatus($contract, Contract::STATUS_RETURNED, Contract::STATUS_CLOSED);
        $cleaned = $request->validate([ 'cleaned' => 'required|boolean' ])['cleaned'];
        if ($cleaned !== ($contract->cleaned_at !== null)) {
            $contract->cleaned_at = $cleaned ? time() : null;
            $contract->save();
            Activity::record($contract, $cleaned ? 'cleaned' : 'not_cleaned');
        }

        return $this->contractResponse($contract);
    }

    /**
     * Cancels a reservation. It is also soft-deleted, so it frees the car and leaves every list.
     */
    public function destroy(Request $request, $contractId)
    {
        $contract = $this->findContract($request->user()->agency, $contractId);
        $this->requireStatus($contract, Contract::STATUS_RESERVED);
        $contract->status = Contract::STATUS_CANCELLED;
        $contract->save();
        Activity::record($contract, 'cancelled');
        $contract->delete();

        return response()->noContent();
    }

    /**
     * Hands the car over: the odometer, the deposit taken, and the pickup inspection. The client's
     * ID and licence details must be known by now (bookings only need a name and a phone).
     */
    public function pickup(Request $request, $contractId)
    {
        $contract = $this->findContract($request->user()->agency, $contractId);
        $this->requireStatus($contract, Contract::STATUS_RESERVED);
        $data = $request->validate([
            'mileage'        => 'required|integer|min:0|max:2000000',
            'deposit'        => 'nullable|integer|min:0|max:100000000',
            'deposit_method' => [ 'nullable', 'required_unless:deposit,null,0', Rule::in(Payment::METHODS) ],
            'signature'      => [ 'nullable', ...array_slice(PdfController::SIGNATURE_RULES, 1) ], // the client signs as the car goes out
            ...$this->inspectionRules(),
        ]);
        $client = $contract->client;
        if (! $client->id_number || ! $client->driver_licence_number || ! $client->driver_licence_delivery_date) {
            throw ValidationException::withMessages([ 'client' => 'client:incomplete' ]);
        }
        // The insurance only covers a second driver whose licence is on the contract.
        $driver = $contract->secondDriver;
        if ($driver && (! $driver->driver_licence_number || ! $driver->driver_licence_delivery_date)) {
            throw ValidationException::withMessages([ 'second_driver' => 'client:incomplete' ]);
        }

        $contract->status = Contract::STATUS_OUT;
        $contract->picked_up_at = $this->handoverTime($request, $contract->starts_at);
        $contract->pickup_mileage = (int) $data['mileage']; // multipart sends text
        $contract->deposit = $data['deposit'] ?? 0;
        $contract->deposit_method = $contract->deposit ? $data['deposit_method'] : null;
        if (! empty($data['signature'])) {
            $contract->signature = $data['signature'];
            $contract->signed_at = $contract->picked_up_at;
        }
        $this->saveHandover($request, $contract, ContractPhoto::STAGE_PICKUP, $data, [ 'mileage' => $contract->pickup_mileage, 'deposit' => $contract->deposit ]);

        return $this->contractResponse($contract);
    }

    /**
     * What returning the car now (or `at`, for a return entered after the fact) with this odometer
     * reading would cost on top of the rent, for the return screen to show before saving.
     */
    public function charges(Request $request, $contractId)
    {
        $agency = $request->user()->agency;
        $contract = $this->findContract($agency, $contractId);
        $this->requireStatus($contract, Contract::STATUS_OUT);
        $request->validate([ 'mileage' => 'required|integer|min:0|max:2000000' ]);

        return response()->json([ 'data' => [
            'charges' => Pricing::returnCharges($agency, $contract, $request->integer('mileage'), $this->handoverTime($request, (int) $contract->picked_up_at)),
            'deposit_available' => $contract->depositAvailable(),
        ] ]);
    }

    /**
     * Takes the car back: the odometer (never below the pickup reading), the return inspection
     * with an amount for each new damage, the charges (extra km, lateness) staff didn't waive,
     * and whether it came back dirty, with what the client pays for the wash. Charges are added to
     * what the client owes, or taken from the deposit. A car back clean has nothing to wash.
     */
    public function return(Request $request, $contractId)
    {
        $agency = $request->user()->agency;
        $contract = $this->findContract($agency, $contractId);
        $this->requireStatus($contract, Contract::STATUS_OUT);
        $data = $request->validate([
            'mileage'              => 'required|integer|min:' . (int) $contract->pickup_mileage . '|max:2000000',
            'waived'               => 'array',
            'waived.*'             => 'in:km,late',
            'charges_from_deposit' => 'boolean',
            'dirty'                => 'boolean',
            'washing'              => 'nullable|integer|min:0|max:10000000', // what the client pays for the wash, millimes
            ...$this->inspectionRules(),
            'damages.*.amount'     => 'nullable|integer|min:0|max:100000000', // priced at return only
        ]);

        $contract->status = Contract::STATUS_RETURNED;
        $contract->returned_at = $this->handoverTime($request, (int) $contract->picked_up_at);
        $contract->return_mileage = (int) $data['mileage']; // multipart sends text
        $charges = collect(Pricing::returnCharges($agency, $contract, $contract->return_mileage, $contract->returned_at))
            ->whereNotIn('type', $data['waived'] ?? []);
        $damages = collect($data['damages'] ?? [])->where('amount', '>', 0);
        if ($damages->isNotEmpty()) {
            $charges->push([ 'type' => 'damage', 'quantity' => $damages->count(), 'amount' => (int) $damages->sum(fn ($damage) => (int) $damage['amount']) ]);
        }
        // Back clean: nothing to wash. Dirty (or not said, by an older app): to clean, the wash charged when priced.
        $isClean = $request->has('dirty') && ! $request->boolean('dirty');
        if (! $isClean && (int) ($data['washing'] ?? 0) > 0) {
            $charges->push([ 'type' => 'washing', 'quantity' => 1, 'amount' => (int) $data['washing'] ]);
        }
        $contract->charges = $charges->values()->all();
        $contract->cleaned_at = $isClean ? $contract->returned_at : null;
        $this->saveHandover($request, $contract, ContractPhoto::STAGE_RETURN, $data, [ 'mileage' => $contract->return_mileage, 'charges' => $contract->chargesPrice() ]);

        $fromDeposit = min($contract->chargesPrice(), $contract->depositAvailable());
        if ($request->boolean('charges_from_deposit') && $fromDeposit > 0) {
            $this->addPayment($contract, [ 'amount' => $fromDeposit, 'method' => Payment::METHOD_DEPOSIT, 'paid_at' => $contract->returned_at ]);
        }

        return $this->contractResponse($contract);
    }

    /**
     * Settles a returned contract: the rent must be paid in full, and any part of the deposit
     * kept (fuel, damage, fines, cleaning) needs a reason. The rest goes back to the client.
     */
    public function close(Request $request, $contractId)
    {
        $contract = $this->findContract($request->user()->agency, $contractId);
        $this->requireStatus($contract, Contract::STATUS_RETURNED);
        $data = $request->validate([
            // Fines and charges already taken from the deposit leave less of it to keep.
            'deposit_kept'        => 'required|integer|min:0|max:' . $contract->depositAvailable(),
            'deposit_kept_reason' => 'nullable|required_unless:deposit_kept,0|string|max:255',
        ]);
        if ($data['deposit_kept'] > 0) {
            Gate::authorize('owner');
        }
        if ($contract->payments()->sum('amount') < $contract->totalPrice()) {
            throw ValidationException::withMessages([ 'payments' => 'contract:unpaid' ]);
        }

        $contract->status = Contract::STATUS_CLOSED;
        $contract->closed_at = time();
        $contract->deposit_kept = $data['deposit_kept'];
        $contract->deposit_kept_reason = $data['deposit_kept'] ? $data['deposit_kept_reason'] : null;
        $contract->deposit_returned = $contract->depositAvailable() - $contract->deposit_kept;
        $contract->save();
        Activity::record($contract, 'closed', [ 'deposit_kept' => $contract->deposit_kept, 'deposit_kept_reason' => $contract->deposit_kept_reason ]);

        return $this->contractResponse($contract);
    }

    public function storePayment(Request $request, $contractId)
    {
        $contract = $this->findContract($request->user()->agency, $contractId);
        $this->requireStatus($contract, Contract::STATUS_RESERVED, Contract::STATUS_OUT, Contract::STATUS_RETURNED);
        $data = $request->validate([
            'amount'  => 'required|integer|min:1|max:100000000',
            'method'  => [ 'required', Rule::in([ ...Payment::METHODS, Payment::METHOD_DEPOSIT ]) ],
            'paid_at' => 'nullable|integer|min:0',
        ]);
        if ($data['method'] === Payment::METHOD_DEPOSIT && $data['amount'] > $contract->depositAvailable()) {
            throw ValidationException::withMessages([ 'amount' => 'payment:deposit:unavailable' ]);
        }

        $payment = $this->addPayment($contract, [ ...$data, 'paid_at' => $data['paid_at'] ?? time() ]);

        return (new PaymentResource($payment))->response()->setStatusCode(201);
    }

    /**
     * Removes a payment entered by mistake. A closed contract's payments are final.
     */
    public function destroyPayment(Request $request, $contractId, $paymentId)
    {
        $contract = $this->findContract($request->user()->agency, $contractId);
        $this->requireStatus($contract, Contract::STATUS_RESERVED, Contract::STATUS_OUT, Contract::STATUS_RETURNED);
        $payment = $contract->payments()->findOrFail($paymentId);
        $payment->delete();
        Activity::record($contract, 'payment_removed', [ 'amount' => $payment->amount, 'method' => $payment->method ]);

        return response()->noContent();
    }

    private function addPayment(Contract $contract, array $data): Payment
    {
        $payment = $contract->payments()->create([ ...$data, 'user_id' => auth()->id() ]);
        Activity::record($contract, 'payment_added', [ 'amount' => $payment->amount, 'method' => $payment->method ]);

        return $payment;
    }

    private function userName(?int $userId): ?string
    {
        $user = $userId ? User::withTrashed()->find($userId) : null;

        return $user ? "{$user->first_name} {$user->last_name}" : null;
    }

    /**
     * Pushes a new task to the phones of the staff member it was given to, in each phone's language.
     */
    private function notifyAssigned(Contract $contract, string $task, User $user): void
    {
        $at = CarbonImmutable::createFromTimestamp($task === 'pickup' ? $contract->starts_at : $contract->ends_at, Agency::TIMEZONE)->format('d/m H:i');
        foreach ($user->deviceTokens as $device) {
            app(Push::class)->send($device, __('alerts.task.title', [], $device->lang), __('alerts.task.' . $task, [
                'plate' => Car::embedPlate($contract->car->licence_plate),
                'client' => $this->clientName($contract->client_id),
                'date' => $at,
            ], $device->lang), [ 'contract_id' => $contract->id ]);
        }
    }

    private function clientName(?int $clientId): ?string
    {
        $client = $clientId ? Client::withTrashed()->find($clientId) : null;

        return $client ? "{$client->first_name} {$client->last_name}" : null;
    }

    /**
     * Extras sold with the rental. `kind` marks the ones the app adds by itself (second driver,
     * delivery), so it can replace them when the driver or the place changes.
     */
    private function sourceRules(string $presence = ''): array
    {
        return [
            'source'     => [ ...($presence ? [ 'sometimes' ] : []), 'nullable', Rule::in(Contract::SOURCES) ],
            'broker'     => "{$presence}nullable|string|max:100|required_if:source," . Contract::SOURCE_BROKER,
            'commission' => "{$presence}integer|min:0|max:10000000",
        ];
    }

    private function extrasRules(string $presence = 'nullable'): array
    {
        return [
            'extras'         => "$presence|array|max:10",
            'extras.*.name'  => 'required|string|max:100',
            'extras.*.price' => 'required|integer|min:0|max:10000000',
            'extras.*.per'   => 'required|in:rental,day',
            'extras.*.kind'  => 'nullable|in:driver,pickup,return',
        ];
    }

    private function contractResponse(Contract $contract): ContractResource
    {
        $contract->load([
            'car', 'client', 'secondDriver', 'damages', 'fines',
            'activities' => fn ($query) => $query->with('user')->orderByDesc('id'),
            'payments' => fn ($query) => $query->orderBy('paid_at'),
            'photos' => fn ($query) => $query->orderBy('stage')->orderBy('angle'),
        ])->loadSum('payments as paid', 'amount');
        // What the handovers show on the outline as already there.
        if (in_array($contract->status, [ Contract::STATUS_RESERVED, Contract::STATUS_OUT ], true)) {
            $contract->setRelation('carDamages', $contract->car->damages()->whereNull('repaired_at')
                ->where(fn ($query) => $query->whereNull('contract_id')->orWhere('contract_id', '!=', $contract->id))->orderBy('id')->get());
        }

        return new ContractResource($contract);
    }

    private function requireStatus(Contract $contract, int ...$statuses): void
    {
        if (! in_array($contract->status, $statuses, true)) {
            throw ValidationException::withMessages([ 'status' => 'contract:status' ]);
        }
    }

    /**
     * Photos from fixed angles and damage marked on the car outline, sent with a pickup or a return.
     */
    private function inspectionRules(): array
    {
        return [
            'photos'          => 'array|max:12',
            'photos.*.angle'  => [ 'required', Rule::in(ContractPhoto::ANGLES) ],
            'photos.*.file'   => 'required|image|max:8192',
            'damages'         => 'array|max:30',
            'damages.*.x'     => 'required|integer|min:0|max:1000',
            'damages.*.y'     => 'required|integer|min:0|max:1000',
            'damages.*.note'  => 'nullable|string|max:255',
        ];
    }

    /**
     * Saves the contract, its inspection, and the odometer reading on the car.
     */
    /**
     * When the car actually changed hands: `at` when the phone saved the handover without network
     * and sends it later (up to a week back), so lateness is counted from the real return; now
     * otherwise. A rental entered after the fact (a car already out when the agency joined, or an
     * older one from the paper notebook) may go back to $earliest: the booked start for a pickup,
     * the pickup for a return.
     */
    private function handoverTime(Request $request, int $earliest): int
    {
        $request->validate([ 'at' => 'nullable|integer|min:' . min(time() - 7 * 24 * 60 * 60, $earliest) . '|max:' . (time() + 5 * 60) ]);

        return $request->filled('at') ? min(time(), $request->integer('at')) : time();
    }

    private function saveHandover(Request $request, Contract $contract, int $stage, array $data, array $activity): void
    {
        $photos = collect($data['photos'] ?? [])->map(fn ($photo, $index) => [
            'stage' => $stage,
            'angle' => $photo['angle'],
            'path' => uploadFile($request->file("photos.$index.file"), "contracts/{$contract->id}"),
        ]);

        DB::transaction(function () use ($contract, $stage, $data, $photos, $activity) {
            $contract->save();
            Activity::record($contract, $stage === ContractPhoto::STAGE_PICKUP ? 'picked_up' : 'returned', $activity);
            $contract->photos()->createMany($photos);
            $contract->damages()->createMany(collect($data['damages'] ?? [])->map(fn ($damage) => [ ...$damage, 'stage' => $stage ]));
            Car::whereKey($contract->car_id)->update([ 'mileage' => $data['mileage'] ]);
        });
    }

    private function findContract(Agency $agency, $contractId): Contract
    {
        return Contract::whereHas('car', fn ($query) => $query->where('agency_id', $agency->id))->findOrFail($contractId);
    }

    private function agencyRecord(string $table, Agency $agency)
    {
        return Rule::exists($table, 'id')->where('agency_id', $agency->id)->whereNull('deleted_at');
    }
}
