<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SalaryPaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'employee_id' => $this->employee_id,
            'month' => $this->month,
            'type' => $this->type,
            'amount' => $this->amount,
            'paid_at' => $this->paid_at,
            'method' => $this->method,
            'note' => $this->note,
        ];
    }
}
