<?php

namespace App\Http\Requests;

use App\Models\Client;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ClientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Only the name and phone are required: phone bookings rarely come with ID or licence details.
     */
    public function rules(): array
    {
        return self::fields($this->user()->agency_id, $this->route('clientId'));
    }

    /**
     * Also checks the agency import's rows (App\Console\Commands\ImportAgency).
     */
    public static function fields(int $agencyId, $clientId = null): array
    {
        return [
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'phone' => [
                'required', 'string', 'regex:/^\+216[234579]\d{7}$/',
                Rule::unique('clients')->where('agency_id', $agencyId)->ignore($clientId),
            ],
            'gender' => [ 'nullable', Rule::in([ Client::GENDER_MALE, Client::GENDER_FEMALE ]) ],
            'birth_date' => 'nullable|date_format:d/m/Y|before:today',
            'id_number' => 'nullable|string|max:20',
            'driver_licence_number' => 'nullable|string|max:20',
            'driver_licence_delivery_date' => 'nullable|date_format:d/m/Y|before_or_equal:today',
            'driver_licence_expiry_date' => 'nullable|date_format:d/m/Y',
            'flag' => [ 'sometimes', 'nullable', Rule::in(Client::FLAGS) ],
            'notes' => 'sometimes|nullable|string|max:2000',
            'rentals_before' => 'sometimes|integer|min:0|max:1000', // rented before the app, on paper
        ];
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('phone'))) {
            $this->merge([ 'phone' => str_replace(' ', '', $this->input('phone')) ]);
        }
    }
}
