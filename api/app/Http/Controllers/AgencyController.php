<?php

namespace App\Http\Controllers;

use App\Http\Resources\AgencyResource;
use App\Models\Agency;
use App\Models\Payment;
use App\Support\Pricing;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Storage;
use function App\Support\Helpers\uploadFile;

class AgencyController extends Controller
{
    public function show(Request $request)
    {
        // The staff, to pick who hands a car over or takes it back.
        return new AgencyResource($request->user()->agency->load([ 'users' => fn ($query) => $query->orderBy('first_name') ]));
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'name'    => 'sometimes|required|string|max:255',
            'phone'   => [ 'nullable', 'string', 'regex:/^\+216[234579]\d{7}$/' ],
            'address' => 'nullable|string|max:255',
            // Many agencies take no deposit: then the pickup doesn't ask for one.
            'takes_deposit'          => 'sometimes|boolean',
            'default_deposit'        => 'sometimes|integer|min:0|max:100000000',
            'default_deposit_method' => [ 'sometimes', Rule::in(Payment::METHODS) ],
            'tax_id'                 => 'sometimes|nullable|string|max:30',
            'contract_terms'         => 'sometimes|nullable|string|max:10000',
            'pickup_time'            => 'sometimes|date_format:H:i',
            'return_time'            => 'sometimes|date_format:H:i',
            'expiry_warning_days'    => 'sometimes|integer|min:1|max:90',
            'oil_warning_km'         => 'sometimes|integer|min:0|max:5000',
            'oil_warning_days'       => 'sometimes|integer|min:0|max:60',
            'fleet_max_years'        => 'sometimes|integer|min:1|max:15',
            'employer_charges_rate'  => 'sometimes|integer|min:0|max:5000',
            // Who may rent (0: no rule). Breaking one only warns, on the client and when booking.
            'min_driver_age'         => 'sometimes|integer|min:0|max:30',
            'min_licence_years'      => 'sometimes|integer|min:0|max:10',
            // Invoices: VAT included in the prices (1900 = 19 %) and the fiscal stamp (0: none).
            'vat_rate'               => 'sometimes|integer|min:0|max:3000',
            'fiscal_stamp'           => 'sometimes|integer|min:0|max:100000',
            // The look every staff member sees.
            'theme'                  => [ 'sometimes', 'nullable', Rule::in(Agency::THEMES) ],
            'theme_mode'             => [ 'sometimes', Rule::in(Agency::THEME_MODES) ],
        ]);
        $agency = $request->user()->agency;
        $agency->update($data);

        return new AgencyResource($agency);
    }

    public function pricing(Request $request)
    {
        return response()->json([ 'data' => Pricing::rules($request->user()->agency) ]);
    }

    /**
     * Replaces the pricing rules (see App\Support\Pricing for their shape).
     */
    public function updatePricing(Request $request)
    {
        $data = $request->validate([
            'seasons'             => 'present|array|max:10',
            'seasons.*.name'      => 'required|string|max:50',
            'seasons.*.from'      => 'required|date_format:d/m',
            'seasons.*.to'        => 'required|date_format:d/m',
            'seasons.*.percent'   => 'required|integer|min:-90|max:300',
            'discounts'           => 'present|array|max:10',
            'discounts.*.min_days' => 'required|integer|min:2|max:365',
            'discounts.*.percent' => 'required|integer|min:1|max:90',
            'extras'              => 'present|array|max:20',
            'extras.*.name'       => 'required|string|max:50',
            'extras.*.price'      => 'required|integer|min:0|max:10000000',
            'extras.*.per'        => 'required|in:rental,day',
            'second_driver_price' => 'sometimes|integer|min:0|max:10000000',
            'locations'           => 'sometimes|array|max:20',
            'locations.*.name'    => 'required|string|max:100',
            'locations.*.fee'     => 'required|integer|min:0|max:10000000',
            'charge_extra_km'     => 'sometimes|boolean',
            'km_per_day'          => 'sometimes|integer|min:0|max:10000',
            'extra_km_price'      => 'sometimes|integer|min:0|max:100000',
            'late_grace_hours'    => 'sometimes|integer|min:0|max:24',
            'late_per'            => 'sometimes|in:none,hour,day',
            'late_hour_price'     => 'sometimes|integer|min:0|max:10000000',
            'washing_price'       => 'sometimes|integer|min:0|max:10000000',
        ]);
        $agency = $request->user()->agency;
        $agency->pricing = [
            ...Pricing::rules($agency),
            ...$data,
            'seasons' => array_values($data['seasons']),
            'discounts' => collect($data['discounts'])->sortBy('min_days')->values()->all(),
            'extras' => array_values($data['extras']),
            'locations' => array_values($data['locations'] ?? Pricing::rules($agency)['locations']),
            'charge_extra_km' => $request->boolean('charge_extra_km', Pricing::rules($agency)['charge_extra_km']),
        ];
        $agency->save();

        return response()->json([ 'data' => Pricing::rules($agency) ]);
    }

    public function logo(Request $request)
    {
        $request->validate([ 'logo' => 'required|image|max:4096' ]);
        $agency = $request->user()->agency;

        $oldLogo = $agency->logo;
        $agency->logo = uploadFile($request->file('logo'), "agencies/{$agency->id}");
        $agency->save();
        if ($oldLogo) {
            Storage::delete($oldLogo);
        }

        return new AgencyResource($agency);
    }
}
