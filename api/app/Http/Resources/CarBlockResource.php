<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CarBlockResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'car_id' => $this->car_id,
            'starts_at' => $this->starts_at,
            'ends_at' => $this->ends_at,
            'reason' => $this->reason,
            'note' => $this->note,
        ];
    }
}
