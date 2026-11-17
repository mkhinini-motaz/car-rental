<?php

namespace App\Http\Controllers;

use App\Http\Resources\IncomeResource;
use App\Http\Resources\ResourceCollection;
use App\Models\Income;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Money received that isn't rent (owner only): insurance payouts, parts sold, other.
 */
class IncomeController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'page'    => 'integer|min:1',
            'perPage' => 'integer|min:1|max:100',
            'car_id'  => 'nullable|integer',
        ]);

        $incomes = $request->user()->agency->incomes()->with([ 'car', 'user' ])
            ->when($request->filled('car_id'), fn ($query) => $query->where('car_id', $request->integer('car_id')))
            ->orderByDesc('received_at')
            ->paginate($request->integer('perPage', 20), [ '*' ], 'page', $request->integer('page', 1));

        return ResourceCollection::jsonResponse($incomes);
    }

    public function store(Request $request)
    {
        $agency = $request->user()->agency;
        $data = $request->validate([
            'car_id'      => [ 'nullable', 'integer', Rule::exists('cars', 'id')->where('agency_id', $agency->id)->whereNull('deleted_at') ],
            'category'    => [ 'required', Rule::in(Income::CATEGORIES) ],
            'amount'      => 'required|integer|min:1|max:1000000000',
            'received_at' => 'nullable|integer|min:0',
            'method'      => [ 'sometimes', Rule::in(Payment::METHODS) ],
            'note'        => 'nullable|string|max:255',
        ]);
        $income = $agency->incomes()->create([ ...$data, 'received_at' => $data['received_at'] ?? time(), 'user_id' => $request->user()->id ]);

        return (new IncomeResource($income->load([ 'car', 'user' ])))->response()->setStatusCode(201);
    }

    public function destroy(Request $request, $incomeId)
    {
        $request->user()->agency->incomes()->findOrFail($incomeId)->delete();

        return response()->noContent();
    }
}
