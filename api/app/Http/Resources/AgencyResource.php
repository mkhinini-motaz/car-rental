<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

use function App\Support\Helpers\fileUrl;

class AgencyResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'       => $this->id,
            'name'     => $this->name,
            'phone'    => $this->phone,
            'address'  => $this->address,
            'logo_url' => fileUrl($this->logo),
            'takes_deposit' => $this->takes_deposit,
            'default_deposit' => $this->default_deposit,
            'default_deposit_method' => $this->default_deposit_method,
            'tax_id' => $this->tax_id,
            'contract_terms' => $this->contract_terms,
            'pickup_time' => $this->pickup_time,
            'return_time' => $this->return_time,
            'expiry_warning_days' => $this->expiry_warning_days,
            'oil_warning_km' => $this->oil_warning_km,
            'oil_warning_days' => $this->oil_warning_days,
            'fleet_max_years' => $this->fleet_max_years,
            'employer_charges_rate' => $this->employer_charges_rate,
            'min_driver_age' => $this->min_driver_age, // 0: no rule
            'min_licence_years' => $this->min_licence_years,
            'vat_rate' => $this->vat_rate, // hundredths of a percent, included in prices; 0: not on invoices
            'fiscal_stamp' => $this->fiscal_stamp, // millimes added to an invoice; 0: none
            'theme' => $this->theme, // null: the apps' default palette
            'theme_mode' => $this->theme_mode,
            'staff' => $this->whenLoaded('users', fn () => $this->users->map->only([ 'id', 'first_name', 'last_name', 'branch_id' ])),
        ];
    }
}
