<?php

namespace App\Http\Resources;

use App\Models\Fine;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ContractResource extends JsonResource
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
            'status' => $this->status,
            'starts_at' => $this->starts_at,
            'ends_at' => $this->ends_at,
            'daily_price' => $this->daily_price,
            'extras' => $this->extras ?? [],
            'rent_price' => $this->rentPrice(),
            'extras_price' => $this->extrasPrice(),
            'charges' => $this->charges ?? [],
            'charges_price' => $this->chargesPrice(),
            'total_price' => $this->totalPrice(),
            // Rent paid so far, where the query summed it (`withSum('payments as paid', 'amount')`).
            'paid' => $this->when(array_key_exists('paid', $this->getAttributes()), fn () => (int) $this->paid),
            'note' => $this->note,
            'source' => $this->source, // Contract::SOURCES, null when not said
            'broker' => $this->broker,
            'commission' => (int) $this->commission, // millimes, the broker's
            'signature' => $this->signature, // SVG path in a 600 × 200 box, drawn by the client
            'signed_at' => $this->signed_at,
            'invoice_number' => $this->invoice_number, // given with the first invoice
            'picked_up_at' => $this->picked_up_at,
            'pickup_mileage' => $this->pickup_mileage,
            'returned_at' => $this->returned_at,
            'return_mileage' => $this->return_mileage,
            'deposit' => $this->deposit,
            'deposit_method' => $this->deposit_method,
            'deposit_kept' => $this->deposit_kept,
            'deposit_kept_reason' => $this->deposit_kept_reason,
            'deposit_returned' => $this->deposit_returned,
            // Still held (less fines and payments taken from it), where both are loaded (the contract page).
            'deposit_available' => $this->when($this->relationLoaded('payments') && $this->relationLoaded('fines'), fn () => $this->deposit
                - $this->fines->where('status', Fine::STATUS_FROM_DEPOSIT)->sum('amount')
                - $this->payments->where('method', Payment::METHOD_DEPOSIT)->sum('amount')),
            'closed_at' => $this->closed_at,
            'pickup_user_id' => $this->pickup_user_id, // staff handing the car over
            'return_user_id' => $this->return_user_id, // staff taking it back, then cleaning it
            'cleaned_at' => $this->cleaned_at, // after the return; null: still to clean
            'pickup_location' => $this->pickup_location,
            'return_location' => $this->return_location,
            'car_id' => $this->car_id,
            'client_id' => $this->client_id,
            'second_driver_id' => $this->second_driver_id,
            'car' => new CarResource($this->whenLoaded('car')),
            'client' => new ClientResource($this->whenLoaded('client')),
            'second_driver' => new ClientResource($this->whenLoaded('secondDriver')),
            'activities' => ActivityResource::collection($this->whenLoaded('activities')),
            'payments' => PaymentResource::collection($this->whenLoaded('payments')),
            'photos' => ContractPhotoResource::collection($this->whenLoaded('photos')),
            'damages' => ContractDamageResource::collection($this->whenLoaded('damages')),
            // Before and during the rental: the car's damages from earlier rentals, not repaired yet.
            'car_damages' => ContractDamageResource::collection($this->whenLoaded('carDamages')),
            'fines' => FineResource::collection($this->whenLoaded('fines')),
            'fines_from_deposit' => $this->when($this->relationLoaded('fines'), fn () => (int) $this->fines->where('status', Fine::STATUS_FROM_DEPOSIT)->sum('amount')),
        ];
    }
}
