<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EmployeeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'phone' => $this->phone,
            'role_label' => $this->role_label,
            'monthly_salary' => $this->monthly_salary,
            'hired_at' => $this->hired_at,
            'active' => $this->active,
            'user_id' => $this->user_id,
            // This month: paid (salary, advances, bonuses) and still due.
            'paid_this_month' => $this->whenHas('paid_this_month'),
            'due_this_month' => $this->whenHas('due_this_month'),
            'payments' => SalaryPaymentResource::collection($this->whenLoaded('salaryPayments')),
            'year_total' => $this->whenHas('year_total'),
        ];
    }
}
