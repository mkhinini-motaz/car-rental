<?php

namespace App\Http\Controllers;

use App\Http\Resources\BranchResource;
use Illuminate\Http\Request;

/**
 * The agency's premises and their rent (owner only).
 */
class BranchController extends Controller
{
    public function index(Request $request)
    {
        return BranchResource::collection($request->user()->agency->branches()->orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $branch = $request->user()->agency->branches()->create($request->validate($this->rules()));

        return (new BranchResource($branch))->response()->setStatusCode(201);
    }

    public function update(Request $request, $branchId)
    {
        $branch = $request->user()->agency->branches()->findOrFail($branchId);
        $branch->update($request->validate($this->rules()));

        return new BranchResource($branch);
    }

    public function destroy(Request $request, $branchId)
    {
        $request->user()->agency->branches()->findOrFail($branchId)->delete();
        $request->user()->agency->users()->withTrashed()->where('branch_id', $branchId)->update([ 'branch_id' => null ]); // its managers see every branch again

        return response()->noContent();
    }

    private function rules(): array
    {
        return [
            'name'         => 'required|string|max:100',
            'address'      => 'nullable|string|max:255',
            'monthly_rent' => 'integer|min:0|max:100000000',
        ];
    }
}
