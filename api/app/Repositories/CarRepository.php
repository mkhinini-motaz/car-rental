<?php

namespace App\Repositories;

use App\Models\Agency;
use App\Models\Car;
use App\Models\Contract;

use function App\Support\Helpers\fieldsLike;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class CarRepository
{
    /**
     * Paginate the agency's cars
     *
     * @param Agency      $agency
     * @param int         $page
     * @param int         $perPage
     * @param string|null $search
     * @param string      $orderBy
     * @param string      $orderDirection
     * @param int|null    $contractFreeOnPeriodStart
     * @param int|null    $contractFreeOnPeriodEnd
     *
     * @return LengthAwarePaginator
     */
    public static function paginate(Agency $agency, $page = 1, $perPage = 20, $search = null, $orderBy = 'created_at', $orderDirection = 'desc', $contractFreeOnPeriodStart = null, $contractFreeOnPeriodEnd = null, bool $sold = false)
    {
        $cars = $agency->cars()->when($sold, fn ($query) => $query->whereNotNull('sold_at'), fn ($query) => $query->inFleet());

        if (isset($contractFreeOnPeriodStart) && isset($contractFreeOnPeriodEnd)) {
            $cars->where('status', Car::STATUS_AVAILABLE)
                // A car still out after its end date may not be back in time: flagged with that
                // date and listed last (NULLs sort first in SQLite and MySQL).
                ->withMax([ 'contracts as overdue_since' => fn ($query) => $query->where('status', Contract::STATUS_OUT)->where('ends_at', '<', time()) ], 'ends_at')
                ->orderBy('overdue_since')
                ->wherePossiblyAvailableInPeriod($contractFreeOnPeriodStart, $contractFreeOnPeriodEnd)
                ->withContractsInPeriod($contractFreeOnPeriodStart, $contractFreeOnPeriodEnd)
                ->orderByContractsCountForPeriod($contractFreeOnPeriodStart, $contractFreeOnPeriodEnd);
        } else {
            // Where each car is now, for the fleet list: its rental out, and a block covering now.
            $now = time();
            $cars->with([
                'contracts' => fn ($query) => $query->where('status', Contract::STATUS_OUT),
                'blocks' => fn ($query) => $query->overlapping($now, $now + 1),
            ]);
        }

        if (isset($search)) {
            $cars->where(fieldsLike($search, 'manufacturer', 'model_name', 'licence_plate'));
        }

        if (isset($orderBy) && isset($orderDirection)) {
            $cars->orderBy($orderBy, $orderDirection);
        }

        $cars = $cars->paginate($perPage, [ '*' ], 'page', $page);

        if (isset($contractFreeOnPeriodStart) && isset($contractFreeOnPeriodEnd)) {
            foreach ($cars as &$car) {
                $car->availability_in_period = $car->availabilityInPeriod($contractFreeOnPeriodStart, $contractFreeOnPeriodEnd);
            }
        }

        return $cars;
    }
}
