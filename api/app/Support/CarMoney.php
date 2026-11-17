<?php

namespace App\Support;

use App\Models\Agency;
use App\Models\Car;
use App\Models\Contract;
use App\Models\Expense;
use App\Models\Fine;
use Carbon\CarbonImmutable;

/**
 * What a car cost, earned and returned over its life (millimes):
 *
 *   capital   purchase price + fees + interest (advance + instalments − price, when financed)
 *   running   its expenses except instalments (they pay for the car), plus fines the agency bore
 *             and the commissions brokers took on its rentals
 *   earned    rentals handed over (rent, extras, return charges), plus `earned_before` (what the
 *             owner says it brought in before the app, after its running costs)
 *   payback   earned / (capital + running); null until the purchase price is known, and for a car
 *             added with a past (`history_since`): its rentals before that aren't in the app
 *   result    earned + other income + sale price − capital − running: what the car finally returned
 *
 * Needs the car's contracts, expenses, fines and incomes; loads what isn't loaded.
 */
class CarMoney
{
    const MONTH = 30 * 24 * 60 * 60;

    public static function of(Car $car, ?int $now = null): array
    {
        $now ??= time();
        $car->loadMissing([ 'contracts', 'expenses', 'fines', 'incomes', 'agency' ]);
        $handedOver = $car->contracts->whereIn('status', [ Contract::STATUS_OUT, Contract::STATUS_RETURNED, Contract::STATUS_CLOSED ]);
        $earnedBefore = (int) $car->earned_before;
        $earned = $handedOver->sum(fn (Contract $contract) => $contract->totalPrice()) + $earnedBefore;

        $instalments = $car->expenses->where('category', Expense::CATEGORY_INSTALMENT);
        $running = $car->expenses->where('category', '!=', Expense::CATEGORY_INSTALMENT);
        $costs = collect(Expense::COST_GROUPS)->map(fn ($categories) => (int) $running->whereIn('category', $categories)->sum('amount'))->all();
        $costs['fines'] = (int) $car->fines->where('status', Fine::STATUS_PAID_BY_AGENCY)->sum('amount');
        $costs['commissions'] = (int) $handedOver->sum('commission');
        $runningTotal = array_sum($costs);

        $isFinanced = $car->instalment_amount && $car->instalment_months;
        $interest = $isFinanced && $car->purchase_price !== null ?
            max(0, (int) $car->advance + $car->instalment_amount * $car->instalment_months - $car->purchase_price) : 0;
        $capital = (int) $car->purchase_price + (int) $car->purchase_fees + $interest;
        $totalCost = $capital + $runningTotal;
        $otherIncome = (int) $car->incomes->sum('amount');

        // Earnings of the last six months (or since the car came into the app, or was bought, if later).
        $since = max($now - 6 * self::MONTH, (int) $car->created_at, (int) $car->bought_at);
        $months = max(1, ($now - $since) / self::MONTH);
        $monthlyEarned = (int) round($handedOver->where('starts_at', '>=', $since)->sum(fn (Contract $contract) => $contract->totalPrice()) / $months);
        $historySince = $car->historySince();
        $payback = $car->purchase_price !== null && $totalCost > 0 && $historySince === null ? round($earned / $totalCost, 3) : null;

        $deadline = $car->fleetDeadline();

        return [
            'history_since' => $historySince, // set: the figures only count from then
            'earned' => $earned,
            'earned_before' => $earnedBefore, // part of earned
            'other_income' => $otherIncome,
            'purchase_price' => $car->purchase_price,
            'purchase_fees' => (int) $car->purchase_fees,
            'interest' => $interest,
            'costs' => $costs, // running costs by group
            'running_total' => $runningTotal,
            'total_cost' => $totalCost,
            'payback' => $payback,
            'monthly_earned' => $monthlyEarned,
            'result' => $earned + $otherIncome + (int) $car->sale_price - $totalCost,
            'financing' => $isFinanced ? self::financing($car, $instalments->count()) : null,
            'fleet_deadline' => $deadline,
            'months_left' => $deadline === null ? null : (int) floor(($deadline - $now) / self::MONTH),
        ];
    }

    /**
     * Where the credit stands: instalments paid (one expense each, plus those paid before the car
     * came into the app), what's left, the next due date.
     */
    public static function financing(Car $car, int $paid): array
    {
        $paid += (int) $car->instalments_paid_before;
        $first = CarbonImmutable::createFromTimestamp($car->first_instalment_at ?? $car->bought_at ?? $car->created_at, Agency::TIMEZONE);
        $left = max(0, $car->instalment_months - $paid);

        return [
            'paid' => min($paid, $car->instalment_months),
            'months' => $car->instalment_months,
            'amount' => $car->instalment_amount,
            'remaining' => $left * $car->instalment_amount,
            'next_due_at' => $left ? $first->addMonthsNoOverflow($paid)->getTimestamp() : null,
            'ends_at' => $first->addMonthsNoOverflow($car->instalment_months - 1)->getTimestamp(),
            'lender' => $car->lender,
        ];
    }
}
