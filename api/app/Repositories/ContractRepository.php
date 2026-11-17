<?php

namespace App\Repositories;

use App\Models\Agency;

use function App\Support\Helpers\fieldsLike;
use function App\Support\Helpers\firstNameLastNameLike;
use function App\Support\Helpers\occursInPeriod;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class ContractRepository
{
    /**
     * Paginate the agency's contracts
     *
     * @param Agency      $agency
     * @param int         $page
     * @param int         $perPage
     * @param string|null $search
     * @param string      $orderBy
     * @param string      $orderDirection
     * @param int|null    $periodStart
     * @param int|null    $periodEnd
     * @param int[]|null  $statuses
     *
     * @return LengthAwarePaginator
     */
    public static function paginate(Agency $agency, $page = 1, $perPage = 20, $search = null, $orderBy = 'created_at', $orderDirection = 'desc', $periodStart = null, $periodEnd = null, $statuses = null)
    {
        $contracts = $agency->contracts()
            ->with([ 'client', 'car' ])
            ->withSum('payments as paid', 'amount');

        if (isset($statuses)) {
            $contracts->whereIn('contracts.status', $statuses);
        }

        if (isset($periodStart) && isset($periodEnd)) {
            $contracts->where(occursInPeriod('starts_at', 'ends_at', $periodStart, $periodEnd));
        }

        if (isset($search)) {
            $contracts->where(function($query) use ($search) {
                $query->whereHas('car', fieldsLike($search, 'manufacturer', 'model_name', 'licence_plate'))
                    ->orWhereHas('client', firstNameLastNameLike($search));
            });
        }

        if (isset($orderBy) && isset($orderDirection)) {
            $contracts->orderBy('contracts.' . $orderBy, $orderDirection);
        }

        return $contracts->paginate($perPage, [ '*' ], 'page', $page);
    }
}