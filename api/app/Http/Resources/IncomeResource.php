<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class IncomeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'category' => $this->category,
            'amount' => $this->amount,
            'received_at' => $this->received_at,
            'method' => $this->method,
            'note' => $this->note,
            'car_id' => $this->car_id,
            'car' => new CarResource($this->whenLoaded('car')),
            'user' => $this->whenLoaded('user', fn () => $this->user ? [ 'id' => $this->user->id, 'first_name' => $this->user->first_name, 'last_name' => $this->user->last_name ] : null),
        ];
    }
}
