<?php

namespace App\Http\Controllers;

use App\Http\Resources\ExpenseResource;
use App\Http\Resources\RecurringBillResource;
use App\Models\Expense;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Bills that come back (rent, internet, accountant), owner only. Paying one records the expense
 * and moves the due date; nothing is paid by itself.
 */
class RecurringBillController extends Controller
{
    public function index(Request $request)
    {
        return RecurringBillResource::collection($request->user()->agency->recurringBills()->with('branch')->orderBy('next_due_at')->get());
    }

    public function store(Request $request)
    {
        $bill = $request->user()->agency->recurringBills()->create($request->validate($this->rules($request)));

        return (new RecurringBillResource($bill->load('branch')))->response()->setStatusCode(201);
    }

    public function update(Request $request, $billId)
    {
        $bill = $request->user()->agency->recurringBills()->findOrFail($billId);
        $bill->update($request->validate($this->rules($request)));

        return new RecurringBillResource($bill->load('branch'));
    }

    public function destroy(Request $request, $billId)
    {
        $request->user()->agency->recurringBills()->findOrFail($billId)->delete();

        return response()->noContent();
    }

    /**
     * Paid: an expense for this bill (the amount may differ this time), and the next due date.
     */
    public function pay(Request $request, $billId)
    {
        $agency = $request->user()->agency;
        $bill = $agency->recurringBills()->findOrFail($billId);
        $data = $request->validate([
            'amount' => 'sometimes|integer|min:1|max:100000000',
            'method' => [ 'required', Rule::in(Payment::METHODS) ],
        ]);

        $expense = $agency->expenses()->create([
            'category' => $bill->category, 'amount' => $data['amount'] ?? $bill->amount, 'spent_at' => time(), 'method' => $data['method'],
            'note' => $bill->note, 'branch_id' => $bill->branch_id, 'user_id' => $request->user()->id,
        ]);
        $bill->moveToNextDueDate();
        $bill->save();

        return (new ExpenseResource($expense))->response()->setStatusCode(201);
    }

    private function rules(Request $request): array
    {
        return [
            'category'     => [ 'required', Rule::in(Expense::AGENCY_CATEGORIES) ],
            'amount'       => 'required|integer|min:1|max:100000000',
            'every_months' => 'required|integer|min:1|max:24',
            'next_due_at'  => 'required|integer|min:0',
            'note'         => 'nullable|string|max:255',
            'branch_id'    => [ 'nullable', 'integer', Rule::exists('branches', 'id')->where('agency_id', $request->user()->agency_id)->whereNull('deleted_at') ],
        ];
    }
}
