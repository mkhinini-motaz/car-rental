<?php

namespace App\Http\Controllers;

use App\Http\Resources\FineResource;
use App\Http\Resources\ResourceCollection;
use App\Models\Agency;
use App\Models\Contract;
use App\Models\Fine;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class FineController extends Controller
{
    /**
     * The agency's fines, unpaid first, then newest first.
     */
    public function index(Request $request)
    {
        $request->validate([
            'page'     => 'integer|min:1',
            'perPage'  => 'integer|min:1|max:100',
            'status'   => 'array',
            'status.*' => Rule::in(Fine::STATUSES),
        ]);

        $fines = $request->user()->agency->fines()
            ->with([ 'car', 'contract.client', 'client' ])
            ->when($request->filled('status'), fn ($query) => $query->whereIn('status', $request->input('status')))
            ->orderByRaw('status = ? desc', [ Fine::STATUS_UNPAID ])
            ->orderByDesc('committed_at')
            ->paginate($request->integer('perPage', 20), [ '*' ], 'page', $request->integer('page', 1));

        return ResourceCollection::jsonResponse($fines);
    }

    /**
     * Records a fine and finds who had the car when it was committed.
     */
    public function store(Request $request)
    {
        $agency = $request->user()->agency;
        $data = $request->validate([
            'car_id'       => [ 'required', 'integer', Rule::exists('cars', 'id')->where('agency_id', $agency->id)->whereNull('deleted_at') ],
            'committed_at' => 'required|integer|min:0',
            'amount'       => 'required|integer|min:1|max:100000000',
            'reference'    => 'nullable|string|max:50',
            'note'         => 'nullable|string|max:255',
        ]);

        $fine = $agency->fines()->make($data);
        $fine->contract_id = $this->contractAt($data['car_id'], $data['committed_at'])?->id;
        $fine->save();

        return $this->fineResponse($fine)->response()->setStatusCode(201);
    }

    public function show(Request $request, $fineId)
    {
        return $this->fineResponse($this->findFine($request->user()->agency, $fineId));
    }

    /**
     * Settles the client's side of a fine: the client paid (the agency, or the authority directly
     * when `method` is sent as null), it was kept from the deposit, or the agency bears it (back
     * to unpaid to undo a mistake). Only a deposit the agency still holds can be used.
     */
    public function update(Request $request, $fineId)
    {
        $fine = $this->findFine($request->user()->agency, $fineId);
        $request->validate([
            'status'          => [ 'required', Rule::in(Fine::STATUSES) ],
            'method'          => [ 'nullable', Rule::in(Payment::METHODS) ], // how the client paid; cash when left out
            'paid_out_method' => [ 'nullable', Rule::in(Payment::METHODS) ], // agency bears it: how it paid, cash by default
        ]);
        $status = $request->integer('status');
        $contract = $fine->contract;

        if ($fine->status === Fine::STATUS_FROM_DEPOSIT && $contract?->status === Contract::STATUS_CLOSED) {
            throw ValidationException::withMessages([ 'status' => 'fine:deposit:settled' ]); // the deposit is already settled
        }
        if ($status === Fine::STATUS_FROM_DEPOSIT && $fine->status !== Fine::STATUS_FROM_DEPOSIT) {
            $isHeld = $contract && in_array($contract->status, [ Contract::STATUS_OUT, Contract::STATUS_RETURNED ], true);
            if (! $isHeld || $fine->amount > $contract->depositAvailable()) {
                throw ValidationException::withMessages([ 'status' => 'fine:deposit:unavailable' ]);
            }
        }

        $fine->status = $status;
        $fine->settled_at = $fine->status === Fine::STATUS_UNPAID ? null : time();
        // Money the client gave the agency: cash is in the cash book.
        $fine->method = $status === Fine::STATUS_PAID_BY_CLIENT ?
            ($request->has('method') ? $request->input('method') : Payment::METHOD_CASH) :
            null;
        $fine->user_id = $fine->settled_at ? $request->user()->id : null;
        // The agency bears it, so it paid the authority, if that isn't recorded yet.
        if ($status === Fine::STATUS_PAID_BY_AGENCY && ! $fine->paid_out_at) {
            $this->payOut($request, $fine, $request->integer('paid_out_method', Payment::METHOD_CASH));
        }
        $fine->save();

        return $this->fineResponse($fine);
    }

    /**
     * Who had the car, for a fine no rental in the app matches (a rental kept on paper before the
     * agency joined): a client of the agency, or null to clear it.
     */
    public function updateClient(Request $request, $fineId)
    {
        $agency = $request->user()->agency;
        $fine = $this->findFine($agency, $fineId);
        $data = $request->validate([
            'client_id' => [ 'present', 'nullable', 'integer', Rule::exists('clients', 'id')->where('agency_id', $agency->id)->whereNull('deleted_at') ],
        ]);
        if ($fine->contract_id) {
            throw ValidationException::withMessages([ 'client_id' => 'fine:client:contract' ]); // the rental's client
        }
        $fine->client_id = $data['client_id'];
        $fine->save();

        return $this->fineResponse($fine);
    }

    /**
     * The agency paid the authority (at the recette des finances), whoever pays it back.
     */
    public function storePayout(Request $request, $fineId)
    {
        $fine = $this->findFine($request->user()->agency, $fineId);
        $request->validate([ 'method' => [ 'required', Rule::in(Payment::METHODS) ] ]);
        $this->payOut($request, $fine, $request->integer('method'));
        $fine->save();

        return $this->fineResponse($fine);
    }

    public function destroyPayout(Request $request, $fineId)
    {
        $fine = $this->findFine($request->user()->agency, $fineId);
        if ($fine->status === Fine::STATUS_PAID_BY_AGENCY) {
            throw ValidationException::withMessages([ 'status' => 'fine:payout:agency' ]); // undo "the agency bears it" first
        }
        $fine->paid_out_at = $fine->paid_out_method = $fine->paid_out_user_id = null;
        $fine->save();

        return $this->fineResponse($fine);
    }

    private function payOut(Request $request, Fine $fine, int $method): void
    {
        $fine->paid_out_at = time();
        $fine->paid_out_method = $method;
        $fine->paid_out_user_id = $request->user()->id;
    }

    public function destroy(Request $request, $fineId)
    {
        $fine = $this->findFine($request->user()->agency, $fineId);
        if ($fine->status === Fine::STATUS_FROM_DEPOSIT && $fine->contract?->status === Contract::STATUS_CLOSED) {
            throw ValidationException::withMessages([ 'status' => 'fine:deposit:settled' ]);
        }
        $fine->delete();

        return response()->noContent();
    }

    private function findFine(Agency $agency, $fineId): Fine
    {
        return $agency->fines()->findOrFail($fineId);
    }

    private function fineResponse(Fine $fine): FineResource
    {
        return new FineResource($fine->load([ 'car', 'contract.client', 'client' ]));
    }

    /**
     * The rental that had the car at $time: from its handover (or booked start) to its
     * return (or booked end, or now while it is still out).
     */
    private function contractAt(int $carId, int $time): ?Contract
    {
        return Contract::where('car_id', $carId)
            ->whereRaw('coalesce(picked_up_at, starts_at) <= ?', [ $time ])
            ->where(fn ($query) => $query->where('returned_at', '>=', $time)
                ->orWhere(fn ($query) => $query->whereNull('returned_at')->where('ends_at', '>', $time))
                ->orWhere(fn ($query) => $query->whereNull('returned_at')->where('status', Contract::STATUS_OUT)))
            ->orderByDesc('starts_at')
            ->first();
    }
}
