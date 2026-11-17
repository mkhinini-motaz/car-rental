<?php

namespace App\Support;

use App\Http\Resources\CarResource;
use App\Models\Agency;
use App\Models\Car;
use App\Models\CarBlock;
use App\Models\Client;
use App\Models\Contract;
use App\Models\Expense;
use App\Models\Fine;
use App\Models\Payment;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * The owner's month, computed in PHP over the year's records (fine for a small agency).
 *
 * Revenue is booked rent spread over the days rented, plus extras in the month the rental starts
 * and return charges in the month the car came back; cancelled rentals don't count. A deposit
 * kept at close is not revenue: it pays for charges already counted (damage priced at return),
 * so counting it too would count that damage twice.
 *
 * Costs: car costs (expenses on cars except instalments, and fines the agency bore), credit
 * instalments, overhead (the agency's own categories) and payroll (salaries, advances and
 * bonuses for the month, plus the employer's charges at the agency's rate; with a rate set, the
 * quarterly CNSS payment is that same money and is left out of overhead), and the commissions
 * brokers take on the rentals starting in the month.
 *
 *   net = revenue + other income − car costs − instalments − overhead − payroll − commissions
 */
class MonthlyReport
{
    const DAY = 24 * 60 * 60;
    const HOUR = 60 * 60;

    private CarbonImmutable $from;
    private CarbonImmutable $to;
    private Collection $contracts; // overlapping the year ending with the month
    private Collection $expenses;
    private Collection $borneFines;
    private int $since; // the agency's records start: it joined, or its oldest rental entered from the notebook

    public function __construct(private Agency $agency, int $year, int $month)
    {
        $this->from = CarbonImmutable::create($year, $month, 1, 0, 0, 0, Agency::TIMEZONE);
        $this->to = $this->from->addMonth();
        $windowStart = $this->from->subMonths(11);
        $this->contracts = $agency->contracts()->with([ 'car', 'client' ])->withSum('payments as paid', 'amount')
            ->where('starts_at', '<', $this->to->getTimestamp())->where('ends_at', '>', $windowStart->getTimestamp())
            ->orderBy('starts_at')->get();
        $this->expenses = $agency->expenses()->with([ 'car', 'branch' ])
            ->where('spent_at', '>=', $windowStart->getTimestamp())->where('spent_at', '<', $this->to->getTimestamp())
            ->orderBy('spent_at')->get();
        $this->since = min((int) $agency->created_at, (int) ($agency->contracts()->min('starts_at') ?? PHP_INT_MAX));
        $this->borneFines = $agency->fines()->where('status', Fine::STATUS_PAID_BY_AGENCY)
            ->whereBetween('settled_at', [ $windowStart->getTimestamp(), $this->to->getTimestamp() - 1 ])->get();
    }

    public function toArray(): array
    {
        $totals = $this->totals($this->from, $this->to);
        $previous = $this->totals($this->from->subMonth(), $this->from);
        $monthExpenses = $this->between($this->expenses, 'spent_at', $this->from, $this->to);
        $overhead = $this->overheadExpenses($monthExpenses);
        $carsInFleet = $this->carsIn($this->from, $this->to);
        $open = $this->agency->contracts()->with([ 'car', 'client' ])->withSum('payments as paid', 'amount')
            ->whereIn('contracts.status', [ Contract::STATUS_OUT, Contract::STATUS_RETURNED ])->get();
        $payments = Payment::whereHas('contract.car', fn ($query) => $query->where('agency_id', $this->agency->id))
            ->whereBetween('paid_at', [ $this->from->getTimestamp(), $this->to->getTimestamp() - 1 ])->get();
        $now = time();

        return [
            'month' => $this->from->format('Y-m'),
            'since' => $this->since, // nothing is recorded before
            ...$totals,
            // For the ± next to each figure; nothing to compare with before the agency joined.
            'previous' => $this->from->getTimestamp() <= $this->since ? [ 'revenue' => null, 'net' => null, 'utilization_rate' => null ] :
                collect($previous)->only([ 'revenue', 'net', 'utilization_rate' ])->all(),
            'kpis' => $this->kpis(),
            'payments_received' => (int) $payments->sum('amount'),
            'payments_by_method' => $payments->groupBy('method')->map(fn ($group, $method) => [ 'method' => $method, 'amount' => $group->sum('amount') ])->values(),
            'expenses_by_category' => $monthExpenses->groupBy('category')->map(fn ($group, $category) => [ 'category' => $category, 'amount' => $group->sum('amount') ])->values(),
            'overhead_by_branch' => $overhead->groupBy(fn ($expense) => $expense->branch_id ?? 0)
                ->map(fn ($group) => [ 'branch' => $group->first()->branch ? [ 'id' => $group->first()->branch->id, 'name' => $group->first()->branch->name ] : null, 'amount' => $group->sum('amount') ])->values(),
            'overhead_per_car' => $carsInFleet->count() ? (int) round($totals['overhead'] / $carsInFleet->count()) : 0,
            'payroll_by_employee' => $this->payroll()->groupBy('employee_id')
                ->map(fn ($group) => [ 'employee' => [ 'id' => $group->first()->employee->id, 'first_name' => $group->first()->employee->first_name, 'last_name' => $group->first()->employee->last_name ], 'amount' => $group->sum('amount') ])->values(),
            // What each broker is owed for the rentals they brought that start this month.
            'commissions_by_broker' => $this->between($this->contracts, 'starts_at', $this->from, $this->to)
                ->filter(fn (Contract $contract) => $contract->commission > 0 || $contract->broker)
                ->groupBy(fn (Contract $contract) => mb_strtolower(trim((string) $contract->broker)))
                ->map(fn ($group) => [ 'broker' => $group->first()->broker, 'contracts' => $group->count(), 'amount' => (int) $group->sum('commission') ])
                ->sortByDesc('amount')->values(),
            'fines_paid_by_agency' => (int) $this->between($this->borneFines, 'settled_at', $this->from, $this->to)->sum('amount'),
            'months' => collect(range(0, 11))->map(function ($index) {
                $from = $this->from->subMonths(11 - $index);
                if ($from->addMonth()->getTimestamp() <= $this->since) {
                    return [ 'month' => $from->format('Y-m'), 'revenue' => null, 'expenses' => null ]; // before any record: no data, not zero
                }
                $totals = $this->totals($from, $from->addMonth(), false);
                return [ 'month' => $from->format('Y-m'), 'revenue' => $totals['revenue'], 'expenses' => $totals['expenses'] ];
            }),
            'utilization' => $this->utilization($carsInFleet),
            // Money owed and held right now, whatever the month: who owes what, oldest first.
            'owed_rent' => $open->sum(fn (Contract $contract) => max(0, $contract->totalPrice() - (int) $contract->paid)),
            'owed_contracts' => $open->map(fn (Contract $contract) => [
                'id' => $contract->id,
                'client' => [ 'id' => $contract->client->id, 'first_name' => $contract->client->first_name, 'last_name' => $contract->client->last_name, 'phone' => $contract->client->phone ],
                'car' => [ 'id' => $contract->car->id, 'licence_plate' => $contract->car->licence_plate, 'manufacturer' => $contract->car->manufacturer, 'model_name' => $contract->car->model_name ],
                'owed' => max(0, $contract->totalPrice() - (int) $contract->paid),
                'days_late' => max(0, (int) floor(($now - $contract->ends_at) / self::DAY)),
            ])->filter(fn ($item) => $item['owed'] > 0)->sortByDesc('owed')->values(),
            'owed_fines' => (int) $this->agency->fines()->where('status', Fine::STATUS_UNPAID)->sum('amount'),
            'unpaid_fines' => $this->agency->fines()->with([ 'car', 'contract.client', 'client' ])->where('status', Fine::STATUS_UNPAID)->orderByDesc('amount')->get()
                ->map(fn (Fine $fine) => [ 'id' => $fine->id, 'amount' => $fine->amount, 'committed_at' => $fine->committed_at, 'licence_plate' => $fine->car->licence_plate,
                    // The rental's client, or the renter staff named for a rental kept on paper.
                    'client' => ($client = $fine->contract?->client ?? $fine->client) ? [ 'id' => $client->id, 'first_name' => $client->first_name, 'last_name' => $client->last_name ] : null ]),
            'deposits_held' => $open->sum(fn (Contract $contract) => $contract->depositAvailable()),
            'upcoming' => $this->upcoming($now),
            'clients' => $this->clients(),
            ...$this->fleet($now),
        ];
    }

    /**
     * Revenue, costs and net over [$from, $to), with the fleet's utilization.
     */
    public function totals(CarbonImmutable $from, CarbonImmutable $to, bool $withUtilization = true): array
    {
        $expenses = $this->between($this->expenses, 'spent_at', $from, $to);
        $carCosts = (int) $expenses->whereIn('category', Expense::CAR_CATEGORIES)->where('category', '!=', Expense::CATEGORY_INSTALMENT)->sum('amount')
            + (int) $this->between($this->borneFines, 'settled_at', $from, $to)->sum('amount');
        $instalments = (int) $expenses->where('category', Expense::CATEGORY_INSTALMENT)->sum('amount');
        $overhead = (int) $this->overheadExpenses($expenses)->sum('amount');
        $salaries = (int) $this->payroll($from)->sum('amount');
        $employerCharges = (int) round($salaries * $this->agency->employer_charges_rate / 10000);
        $revenue = $this->revenue($this->contracts, $from, $to);
        $otherIncome = (int) $this->agency->incomes()->where('received_at', '>=', $from->getTimestamp())->where('received_at', '<', $to->getTimestamp())->sum('amount');
        $commissions = (int) $this->between($this->contracts, 'starts_at', $from, $to)->sum('commission');
        $costs = $carCosts + $instalments + $overhead + $salaries + $employerCharges + $commissions;

        return [
            'revenue' => $revenue,
            'other_income' => $otherIncome,
            'car_costs' => $carCosts,
            'instalments' => $instalments,
            'overhead' => $overhead,
            'payroll' => $salaries,
            'employer_charges' => $employerCharges,
            'commissions' => $commissions,
            'expenses' => $costs,
            'net' => $revenue + $otherIncome - $costs,
            ...($withUtilization ? [ 'utilization_rate' => $this->fleetUtilization($from, $to) ] : []),
        ];
    }

    /**
     * Days rented over days available to rent (cars in the fleet × days in the month).
     */
    private function fleetUtilization(CarbonImmutable $from, CarbonImmutable $to): float
    {
        $carDays = $this->carsIn($from, $to)->sum(fn (Car $car) => $this->daysInFleet($car, $from, $to));
        $rented = $this->contracts->filter(fn (Contract $contract) => $contract->status !== Contract::STATUS_CANCELLED)
            ->sum(fn (Contract $contract) => $this->overlap($contract->starts_at, $contract->ends_at, $from, $to)) / self::DAY;

        return $carDays > 0 ? round($rented / $carDays, 3) : 0;
    }

    /**
     * Counts and averages for the month: average daily rate, contracts started and cancelled,
     * average length, and late returns (count and hours).
     */
    private function kpis(): array
    {
        $from = $this->from->getTimestamp();
        $to = $this->to->getTimestamp();
        $started = $this->contracts->filter(fn (Contract $contract) => $contract->starts_at >= $from && $contract->starts_at < $to);
        $daysRented = $this->contracts->sum(fn (Contract $contract) => $this->overlap($contract->starts_at, $contract->ends_at, $this->from, $this->to)) / self::DAY;
        $rent = $this->contracts->sum(fn (Contract $contract) => $contract->daily_price * $this->overlap($contract->starts_at, $contract->ends_at, $this->from, $this->to) / self::DAY);
        $lateReturns = $this->agency->contracts()->whereNotNull('returned_at')->where('returned_at', '>=', $from)->where('returned_at', '<', $to)
            ->whereColumn('returned_at', '>', 'ends_at')->get([ 'contracts.returned_at', 'contracts.ends_at' ]);

        return [
            'average_daily_rate' => $daysRented > 0 ? (int) round($rent / $daysRented) : 0,
            'contracts_started' => $started->count(),
            'contracts_cancelled' => Contract::onlyTrashed()->where('status', Contract::STATUS_CANCELLED)->whereIn('car_id', $this->agency->cars()->withTrashed()->select('id'))
                ->where('deleted_at', '>=', $from)->where('deleted_at', '<', $to)->count(),
            'average_days' => $started->count() ? round($started->sum(fn (Contract $contract) => $contract->days()) / $started->count(), 1) : 0,
            'late_returns' => $lateReturns->count(),
            'late_hours' => (int) $lateReturns->sum(fn ($contract) => ceil(($contract->returned_at - $contract->ends_at) / self::HOUR)),
            'overdue_now' => $this->agency->contracts()->where('contracts.status', Contract::STATUS_OUT)->where('ends_at', '<', time())->count(),
        ];
    }

    /**
     * Per car: days rented, rate, revenue, idle days and days blocked for maintenance in the
     * month, and cost per km over its life.
     */
    private function utilization(Collection $cars): Collection
    {
        return $cars->map(function (Car $car) {
            $contracts = $this->contracts->where('car_id', $car->id);

            return [
                'car' => new CarResource($car),
                ...self::carDays($car, $contracts, $this->from, $this->to),
                'revenue' => $this->revenue($contracts, $this->from, $this->to),
                'cost_per_km' => self::costPerKm($car),
            ];
        })->values();
    }

    /**
     * A car's days in [$from, $to): rented (from $contracts), blocked for maintenance, idle (in
     * the fleet and neither), and the rented share of the month.
     */
    public static function carDays(Car $car, Collection $contracts, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $overlap = fn (int $startsAt, int $endsAt) => max(0, min($endsAt, $to->getTimestamp()) - max($startsAt, $from->getTimestamp()));
        $rented = $contracts->sum(fn (Contract $contract) => $overlap($contract->starts_at, $contract->ends_at)) / self::DAY;
        $maintenance = $car->blocks()->where('reason', CarBlock::REASON_MAINTENANCE)->overlapping($from->getTimestamp(), $to->getTimestamp())->get()
            ->sum(fn ($block) => $overlap($block->starts_at, $block->ends_at)) / self::DAY;
        $inFleet = $overlap($car->created_at, $car->sold_at ?? PHP_INT_MAX) / self::DAY;

        return [
            'days_rented' => round($rented, 1),
            'rate' => round($rented / $from->daysInMonth, 3),
            'idle_days' => round(max(0, $inFleet - $rented - $maintenance), 1),
            'maintenance_days' => round($maintenance, 1),
        ];
    }

    /**
     * Running costs over the kilometres driven between the first and last known readings
     * (pickups, returns, maintenance, the odometer now), millimes per km. Null without a distance.
     */
    public static function costPerKm(Car $car): ?int
    {
        $car->loadMissing([ 'contracts', 'expenses' ]);
        $readings = $car->contracts->pluck('pickup_mileage')->merge($car->contracts->pluck('return_mileage'))
            ->merge($car->expenses->pluck('mileage'))->push($car->mileage)->filter(fn ($km) => $km !== null);
        $km = $readings->isEmpty() ? 0 : $readings->max() - $readings->min();
        $running = $car->expenses->where('category', '!=', Expense::CATEGORY_INSTALMENT)->sum('amount');

        return $km > 0 ? (int) round($running / $km) : null;
    }

    /**
     * Booked for the next 30 days: reservations and their rent.
     */
    private function upcoming(int $now): array
    {
        $booked = $this->agency->contracts()->where('contracts.status', Contract::STATUS_RESERVED)
            ->where('starts_at', '>=', $now)->where('starts_at', '<', $now + 30 * self::DAY)->get();

        return [ 'count' => $booked->count(), 'revenue' => $booked->sum(fn (Contract $contract) => $contract->totalPrice()) ];
    }

    /**
     * The month's clients by revenue, each with its badge, rentals and what it owes overall.
     */
    private function clients(): Collection
    {
        $month = $this->contracts->filter(fn (Contract $contract) => $contract->ends_at > $this->from->getTimestamp());

        return $month->groupBy('client_id')->map(function ($contracts) {
            $stats = ClientStats::of($contracts->first()->client);
            $client = $contracts->first()->client;
            return [
                'client' => [ 'id' => $client->id, 'first_name' => $client->first_name, 'last_name' => $client->last_name, 'phone' => $client->phone, 'flag' => $client->flag ],
                'revenue' => $this->revenue($contracts, $this->from, $this->to),
                'contracts' => $contracts->count(),
                'outstanding' => $stats['outstanding'],
                'badge' => $stats['badge'],
            ];
        })->sortByDesc('revenue')->values();
    }

    /**
     * The fleet's money: every car with what it cost and earned and its payback (sorted by
     * payback, worst first), the sold cars with their final result, and renewal: cars by the
     * date they must leave the fleet, with the capital coming back within 12 months.
     */
    private function fleet(int $now): array
    {
        $cars = $this->agency->cars()->with([ 'contracts', 'expenses', 'fines', 'incomes', 'agency' ])->get()
            ->map(fn (Car $car) => [ 'car' => $car, 'money' => CarMoney::of($car, $now) ]);
        [ $sold, $inFleet ] = $cars->partition(fn ($item) => $item['car']->sold_at !== null);
        $summary = fn ($item) => [
            'car' => [ 'id' => $item['car']->id, 'licence_plate' => $item['car']->licence_plate, 'manufacturer' => $item['car']->manufacturer, 'model_name' => $item['car']->model_name ],
            'total_cost' => $item['money']['total_cost'],
            'earned' => $item['money']['earned'],
            'payback' => $item['money']['payback'], // null for a car added with a past: ranked last
            'history_since' => $item['money']['history_since'],
            'fleet_deadline' => $item['money']['fleet_deadline'],
            'months_left' => $item['money']['months_left'],
            'expected_sale_price' => $item['car']->expected_sale_price,
        ];
        $yearAhead = CarbonImmutable::createFromTimestamp($now)->addYear()->getTimestamp();
        $renewal = $inFleet->filter(fn ($item) => $item['money']['fleet_deadline'] !== null)->sortBy(fn ($item) => $item['money']['fleet_deadline']);

        return [
            'fleet' => $inFleet->sortBy(fn ($item) => $item['money']['payback'] ?? INF)->map($summary)->values(),
            'sold_cars' => $sold->sortByDesc(fn ($item) => $item['car']->sold_at)->map(fn ($item) => [
                ...$summary($item),
                'sold_at' => $item['car']->sold_at,
                'sale_price' => $item['car']->sale_price,
                'result' => $item['money']['result'],
            ])->values(),
            'renewal' => $renewal->map($summary)->values(),
            'capital_next_12_months' => (int) $renewal->filter(fn ($item) => $item['money']['fleet_deadline'] < $yearAhead)->sum(fn ($item) => $item['car']->expected_sale_price),
        ];
    }

    /**
     * The contracts and expenses of the month, for the spreadsheet.
     */
    public function monthContracts(): Collection
    {
        return $this->contracts->filter(fn (Contract $contract) => $contract->ends_at > $this->from->getTimestamp())->values();
    }

    public function monthExpenses(): Collection
    {
        return $this->between($this->expenses, 'spent_at', $this->from, $this->to);
    }

    private function payroll(?CarbonImmutable $month = null): Collection
    {
        return $this->agency->salaryPayments()->with('employee')->where('month', ($month ?? $this->from)->format('Y-m'))->get();
    }

    private function overheadExpenses(Collection $expenses): Collection
    {
        // With employer charges computed from salaries, the CNSS payment is that same money.
        $excluded = $this->agency->employer_charges_rate > 0 ? [ Expense::CATEGORY_CNSS ] : [];

        return $expenses->whereIn('category', array_diff(Expense::AGENCY_CATEGORIES, $excluded));
    }

    /**
     * Cars that were in the fleet for part of [$from, $to): added before its end, not sold before its start.
     */
    private function carsIn(CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        return $this->agency->cars()->where('created_at', '<', $to->getTimestamp())
            ->where(fn ($query) => $query->whereNull('sold_at')->orWhere('sold_at', '>=', $from->getTimestamp()))
            ->orderBy('manufacturer')->get();
    }

    private function daysInFleet(Car $car, CarbonImmutable $from, CarbonImmutable $to): float
    {
        return $this->overlap($car->created_at, $car->sold_at ?? PHP_INT_MAX, $from, $to) / self::DAY;
    }

    private function between(Collection $items, string $column, CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        return $items->where($column, '>=', $from->getTimestamp())->where($column, '<', $to->getTimestamp());
    }

    private function overlap(int $startsAt, int $endsAt, CarbonImmutable $from, CarbonImmutable $to): int
    {
        return max(0, min($endsAt, $to->getTimestamp()) - max($startsAt, $from->getTimestamp()));
    }

    private function revenue(Collection $contracts, CarbonImmutable $from, CarbonImmutable $to): int
    {
        return (int) round($contracts->sum(fn (Contract $contract) =>
            $contract->daily_price * $this->overlap($contract->starts_at, $contract->ends_at, $from, $to) / self::DAY
            + ($contract->starts_at >= $from->getTimestamp() && $contract->starts_at < $to->getTimestamp() ? $contract->extrasPrice() : 0)
            + ($contract->returned_at >= $from->getTimestamp() && $contract->returned_at < $to->getTimestamp() ? $contract->chargesPrice() : 0)));
    }
}
