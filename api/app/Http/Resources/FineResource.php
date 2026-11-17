<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FineResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'committed_at' => $this->committed_at,
            'amount' => $this->amount,
            'reference' => $this->reference,
            'note' => $this->note,
            'status' => $this->status,
            'settled_at' => $this->settled_at,
            'method' => $this->method,
            'paid_out_at' => $this->paid_out_at,
            'paid_out_method' => $this->paid_out_method,
            'car_id' => $this->car_id,
            'contract_id' => $this->contract_id,
            'client_id' => $this->client_id, // the renter named by staff when no rental in the app matches
            'car' => new CarResource($this->whenLoaded('car')),
            'contract' => new ContractResource($this->whenLoaded('contract')),
            'client' => new ClientResource($this->whenLoaded('client')),
        ];
    }
}
