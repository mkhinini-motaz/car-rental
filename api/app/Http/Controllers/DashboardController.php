<?php

namespace App\Http\Controllers;

use App\Http\Resources\CarResource;
use App\Http\Resources\ContractResource;
use App\Http\Resources\EmployeeResource;
use App\Http\Resources\RecurringBillResource;
use App\Models\Agency;
use App\Models\Car;
use App\Models\Contract;
use App\Models\Expense;
use App\Support\CarMoney;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /**
     * The agency's movements over [starts_at, ends_at) (a day, or a week, in the phone's time
     * zone): cars going out and coming back, handled or not. A handled one counts at its real
     * time (handed over, returned), a pending one at its booked time. When the range holds
     * now, late pickups and overdue returns stay listed until they are dealt with.
     */
    public function show(Request $request)
    {
        $request->validate([
            'starts_at' => 'required|integer|min:0',
            'ends_at'   => 'required|integer|gt:starts_at|lte:' . ($request->integer('starts_at') + 31 * 24 * 60 * 60),
        ]);
        $agency = $request->user()->agency;
        $from = $request->integer('starts_at');
        $to = $request->integer('ends_at');
        $now = time();
        $holdsNow = $from <= $now && $now < $to;
        $contracts = fn () => $agency->contracts()->with([ 'car', 'client' ])->withSum('payments as paid', 'amount');
        $between = fn (string $column) => fn ($query) => $query->where($column, '>=', $from)->where($column, '<', $to);

        $pickups = $contracts()
            ->where(fn ($query) => $query->where(fn ($query) => $query->where('contracts.status', Contract::STATUS_RESERVED)->where($between('starts_at')))
                ->orWhere($between('picked_up_at'))
                ->when($holdsNow, fn ($query) => $query->orWhere(fn ($query) => $query->where('contracts.status', Contract::STATUS_RESERVED)->where('starts_at', '<', $from))))
            ->orderByRaw('coalesce(picked_up_at, starts_at)')->get();
        $returns = $contracts()
            ->where(fn ($query) => $query->where(fn ($query) => $query->where('contracts.status', Contract::STATUS_OUT)->where($between('ends_at')))
                ->orWhere($between('returned_at'))
                ->when($holdsNow, fn ($query) => $query->orWhere(fn ($query) => $query->where('contracts.status', Contract::STATUS_OUT)->where('ends_at', '<', $from))))
            ->orderByRaw('coalesce(returned_at, ends_at)')->get();

        // Back from their last rental and not ticked cleaned yet (a car out again drops off the list).
        $toClean = $agency->contracts()->with('car')
            ->whereIn('contracts.status', [ Contract::STATUS_RETURNED, Contract::STATUS_CLOSED ])->whereNull('cleaned_at')
            ->whereNotExists(fn ($query) => $query->from('contracts as later')->whereColumn('later.car_id', 'contracts.car_id')
                ->whereColumn('later.picked_up_at', '>', 'contracts.returned_at')->whereNull('later.deleted_at'))
            ->orderBy('returned_at')->get();

        // Physically at the agency and usable: not in maintenance, not handed over, not blocked now.
        $availableCars = $agency->cars()->inFleet()
            ->where('status', Car::STATUS_AVAILABLE)
            ->whereDoesntHave('contracts', fn ($query) => $query->where('status', Contract::STATUS_OUT))
            ->whereDoesntHave('blocks', fn ($query) => $query->overlapping($now, $now + 1))
            ->count();

        // Insurance, circulation tax or technical inspection expiring soon (the agency's setting), or expired.
        $limit = $now + $agency->expiry_warning_days * 24 * 60 * 60;
        $expiringCars = $agency->cars()->inFleet()
            ->where(fn ($query) => $query->where('insurance_ends_at', '<', $limit)
                ->orWhere('circulation_tax_ends_at', '<', $limit)
                ->orWhere('technical_control_ends_at', '<', $limit))
            ->orderBy('manufacturer')
            ->get();

        // Oil changes due (by date or kilometres). ponytail: one query per car, fine for a small fleet.
        $maintenanceDue = $agency->cars()->inFleet()->orderBy('manufacturer')->get()
            ->each(fn ($car) => $car->oil_change = $car->oilChange())
            ->filter(fn ($car) => $car->oil_change['is_due'] ?? false)
            ->values();

        return response()->json([ 'data' => [
            'pickups' => ContractResource::collection($pickups),
            'returns' => ContractResource::collection($returns),
            'to_clean' => ContractResource::collection($toClean), // right now, whatever the range
            'cars_available' => $availableCars,
            'cars_total' => $agency->cars()->inFleet()->count(),
            // Right now, whatever the range.
            'cars_out' => $agency->contracts()->where('contracts.status', Contract::STATUS_OUT)->count(),
            'overdue' => $agency->contracts()->where('contracts.status', Contract::STATUS_OUT)->where('ends_at', '<', $now)->count(),
            'expiring_cars' => CarResource::collection($expiringCars),
            'maintenance_due' => CarResource::collection($maintenanceDue),
            ...($request->user()->isOwner() ? $this->ownerDues($agency, $now) : []),
        ] ]);
    }

    const WEEK = 7 * 24 * 60 * 60;

    /**
     * Money the owner has to pay soon, each one tap away in the app (nothing is paid by itself):
     * credit instalments and recurring bills due within a week, salaries still due from the 25th,
     * and cars within six months of the end of their time in the fleet.
     */
    private function ownerDues(Agency $agency, int $now): array
    {
        $cars = $agency->cars()->inFleet()->with('agency')->orderBy('manufacturer')->get();
        $instalments = $cars->filter(fn (Car $car) => $car->instalment_amount && $car->instalment_months)
            ->map(fn (Car $car) => [ 'car' => new CarResource($car), ...CarMoney::financing($car, $car->expenses()->where('category', Expense::CATEGORY_INSTALMENT)->count()) ])
            ->filter(fn ($due) => $due['next_due_at'] !== null && $due['next_due_at'] < $now + self::WEEK)
            ->sortBy('next_due_at')->values();
        $deadlines = $cars->map(fn (Car $car) => [ 'car' => new CarResource($car), 'deadline' => $car->fleetDeadline() ])
            ->filter(fn ($item) => $item['deadline'] !== null && $item['deadline'] < CarbonImmutable::createFromTimestamp($now)->addMonths(6)->getTimestamp())
            ->sortBy('deadline')->values();

        $today = CarbonImmutable::createFromTimestamp($now, Agency::TIMEZONE);
        $month = $today->format('Y-m');
        $salaries = $today->day >= 25 ?
            $agency->employees()->where('active', true)->with([ 'salaryPayments' => fn ($query) => $query->where('month', $month) ])->get()
                ->map(fn ($employee) => [ 'due' => $employee->dueFor($month), 'employee' => $employee ])
                ->filter(fn ($item) => $item['due'] > 0)
                ->map(fn ($item) => [ 'employee' => new EmployeeResource($item['employee']->unsetRelation('salaryPayments')), 'due' => $item['due'] ])->values() :
            collect();

        return [
            'instalments_due' => $instalments,
            'bills_due' => RecurringBillResource::collection($agency->recurringBills()->with('branch')->where('next_due_at', '<', $now + self::WEEK)->orderBy('next_due_at')->get()),
            'salaries_due' => $salaries,
            'fleet_deadlines' => $deadlines,
        ];
    }
}
