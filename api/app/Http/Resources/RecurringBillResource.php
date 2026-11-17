<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RecurringBillResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'category' => $this->category,
            'amount' => $this->amount,
            'every_months' => $this->every_months,
            'next_due_at' => $this->next_due_at,
            'note' => $this->note,
            'branch_id' => $this->branch_id,
            'branch' => $this->whenLoaded('branch', fn () => $this->branch ? [ 'id' => $this->branch->id, 'name' => $this->branch->name ] : null),
        ];
    }
}
