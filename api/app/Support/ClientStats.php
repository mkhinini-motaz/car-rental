<?php

namespace App\Support;

use App\Models\Client;
use App\Models\Contract;
use App\Models\Expense;
use App\Models\Fine;

/**
 * What a client brought in and how they behave (millimes, counts), computed, never stored:
 *
 *   revenue       rentals handed over (rent, extras, return charges); outstanding what's unpaid on them
 *   late_returns  returns past the end plus the agency's grace hours, with the hours late
 *   no_shows      reservations cancelled after their start (the client never came)
 *   net           revenue less repairs not recovered, unpaid fines and the outstanding balance
 *   badge         good, watch (one late return or a balance), risk (two late, damage, an unpaid
 *                 fine, or flagged by staff: the flag always wins), new (no rental yet, in the app
 *                 or before it: a regular client whose rentals were on paper is good)
 */
class ClientStats
{
    const HOUR = 60 * 60;

    public static function of(Client $client): array
    {
        $contracts = Contract::withTrashed()->where('client_id', $client->id)
            ->with([ 'fines', 'car.agency' ])->withSum('payments as paid', 'amount')->get();
        $cancelled = $contracts->where('status', Contract::STATUS_CANCELLED);
        $handedOver = $contracts->whereIn('status', [ Contract::STATUS_OUT, Contract::STATUS_RETURNED, Contract::STATUS_CLOSED ]);
        $graceHours = $client->agency ? Pricing::rules($client->agency)['late_grace_hours'] : 0;
        $late = $handedOver->filter(fn (Contract $contract) => $contract->returned_at && $contract->returned_at > $contract->ends_at + $graceHours * self::HOUR);

        $revenue = $handedOver->sum(fn (Contract $contract) => $contract->totalPrice());
        $outstanding = $handedOver->sum(fn (Contract $contract) => max(0, $contract->totalPrice() - (int) $contract->paid));
        // On their rentals, and on rentals kept on paper before the app where staff named them.
        $finesUnpaid = (int) $contracts->flatMap->fines->where('status', Fine::STATUS_UNPAID)->sum('amount')
            + (int) Fine::where('client_id', $client->id)->whereNull('contract_id')->where('status', Fine::STATUS_UNPAID)->sum('amount');
        $damageCharged = (int) $handedOver->sum(fn (Contract $contract) => collect($contract->charges ?? [])->where('type', 'damage')->sum('amount'));
        $repairs = (int) Expense::whereIn('contract_id', $contracts->pluck('id'))->sum('amount');
        $unrecovered = max(0, $repairs - $damageCharged);
        $days = $handedOver->sum(fn (Contract $contract) => $contract->days());

        $badge = $client->flag || $finesUnpaid > 0 ? 'risk' : // an unpaid fine counts even from a rental on paper
            ($handedOver->isEmpty() ? ($client->rentals_before ? 'good' : 'new') :
            ($late->count() >= 2 || $damageCharged > 0 || $repairs > 0 ? 'risk' :
            ($late->count() === 1 || $outstanding > 0 ? 'watch' : 'good')));

        return [
            'contracts_count' => $contracts->count() - $cancelled->count(),
            'rentals_before' => (int) $client->rentals_before, // on paper, before the app: counted in nothing else
            'first_rental_at' => $handedOver->min('starts_at'),
            'last_rental_at' => $handedOver->max('starts_at'),
            'revenue' => $revenue,
            'average_value' => $handedOver->count() ? (int) round($revenue / $handedOver->count()) : 0,
            'average_days' => $handedOver->count() ? round($days / $handedOver->count(), 1) : 0,
            'paid' => (int) $contracts->sum('paid'),
            'outstanding' => $outstanding,
            'fines_unpaid' => $finesUnpaid,
            'damage_charged' => $damageCharged,
            'repair_costs' => $repairs,
            'deposits_kept' => (int) $handedOver->sum('deposit_kept'),
            'late_returns' => $late->count(),
            'late_hours' => (int) $late->sum(fn (Contract $contract) => ceil(($contract->returned_at - $contract->ends_at) / self::HOUR)),
            'cancellations' => $cancelled->count(),
            'no_shows' => $cancelled->filter(fn (Contract $contract) => $contract->deleted_at > $contract->starts_at)->count(),
            'net' => $revenue - $unrecovered - $finesUnpaid - $outstanding,
            'badge' => $badge,
        ];
    }
}
