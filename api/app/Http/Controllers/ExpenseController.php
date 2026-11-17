<?php

namespace App\Http\Controllers;

use App\Http\Resources\ExpenseResource;
use App\Http\Resources\ResourceCollection;
use App\Models\Expense;
use App\Models\Payment;
use App\Support\BranchScope;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ExpenseController extends Controller
{
    /**
     * The agency's expenses, newest first, optionally for one car and between two dates.
     */
    public function index(Request $request)
    {
        $agency = $request->user()->agency;
        $request->validate([
            'page'    => 'integer|min:1',
            'perPage' => 'integer|min:1|max:100',
            'car_id'  => 'nullable|integer',
            'from'    => 'nullable|integer|min:0',
            'to'      => 'nullable|integer|gt:from',
            'group'   => 'nullable|in:car,agency', // car costs or the agency's own
        ]);

        $expenses = $agency->expenses()
            ->with([ 'car', 'branch', 'employee' ])
            // Managers see car running costs only: not the agency's overhead or the car instalments.
            ->when(! $request->user()->isOwner(), fn ($query) => $query->whereIn('category', array_diff(Expense::CAR_CATEGORIES, [ Expense::CATEGORY_INSTALMENT ])))
            ->when(BranchScope::branchId(), fn ($query) => $query->whereIn('car_id', $agency->cars()->select('cars.id'))) // their branch's cars
            ->when($request->filled('car_id'), fn ($query) => $query->where('car_id', $request->integer('car_id')))
            ->when($request->filled('group'), fn ($query) => $query->whereIn('category', $request->input('group') === 'car' ? Expense::CAR_CATEGORIES : Expense::AGENCY_CATEGORIES))
            ->when($request->filled('from'), fn ($query) => $query->where('spent_at', '>=', $request->integer('from')))
            ->when($request->filled('to'), fn ($query) => $query->where('spent_at', '<', $request->integer('to')))
            ->orderByDesc('spent_at')
            ->paginate($request->integer('perPage', 20), [ '*' ], 'page', $request->integer('page', 1));

        return ResourceCollection::jsonResponse($expenses);
    }

    /**
     * A car cost (on a car, or a repair tied to the contract that caused it) or an agency cost
     * (for a branch, or phone credit for an employee). Instalments need their car.
     */
    public function store(Request $request)
    {
        $agency = $request->user()->agency;
        $data = $request->validate([
            'car_id'      => [ 'nullable', 'integer', Rule::exists('cars', 'id')->whereIn('id', $agency->cars()->select('cars.id')) ],
            'branch_id'   => [ 'nullable', 'integer', Rule::exists('branches', 'id')->where('agency_id', $agency->id)->whereNull('deleted_at') ],
            'employee_id' => [ 'nullable', 'integer', Rule::exists('employees', 'id')->where('agency_id', $agency->id)->whereNull('deleted_at') ],
            'contract_id' => [ 'nullable', 'integer', Rule::exists('contracts', 'id')->whereIn('car_id', $agency->cars()->select('id')) ],
            'category'    => [ 'required', Rule::in(Expense::CATEGORIES) ],
            'amount'   => 'required|integer|min:1|max:100000000',
            'spent_at' => 'required|integer|min:0',
            'mileage'  => 'nullable|integer|min:0|max:2000000',
            'garage'   => 'nullable|string|max:255',
            'note'     => 'nullable|string|max:255',
            'method'   => [ 'sometimes', Rule::in(Payment::METHODS) ], // cash by default; only cash is in the cash book's balance
        ]);

        $isAgencyCost = in_array($data['category'], Expense::AGENCY_CATEGORIES, true);
        if ($isAgencyCost && (isset($data['car_id']) || isset($data['contract_id']))) {
            throw ValidationException::withMessages([ 'car_id' => 'expense:agency:no_car' ]);
        }
        if (isset($data['contract_id'])) {
            $data['car_id'] = $agency->contracts()->findOrFail($data['contract_id'])->car_id; // the repair is on that rental's car
        }
        if ($data['category'] === Expense::CATEGORY_INSTALMENT && ! isset($data['car_id'])) {
            throw ValidationException::withMessages([ 'car_id' => 'expense:instalment:car' ]);
        }
        if ($data['category'] === Expense::CATEGORY_INSTALMENT) {
            Gate::authorize('owner'); // paying for the car is the owner's side
        }

        if ($isAgencyCost) {
            $data['branch_id'] ??= $request->user()->branch_id; // a branch manager's costs are their branch's
        }
        $expense = $agency->expenses()->create([ ...$data, 'user_id' => $request->user()->id ]);

        return (new ExpenseResource($expense->load([ 'car', 'branch', 'employee' ])))->response()->setStatusCode(201);
    }

    public function destroy(Request $request, $expenseId)
    {
        $request->user()->agency->expenses()->findOrFail($expenseId)->delete();

        return response()->noContent();
    }
}
