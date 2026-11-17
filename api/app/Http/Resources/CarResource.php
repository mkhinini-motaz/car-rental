<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

use function App\Support\Helpers\fileUrl;

class CarResource extends JsonResource
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
            'agency_id' => $this->agency_id,
            'daily_price' => $this->daily_price,
            'licence_plate' => $this->licence_plate,
            'serial_number' => $this->serial_number,
            'manufacturer' => $this->manufacturer,
            'model_name' => $this->model_name,
            'model_year' => $this->model_year,
            'fiscal_horse_power' => $this->fiscal_horse_power,
            'number_of_cylinders' => $this->number_of_cylinders,
            'transmission_type' => $this->transmission_type,
            'fuel_type' => $this->fuel_type,
            'type' => $this->type,
            'first_circulation_date' => $this->first_circulation_date,
            'circulation_tax_ends_at' => $this->circulation_tax_ends_at,
            'insurance_ends_at' => $this->insurance_ends_at,
            'technical_control_ends_at' => $this->technical_control_ends_at,
            'colour' => $this->colour,
            'status' => $this->status,
            'mileage' => $this->mileage,
            'photo_url' => fileUrl($this->photo),
            'oil_change_every_km' => $this->oil_change_every_km,
            'oil_change_every_months' => $this->oil_change_every_months,
            'branch_id' => $this->branch_id,
            'sold_at' => $this->sold_at,
            // The owner's side: what it cost, its credit, its sale.
            $this->mergeWhen((bool) $request->user()?->isOwner(), fn () => [
                ...collect(\App\Models\Car::PURCHASE_FIELDS)->mapWithKeys(fn ($field) => [ $field => $this->$field ])->all(),
                'sale_price' => $this->sale_price,
                'buyer_name' => $this->buyer_name,
                'buyer_phone' => $this->buyer_phone,
                'sale_method' => $this->sale_method,
            ]),
            // On the car's page only: money earned and spent over its life, and the oil change.
            'revenue' => $this->whenHas('revenue'),
            'expenses_total' => $this->whenHas('expenses_total'),
            'profit' => $this->whenHas('profit'),
            'oil_change' => $this->whenHas('oil_change'),
            'money' => $this->whenHas('money'), // App\Support\CarMoney, owner only
            'incomes' => IncomeResource::collection($this->whenLoaded('incomes')),
            'documents' => DocumentResource::collection($this->whenLoaded('documents')), // papers
            'expenses' => ExpenseResource::collection($this->whenLoaded('expenses')),
            'contracts' => ContractResource::collection($this->whenLoaded('contracts')),
            'blocks' => CarBlockResource::collection($this->whenLoaded('blocks')),
            'damages' => ContractDamageResource::collection($this->whenLoaded('damages')), // on the car's page: its damage history
            'availability_in_period' => $this->when($this->availability_in_period, $this->availability_in_period),
            'overdue_since' => $this->whenHas('overdue_since'), // in the search: the end date of a rental not back yet

            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
