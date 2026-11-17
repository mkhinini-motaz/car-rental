<?php

namespace App\Http\Controllers;

use App\Http\Resources\CashMovementResource;
use App\Models\Activity;
use App\Models\Agency;
use App\Models\CashMovement;
use App\Models\Contract;
use App\Models\Fine;
use App\Models\Payment;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

/**
 * The till, day by day: cash payments, cash deposits taken and given back, expenses, fines,
 * other income, car sales and salaries paid in cash, and money put in or taken out by hand. Card, transfer and cheque payments are listed
 * but don't touch the balance.
 */
class CashBookController extends Controller
{
    public function show(Request $request)
    {
        $agency = $request->user()->agency;
        $request->validate([
            'date'    => 'required|date_format:Y-m-d',
            'user_id' => [ 'nullable', 'integer', Rule::exists('users', 'id')->where('agency_id', $agency->id) ],
        ]);
        $dayStart = CarbonImmutable::createFromFormat('Y-m-d', $request->input('date'), Agency::TIMEZONE)->startOfDay();
        $from = $dayStart->getTimestamp();
        $to = $dayStart->addDay()->getTimestamp();
        $userId = $request->filled('user_id') ? $request->integer('user_id') : null;

        // ponytail: the opening balance adds up the whole history, fine for years of a small agency.
        $opening = $this->lines($agency, 0, $from)->sum('amount');
        $lines = $this->lines($agency, $from, $to)
            ->when($userId, fn ($lines) => $lines->where('user.id', $userId))
            ->sortBy('at')->values();
        $payments = Payment::whereHas('contract.car', fn ($query) => $query->where('agency_id', $agency->id))
            ->whereBetween('paid_at', [ $from, $to - 1 ])
            ->when($userId, fn ($query) => $query->where('user_id', $userId))
            ->get();

        return response()->json([ 'data' => [
            'date' => $dayStart->format('Y-m-d'),
            'since' => $this->since($agency), // the till is counted from the day the agency joined
            // The balance is the till's, whoever handled it: only without a staff filter.
            'opening' => $userId ? null : $opening,
            'closing' => $userId ? null : $opening + $lines->sum('amount'),
            'cash_in' => $lines->where('amount', '>', 0)->sum('amount'),
            'cash_out' => -$lines->where('amount', '<', 0)->sum('amount'),
            'payments_by_method' => $payments->groupBy('method')
                ->map(fn ($group, $method) => [ 'method' => $method, 'amount' => $group->sum('amount') ])->values(),
            'lines' => $lines,
        ] ]);
    }

    public function storeMovement(Request $request)
    {
        $data = $request->validate([
            'type'     => [ 'required', Rule::in(CashMovement::TYPES) ],
            'amount'   => 'required|integer|min:1|max:100000000',
            'moved_at' => 'nullable|integer|min:0',
            'note'     => 'nullable|string|max:255',
        ]);
        $movement = $request->user()->agency->cashMovements()->create([ ...$data, 'moved_at' => $data['moved_at'] ?? time(), 'user_id' => $request->user()->id ]);

        return (new CashMovementResource($movement))->response()->setStatusCode(201);
    }

    public function destroyMovement(Request $request, $movementId)
    {
        $request->user()->agency->cashMovements()->findOrFail($movementId)->delete();

        return response()->noContent();
    }

    /**
     * The day the agency started with the app. Records dated before (an old oil change entered for
     * its date) stay out of the till: its cash then was never counted. The owner puts the cash
     * found in the till that day as money put in.
     */
    private function since(Agency $agency): int
    {
        return CarbonImmutable::createFromTimestamp($agency->created_at, Agency::TIMEZONE)->startOfDay()->getTimestamp();
    }

    /**
     * Every cash line in [$from, $to) from the day the agency joined, money in positive and out negative.
     */
    private function lines(Agency $agency, int $from, int $to): Collection
    {
        $withUsers = $from > 0; // not for the opening balance, which only adds up
        $from = max($from, $this->since($agency));
        $user = fn ($user) => $user ? [ 'id' => $user->id, 'first_name' => $user->first_name, 'last_name' => $user->last_name ] : null;
        $contracts = $agency->contracts()->with('client');
        $inRange = fn (string $column) => fn ($query) => $query->where($column, '>=', $from)->where($column, '<', $to);
        // Who handed the car over or settled it, from the contract's history.
        $handledBy = fn (Contract $contract, string $action) => $user(Activity::with('user')->where('contract_id', $contract->id)->where('action', $action)->latest('id')->first()?->user);
        $client = fn (Contract $contract) => "{$contract->client->first_name} {$contract->client->last_name}";

        $payments = Payment::with([ 'user', 'contract.client' ])->where('method', Payment::METHOD_CASH)
            ->whereHas('contract.car', fn ($query) => $query->where('agency_id', $agency->id))
            ->where($inRange('paid_at'))->get()
            ->map(fn (Payment $payment) => [ 'kind' => 'payment', 'at' => $payment->paid_at, 'amount' => $payment->amount, 'contract_id' => $payment->contract_id, 'label' => $client($payment->contract), 'user' => $user($payment->user) ]);
        $depositsTaken = (clone $contracts)->where('deposit_method', Payment::METHOD_CASH)->where($inRange('picked_up_at'))->get()
            ->map(fn (Contract $contract) => [ 'kind' => 'deposit_taken', 'at' => $contract->picked_up_at, 'amount' => $contract->deposit, 'contract_id' => $contract->id, 'label' => $client($contract), 'user' => $withUsers ? $handledBy($contract, 'picked_up') : null ]);
        $depositsReturned = (clone $contracts)->where('deposit_method', Payment::METHOD_CASH)->where('deposit_returned', '>', 0)->where($inRange('closed_at'))->get()
            ->map(fn (Contract $contract) => [ 'kind' => 'deposit_returned', 'at' => $contract->closed_at, 'amount' => -$contract->deposit_returned, 'contract_id' => $contract->id, 'label' => $client($contract), 'user' => $withUsers ? $handledBy($contract, 'closed') : null ]);
        $expenses = $agency->expenses()->with('user')->where('method', Payment::METHOD_CASH)->where($inRange('spent_at'))->get()
            ->map(fn ($expense) => [ 'kind' => 'expense', 'at' => $expense->spent_at, 'amount' => -$expense->amount, 'category' => $expense->category, 'car_id' => $expense->car_id, 'label' => $expense->note, 'user' => $user($expense->user) ]);
        // A fine the client paid the agency comes in; the agency paying the authority goes out.
        // Both happen when the agency pays first and the client pays it back.
        $fines = $agency->fines()->with([ 'user', 'car' ])->where('method', Payment::METHOD_CASH)
            ->where('status', Fine::STATUS_PAID_BY_CLIENT)->where($inRange('settled_at'))->get()
            ->map(fn (Fine $fine) => [ 'kind' => 'fine', 'id' => $fine->id, 'at' => $fine->settled_at, 'amount' => $fine->amount, 'label' => $fine->car->licence_plate, 'user' => $user($fine->user) ]);
        $finePayouts = $agency->fines()->with([ 'paidOutUser', 'car' ])->where('paid_out_method', Payment::METHOD_CASH)->where($inRange('paid_out_at'))->get()
            ->map(fn (Fine $fine) => [ 'kind' => 'fine_payout', 'id' => $fine->id, 'at' => $fine->paid_out_at, 'amount' => -$fine->amount, 'label' => $fine->car->licence_plate, 'user' => $user($fine->paidOutUser) ]);
        $incomes = $agency->incomes()->with([ 'user', 'car' ])->where('method', Payment::METHOD_CASH)->where($inRange('received_at'))->get()
            ->map(fn ($income) => [ 'kind' => 'income', 'id' => $income->id, 'category' => $income->category, 'car_id' => $income->car_id, 'at' => $income->received_at, 'amount' => $income->amount, 'label' => $income->car?->licence_plate ?? $income->note, 'user' => $user($income->user) ]);
        $carSales = $agency->cars()->where('sale_method', Payment::METHOD_CASH)->where($inRange('sold_at'))->get()
            ->map(fn ($car) => [ 'kind' => 'car_sale', 'id' => $car->id, 'at' => $car->sold_at, 'amount' => $car->sale_price, 'label' => $car->licence_plate, 'user' => null ]);
        $salaries = $agency->salaryPayments()->with([ 'user', 'employee' ])->where('method', Payment::METHOD_CASH)->where($inRange('paid_at'))->get()
            ->map(fn ($payment) => [ 'kind' => 'salary', 'id' => $payment->employee_id, 'type' => $payment->type, 'at' => $payment->paid_at, 'amount' => -$payment->amount, 'label' => trim("{$payment->employee->first_name} {$payment->employee->last_name}"), 'user' => $user($payment->user) ]);
        $movements = $agency->cashMovements()->with('user')->where($inRange('moved_at'))->get()
            ->map(fn (CashMovement $movement) => [ 'kind' => 'movement', 'id' => $movement->id, 'type' => $movement->type, 'at' => $movement->moved_at, 'amount' => $movement->signedAmount(), 'label' => $movement->note, 'user' => $user($movement->user) ]);

        return collect([ ...$payments, ...$depositsTaken, ...$depositsReturned, ...$expenses, ...$fines, ...$finePayouts, ...$incomes, ...$carSales, ...$salaries, ...$movements ]);
    }
}
