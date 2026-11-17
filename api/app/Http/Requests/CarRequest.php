<?php

namespace App\Http\Requests;

use App\Models\Car;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The car's registration card (carte grise) details, its price, and how the agency tracks it.
 */
class CarRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return self::fields($this->user()->agency_id, $this->route('carId'));
    }

    /**
     * Also checks the agency import's rows (App\Console\Commands\ImportAgency).
     */
    public static function fields(int $agencyId, $carId = null): array
    {
        return [
            'daily_price' => 'required|integer|min:1|max:10000000',
            // Plates and VINs are unique in the country, so across agencies too (and the columns are unique).
            'licence_plate' => [ 'required', 'string', 'max:20', Rule::unique('cars')->ignore($carId) ],
            'serial_number' => [ 'required', 'string', 'max:30', Rule::unique('cars')->ignore($carId) ],
            'manufacturer' => 'required|string|max:50',
            'model_name' => 'required|string|max:50',
            'model_year' => 'required|integer|min:1980|max:' . (date('Y') + 1),
            'fiscal_horse_power' => 'required|integer|min:1|max:99',
            'number_of_cylinders' => 'required|integer|min:1|max:16',
            'transmission_type' => [ 'required', Rule::in(Car::TRANSMISSION_TYPES) ],
            'fuel_type' => [ 'required', Rule::in(Car::FUEL_TYPES) ],
            'type' => [ 'required', Rule::in(Car::TYPES) ],
            'first_circulation_date' => 'required|date_format:d/m/Y|before_or_equal:today',
            'circulation_tax_ends_at' => 'required|integer|min:0',
            'insurance_ends_at' => 'required|integer|min:0',
            'technical_control_ends_at' => 'required|integer|min:0',
            // A swatch (#rrggbb) or the name of a colour the palette doesn't have.
            'colour' => [ 'nullable', 'string', 'max:30', 'regex:/^(#[0-9a-fA-F]{6}|[^#].*)$/u' ],
            'status' => [ 'sometimes', Rule::in(Car::STATUSES) ],
            'mileage' => 'nullable|integer|min:0|max:2000000',
            'oil_change_every_km' => 'sometimes|integer|min:1000|max:100000',
            'oil_change_every_months' => 'sometimes|integer|min:1|max:36',
            'branch_id' => [ 'sometimes', 'nullable', 'integer', Rule::exists('branches', 'id')->where('agency_id', $agencyId)->whereNull('deleted_at') ], // its home branch
        ];
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('licence_plate'))) {
            $this->merge([ 'licence_plate' => Car::normalizePlate($this->input('licence_plate')) ]);
        }
        if (is_string($this->input('serial_number'))) {
            $this->merge([ 'serial_number' => strtoupper(trim($this->input('serial_number'))) ]);
        }
    }
}
