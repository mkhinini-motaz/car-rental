<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExpenseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'category' => $this->category,
            'amount' => $this->amount,
            'spent_at' => $this->spent_at,
            'mileage' => $this->mileage,
            'garage' => $this->garage,
            'note' => $this->note,
            'method' => $this->method,
            'car_id' => $this->car_id,
            'car' => new CarResource($this->whenLoaded('car')),
            'branch_id' => $this->branch_id,
            'branch' => $this->whenLoaded('branch', fn () => $this->branch ? [ 'id' => $this->branch->id, 'name' => $this->branch->name ] : null),
            'employee_id' => $this->employee_id,
            'employee' => $this->whenLoaded('employee', fn () => $this->employee ? [ 'id' => $this->employee->id, 'first_name' => $this->employee->first_name, 'last_name' => $this->employee->last_name ] : null),
            'contract_id' => $this->contract_id,
        ];
    }
}
