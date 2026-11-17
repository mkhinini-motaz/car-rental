<?php

namespace App\Http\Controllers;

use App\Http\Resources\EmployeeResource;
use App\Http\Resources\SalaryPaymentResource;
use App\Models\Agency;
use App\Models\Employee;
use App\Models\Payment;
use App\Models\SalaryPayment;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Payroll, owner only (the whole controller sits in the `can:owner` group): employees, what
 * they earn, and what they were paid month by month.
 */
class EmployeeController extends Controller
{
    /**
     * Employees, active first, each with what was paid and what is still due this month.
     */
    public function index(Request $request)
    {
        $month = CarbonImmutable::now(Agency::TIMEZONE)->format('Y-m');
        $employees = $request->user()->agency->employees()
            ->with([ 'salaryPayments' => fn ($query) => $query->where('month', $month) ])
            ->orderByDesc('active')->orderBy('first_name')->get()
            ->each(function (Employee $employee) use ($month) {
                $employee->paid_this_month = (int) $employee->salaryPayments->sum('amount');
                $employee->due_this_month = $employee->active ? $employee->dueFor($month) : 0;
            });

        return EmployeeResource::collection($employees->each->unsetRelation('salaryPayments'));
    }

    /**
     * One employee with every payment, newest first, and this year's total.
     */
    public function show(Request $request, $employeeId)
    {
        $employee = $this->findEmployee($request, $employeeId)->load([ 'salaryPayments' => fn ($query) => $query->orderByDesc('paid_at') ]);
        $now = CarbonImmutable::now(Agency::TIMEZONE);
        $employee->paid_this_month = (int) $employee->salaryPayments->where('month', $now->format('Y-m'))->sum('amount');
        $employee->due_this_month = $employee->active ? $employee->dueFor($now->format('Y-m')) : 0;
        $employee->year_total = (int) $employee->salaryPayments->filter(fn ($payment) => str_starts_with($payment->month, $now->format('Y')))->sum('amount');

        return new EmployeeResource($employee);
    }

    public function store(Request $request)
    {
        $employee = $request->user()->agency->employees()->create($request->validate($this->rules($request)));

        return (new EmployeeResource($employee->refresh()))->response()->setStatusCode(201);
    }

    public function update(Request $request, $employeeId)
    {
        $employee = $this->findEmployee($request, $employeeId);
        $employee->update($request->validate($this->rules($request)));

        return new EmployeeResource($employee);
    }

    /**
     * A salary, an advance (it reduces what's due at the end of the month) or a bonus.
     */
    public function storePayment(Request $request, $employeeId)
    {
        $employee = $this->findEmployee($request, $employeeId);
        $data = $request->validate([
            'type'    => [ 'required', Rule::in(SalaryPayment::TYPES) ],
            'amount'  => 'required|integer|min:1|max:100000000',
            'month'   => 'nullable|date_format:Y-m', // the month it counts for; this month by default
            'paid_at' => 'nullable|integer|min:0',
            'method'  => [ 'required', Rule::in(Payment::METHODS) ],
            'note'    => 'nullable|string|max:255',
        ]);
        $payment = $employee->salaryPayments()->create([
            ...$data,
            'month' => $data['month'] ?? CarbonImmutable::now(Agency::TIMEZONE)->format('Y-m'),
            'paid_at' => $data['paid_at'] ?? time(),
            'user_id' => $request->user()->id,
        ]);

        return (new SalaryPaymentResource($payment))->response()->setStatusCode(201);
    }

    public function destroyPayment(Request $request, $employeeId, $paymentId)
    {
        $this->findEmployee($request, $employeeId)->salaryPayments()->findOrFail($paymentId)->delete();

        return response()->noContent();
    }

    private function findEmployee(Request $request, $employeeId): Employee
    {
        return $request->user()->agency->employees()->findOrFail($employeeId);
    }

    private function rules(Request $request): array
    {
        return [
            'first_name'     => 'required|string|max:100',
            'last_name'      => 'nullable|string|max:100',
            'phone'          => [ 'nullable', 'string', 'regex:/^\+216[234579]\d{7}$/' ],
            'role_label'     => 'nullable|string|max:50',
            'monthly_salary' => 'required|integer|min:0|max:100000000',
            'hired_at'       => 'nullable|integer|min:0',
            'active'         => 'boolean',
            'user_id'        => [ 'nullable', 'integer', Rule::exists('users', 'id')->where('agency_id', $request->user()->agency_id) ],
        ];
    }
}
