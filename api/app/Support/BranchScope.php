<?php

namespace App\Support;

use App\Models\Car;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

/**
 * A manager tied to a branch works on that branch's cars and the cars in no branch. On Car
 * it filters the cars; on a model with a `car_id` (contracts, fines) it follows the car, so
 * another branch's record is a 404 like another agency's. Owners, managers without a branch
 * and requests without a user (signed links, the scheduler) see the whole agency.
 */
class BranchScope implements Scope
{
    public function apply(Builder $query, Model $model): void
    {
        $branchId = self::branchId();
        if (! $branchId) {
            return;
        }

        $inBranch = fn ($query) => $query->where('cars.branch_id', $branchId)->orWhereNull('cars.branch_id');
        if ($model instanceof Car) {
            $query->where($inBranch);
        } else {
            $query->whereIn($model->qualifyColumn('car_id'), Car::withoutGlobalScopes()->select('cars.id')->where($inBranch));
        }
    }

    /**
     * The branch the signed-in user is limited to, if any.
     */
    public static function branchId(): ?int
    {
        $user = auth()->user();

        return $user && ! $user->isOwner() ? $user->branch_id : null;
    }
}
