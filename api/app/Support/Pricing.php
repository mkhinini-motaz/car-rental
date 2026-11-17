<?php

namespace App\Support;

use App\Models\Agency;
use App\Models\Car;
use App\Models\Contract;
use Carbon\CarbonImmutable;

/**
 * The agency's pricing rules, stored as JSON on `agencies.pricing`:
 *
 *   seasons:   [{ name, from: 'dd/mm', to: 'dd/mm', percent }]  every year; percent may be negative (low season)
 *   discounts: [{ min_days, percent }]                           the best one the rental's length reaches applies
 *   extras:    [{ name, price, per: 'rental'|'day' }]            price in millimes
 *   second_driver_price                                           per day, millimes; 0 (the default) = free
 *   locations: [{ name, fee }]                                    delivery places (airport, hotel), fee per trip; 0 = free
 *   charge_extra_km, km_per_day, extra_km_price                   off by default (Tunisian agencies don't charge kilometres);
 *                                                                 when on, the daily allowance and the price per extra km
 *   late_grace_hours, late_per: 'none'|'hour'|'day', late_hour_price
 *                                                                 lateness: hours tolerated, then charged per started
 *                                                                 hour, or per started day at the rental's price
 *   washing_price                                                 millimes, suggested when a car comes back dirty (staff can change it)
 *
 * The quote is only a suggestion: staff can always change the price on the contract.
 */
class Pricing
{
    const EMPTY = [
        'seasons' => [], 'discounts' => [], 'extras' => [], 'second_driver_price' => 0, 'locations' => [],
        'charge_extra_km' => false, 'km_per_day' => 0, 'extra_km_price' => 0, 'late_grace_hours' => 1, 'late_per' => 'none', 'late_hour_price' => 0,
        'washing_price' => 20000,
    ];

    const HOUR = 60 * 60;
    const DAY = 24 * self::HOUR;

    public static function rules(Agency $agency): array
    {
        return array_merge(self::EMPTY, $agency->pricing ?? []);
    }

    /**
     * The suggested daily price for renting $car over [$startsAt, $endsAt): each started day
     * at the car's price adjusted by the season it falls in, averaged, then less the
     * duration discount. Rounded to the dinar.
     */
    public static function quote(Agency $agency, Car $car, int $startsAt, int $endsAt): array
    {
        $rules = self::rules($agency);
        $dayPrices = [];
        $seasons = [];
        for ($time = $startsAt; $time < $endsAt; $time += 24 * 60 * 60) {
            $season = self::seasonOn($rules['seasons'], CarbonImmutable::createFromTimestamp($time, Agency::TIMEZONE));
            $dayPrices[] = $car->daily_price * (100 + ($season['percent'] ?? 0)) / 100;
            if ($season) {
                $seasons[$season['name']] = true;
            }
        }

        $days = ($endsAt - $startsAt) / (24 * 60 * 60);
        $discount = collect($rules['discounts'])->where('min_days', '<=', $days)->max('percent') ?? 0;
        $average = $dayPrices ? array_sum($dayPrices) / count($dayPrices) : $car->daily_price;

        return [
            'daily_price' => (int) (round($average * (100 - $discount) / 100 / 1000) * 1000),
            'base_price' => $car->daily_price,
            'seasons' => array_keys($seasons),
            'discount_percent' => $discount,
        ];
    }

    /**
     * What to charge when the car comes back with $mileage on the odometer at $returnedAt:
     * kilometres over the allowance for the booked days, and lateness past the grace period
     * (counted from the planned end). Damage is priced by staff, one amount per mark, and so is the
     * washing of a car brought back dirty.
     */
    public static function returnCharges(Agency $agency, Contract $contract, int $mileage, int $returnedAt): array
    {
        $rules = self::rules($agency);
        $charges = [];

        $driven = $mileage - (int) $contract->pickup_mileage;
        $allowed = $rules['km_per_day'] * max(1, (int) ceil(($contract->ends_at - $contract->starts_at) / self::DAY));
        if ($rules['charge_extra_km'] && $rules['km_per_day'] && $rules['extra_km_price'] && $driven > $allowed) {
            $charges[] = [ 'type' => 'km', 'quantity' => $driven - $allowed, 'amount' => ($driven - $allowed) * $rules['extra_km_price'] ];
        }

        $late = $returnedAt - $contract->ends_at;
        if ($rules['late_per'] !== 'none' && $late > $rules['late_grace_hours'] * self::HOUR) {
            $charges[] = $rules['late_per'] === 'hour' ?
                [ 'type' => 'late', 'unit' => 'hour', 'quantity' => $hours = (int) ceil($late / self::HOUR), 'amount' => $hours * $rules['late_hour_price'] ] :
                [ 'type' => 'late', 'unit' => 'day', 'quantity' => $days = (int) ceil($late / self::DAY), 'amount' => $days * $contract->daily_price ];
        }

        return array_values(array_filter($charges, fn ($charge) => $charge['amount'] > 0));
    }

    private static function seasonOn(array $seasons, CarbonImmutable $day): ?array
    {
        $monthDay = (int) $day->format('md');
        foreach ($seasons as $season) {
            $from = self::monthDay($season['from']);
            $to = self::monthDay($season['to']);
            // A season can run over the new year (15/12 to 05/01).
            $isIn = $from <= $to ? ($monthDay >= $from && $monthDay <= $to) : ($monthDay >= $from || $monthDay <= $to);
            if ($isIn) {
                return $season;
            }
        }

        return null;
    }

    private static function monthDay(string $dayMonth): int
    {
        [ $day, $month ] = explode('/', $dayMonth);

        return (int) $month * 100 + (int) $day;
    }
}
