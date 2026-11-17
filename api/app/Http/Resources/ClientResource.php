<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClientResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'phone' => $this->phone,
            'gender' => $this->gender,
            'id_number' => $this->id_number,
            'driver_licence_number' => $this->driver_licence_number,
            'driver_licence_delivery_date' => $this->driver_licence_delivery_date,
            'driver_licence_expiry_date' => $this->driver_licence_expiry_date,
            'birth_date' => $this->birth_date,
            'flag' => $this->flag,
            'notes' => $this->notes,
            'rentals_before' => (int) $this->rentals_before, // rented before the app, on paper
            // Flagged clients who are this person (same phone, ID or licence), on the client's page.
            'warnings' => $this->whenLoaded('warnings', fn () => $this->warnings->map(fn ($client) => [
                'id' => $client->id,
                'first_name' => $client->first_name,
                'last_name' => $client->last_name,
                'flag' => $client->flag,
                'notes' => $client->notes,
                'matched_on' => $client->matched_on,
            ])),
            'stats' => $this->whenHas('stats'), // App\Support\ClientStats, on the client's page
            'eligibility' => $this->whenHas('eligibility'), // Client::eligibilityIssues(), on the client's page
            'agency_id' => $this->agency_id,
            'contracts' => ContractResource::collection($this->whenLoaded('contracts')),
            'documents' => DocumentResource::collection($this->whenLoaded('documents')), // ID, licence
            'created_at' => $this->created_at,
            'updated_at'=> $this->updated_at,
        ];
    }
}
