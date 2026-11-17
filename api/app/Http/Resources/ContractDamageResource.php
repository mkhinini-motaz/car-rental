<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ContractDamageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'stage' => $this->stage,
            'x' => $this->x,
            'y' => $this->y,
            'note' => $this->note,
            'amount' => $this->amount,
            'contract_id' => $this->contract_id,
            'repaired_at' => $this->repaired_at, // null: still on the car
            'created_at' => $this->created_at,
        ];
    }
}
