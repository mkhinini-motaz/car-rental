<?php

namespace App\Support;

use App\Models\Activity;
use App\Models\Agency;
use App\Models\Contract;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * A rental kept on paper before the app (the notebook), entered in one go: handed over at its
 * start and back at its end, with no inspection, no deposit, and no ID or licence asked, since
 * the car is long back. Paid in full it is closed; otherwise it stays returned with the rest owed.
 * Used by POST contract/past and the agency import.
 */
class PastRental
{
    public static function rules(Agency $agency): array
    {
        $record = fn (string $table) => Rule::exists($table, 'id')->where('agency_id', $agency->id)->whereNull('deleted_at');

        return [
            'car_id'         => [ 'required', 'integer', $record('cars') ],
            'client_id'      => [ 'required', 'integer', $record('clients') ],
            'starts_at'      => 'required|integer|min:0',
            'ends_at'        => 'required|integer|gt:starts_at|max:' . (time() + 5 * 60), // over already
            'daily_price'    => 'nullable|integer|min:0|max:10000000', // the car's price by default
            'paid'           => 'nullable|integer|min:0|max:100000000', // null: paid in full
            'method'         => [ 'nullable', Rule::in(Payment::METHODS) ], // cash by default
            'pickup_mileage' => 'nullable|integer|min:0|max:2000000',
            'return_mileage' => 'nullable|integer|min:0|max:2000000',
            'note'           => 'nullable|string|max:1000',
        ];
    }

    /**
     * Saves validated data (self::rules). The car must be free then, as for any booking. The
     * mileage stays on the rental: the car's odometer is today's, not the notebook's.
     */
    public static function record(Agency $agency, array $data): Contract
    {
        if (isset($data['pickup_mileage'], $data['return_mileage']) && $data['return_mileage'] < $data['pickup_mileage']) {
            throw ValidationException::withMessages([ 'return_mileage' => __('validation.gte.numeric', [ 'attribute' => 'return mileage', 'value' => $data['pickup_mileage'] ]) ]);
        }

        return DB::transaction(function () use ($agency, $data) {
            $car = Contract::lockFreeCar($agency, $data['car_id'], $data['starts_at'], $data['ends_at'], 'starts_at');
            $contract = $car->contracts()->make([
                'client_id' => $data['client_id'],
                'daily_price' => $data['daily_price'] ?? $car->daily_price,
                'starts_at' => $data['starts_at'],
                'ends_at' => $data['ends_at'],
                'note' => $data['note'] ?? null,
            ]);
            $contract->forceFill([
                'picked_up_at' => $data['starts_at'],
                'pickup_mileage' => $data['pickup_mileage'] ?? null,
                'returned_at' => $data['ends_at'],
                'return_mileage' => $data['return_mileage'] ?? null,
                'cleaned_at' => $data['ends_at'], // long washed
            ]);
            $paid = $data['paid'] ?? $contract->totalPrice();
            $contract->status = $paid >= $contract->totalPrice() ? Contract::STATUS_CLOSED : Contract::STATUS_RETURNED;
            $contract->closed_at = $contract->status === Contract::STATUS_CLOSED ? $data['ends_at'] : null;
            $contract->save();
            Activity::record($contract, 'recorded', [ 'amount' => $paid ]);
            if ($paid > 0) {
                // Tunisian agencies are paid as the car goes out.
                $contract->payments()->create([ 'amount' => $paid, 'method' => $data['method'] ?? Payment::METHOD_CASH, 'paid_at' => $data['starts_at'], 'user_id' => auth()->id() ]);
            }

            return $contract;
        });
    }
}
