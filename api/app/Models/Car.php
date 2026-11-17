<?php

namespace App\Models;

use App\Support\BranchScope;
use App\Support\DoesntConvertDates;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

use function App\Support\Helpers\occursInPeriod;

#[ScopedBy(BranchScope::class)] // a branch manager's cars only
class Car extends Model
{
    use HasFactory, SoftDeletes, DoesntConvertDates;

    protected $dateFormat = 'U';

    const TRANSMISSION_TYPE_MANUAL = 1;
    const TRANSMISSION_TYPE_AUTO = 2;
    const TRANSMISSION_TYPES = [ self::TRANSMISSION_TYPE_MANUAL, self::TRANSMISSION_TYPE_AUTO ];

    const FUEL_TYPE_GAS = 1;
    const FUEL_TYPE_PETROL = 2;
    const FUEL_TYPES = [ self::FUEL_TYPE_GAS, self::FUEL_TYPE_PETROL ];

    const TYPE_COMPACT = 1;
    const TYPE_SEDAN = 2;
    const TYPES = [ self::TYPE_COMPACT, self::TYPE_SEDAN ];

    // Only available cars are offered by the availability search. A sold car has left the fleet
    // (set by the sale, not the car form) but keeps its history.
    const STATUS_AVAILABLE = 1;
    const STATUS_MAINTENANCE = 2;
    const STATUS_OUT_OF_SERVICE = 3;
    const STATUS_SOLD = 4;
    const STATUSES = [ self::STATUS_AVAILABLE, self::STATUS_MAINTENANCE, self::STATUS_OUT_OF_SERVICE ];

    // A car added within this long of its purchase (or first registration) has its whole life in the app.
    const HISTORY_GRACE = 30 * 24 * 60 * 60;

    protected $fillable = [
        'daily_price', 'licence_plate', 'serial_number', 'manufacturer', 'model_name', 'model_year',
        'fiscal_horse_power', 'number_of_cylinders', 'transmission_type', 'fuel_type', 'type',
        'first_circulation_date', 'circulation_tax_ends_at', 'insurance_ends_at', 'technical_control_ends_at',
        'colour', 'status', 'mileage', 'photo', 'oil_change_every_km', 'oil_change_every_months', 'branch_id',
    ];

    // The owner's side (purchase, financing, sale), saved by their own endpoints.
    const PURCHASE_FIELDS = [
        'purchase_price', 'bought_at', 'purchase_fees', 'supplier', 'advance', 'instalment_amount', 'instalment_months',
        'first_instalment_at', 'lender', 'expected_sale_price', 'instalments_paid_before', 'earned_before',
    ];
    const SALE_FIELDS = [ 'sold_at', 'sale_price', 'buyer_name', 'buyer_phone', 'sale_method' ];

    /**
     * As on the plate itself: 245 تونس 1234, also from 245 TU 1234, 245tn1234 or 245-TU-1234.
     */
    public static function normalizePlate(string $plate): string
    {
        $text = mb_strtoupper(preg_replace('/\s+/u', ' ', trim(str_replace([ '-', '_', '.' ], ' ', $plate))));
        $text = preg_replace('/^(\d{1,3}) ?(?:TU|TN|تونس) ?(\d{1,4})$/u', '$1 تونس $2', $text);

        return preg_replace('/^(\d{1,3}) ?([A-Z]{2,3}) ?(\d{1,4})$/', '$1 $2 $3', $text);
    }

    /**
     * The plate inside other text (a push, a PDF line), as on the car: the series on the left,
     * 245 تونس 1234, in every language. A left-to-right embedding, and a mark after تونس so the
     * number after it stays on its right (the bidi algorithm would pull it left).
     */
    public static function embedPlate(string $plate): string
    {
        return "\u{202A}" . preg_replace('/(\p{Arabic})( \d)/u', "\$1\u{200E}\$2", $plate) . "\u{202C}";
    }

    public function agency()
    {
        return $this->belongsTo(Agency::class);
    }

    public function contracts()
    {
        return $this->hasMany(Contract::class);
    }

    public function blocks()
    {
        return $this->hasMany(CarBlock::class);
    }

    public function documents()
    {
        return $this->hasMany(Document::class);
    }

    /**
     * Every damage marked on the car, at its handovers or as already there when it came into the
     * app; open while `repaired_at` is null.
     */
    public function damages()
    {
        return $this->hasMany(ContractDamage::class);
    }

    public function expenses()
    {
        return $this->hasMany(Expense::class);
    }

    public function fines()
    {
        return $this->hasMany(Fine::class);
    }

    public function incomes()
    {
        return $this->hasMany(Income::class);
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class)->withTrashed();
    }

    /**
     * Cars still in the fleet (not sold).
     */
    public function scopeInFleet($query)
    {
        return $query->whereNull('sold_at');
    }

    /**
     * When the car must leave the fleet: its first registration plus the agency's limit (3 years
     * in Tunisia today). Null when the date isn't known.
     */
    public function fleetDeadline(): ?int
    {
        return $this->firstCirculation()?->addYearsNoOverflow($this->agency->fleet_max_years)->getTimestamp();
    }

    private function firstCirculation(): ?CarbonImmutable
    {
        return $this->first_circulation_date ?
            CarbonImmutable::createFromFormat('d/m/Y', $this->first_circulation_date, Agency::TIMEZONE)->startOfDay() : null;
    }

    /**
     * When the app started seeing the car's rentals and costs: its first record (added, or an
     * older rental entered after the fact), for a car already in service well before (an agency
     * that joined with its fleet). Null when its whole life is in the app, or when the owner
     * entered what it brought in before (`earned_before`). Its lifetime figures (earned,
     * payback) only count from then.
     */
    public function historySince(): ?int
    {
        if ($this->earned_before !== null) {
            return null;
        }
        $start = $this->bought_at ?? $this->firstCirculation()?->getTimestamp();
        $firstRental = $this->relationLoaded('contracts') ? $this->contracts->min('starts_at') : $this->contracts()->min('starts_at');
        $firstRecord = min((int) $this->created_at, (int) ($firstRental ?? PHP_INT_MAX));

        return $start !== null && $start < $firstRecord - self::HISTORY_GRACE ? $firstRecord : null;
    }

    /**
     * When the next oil change is due, from the last one recorded: by kilometres (against the
     * odometer read at each pickup and return) or by date, whichever comes first. With none
     * recorded (`last_at` null), the first one counts from the first registration at 0 km: right
     * for a new car, and a car that came into the app with a past shows due until its last one is
     * recorded. Null when the first registration isn't known either.
     */
    public function oilChange(): ?array
    {
        $last = $this->expenses()->where('category', Expense::CATEGORY_OIL_CHANGE)->latest('spent_at')->first();
        $since = $last ? CarbonImmutable::createFromTimestamp($last->spent_at, Agency::TIMEZONE) : $this->firstCirculation();
        if (! $since) {
            return null;
        }

        $lastMileage = $last ? $last->mileage : 0;
        $dueMileage = $lastMileage === null ? null : $lastMileage + $this->oil_change_every_km;
        $dueAt = $since->addMonthsNoOverflow($this->oil_change_every_months)->getTimestamp();

        return [
            'last_at' => $last?->spent_at,
            'last_mileage' => $last?->mileage,
            'due_mileage' => $dueMileage,
            'due_at' => $dueAt,
            // Flagged a little ahead (the agency's setting), so it can be planned between two rentals.
            'is_due' => $dueAt < time() + $this->agency->oil_warning_days * 24 * 60 * 60
                || ($dueMileage !== null && $this->mileage !== null && $this->mileage >= $dueMileage - $this->agency->oil_warning_km),
        ];
    }

    public function scopeOrderByContractsCountForPeriod($query, $periodStart, $periodEnd)
    {
        return $query->withCount(
            [ 'contracts' => occursInPeriod('starts_at', 'ends_at', $periodStart, $periodEnd, true, false) ]
            )->orderBy('contracts_count', 'asc');
    }

    public function scopeWithContractsInPeriod($mainQuery, $periodStart, $periodEnd)
    {
        return $mainQuery->with([
            'contracts' => fn ($query) => $query->where(occursInPeriod('starts_at', 'ends_at', $periodStart, $periodEnd, true, false))->orderBy('starts_at', 'asc'),
            'blocks' => fn ($query) => $query->overlapping($periodStart, $periodEnd),
        ]);
    }

    public function scopeWherePossiblyAvailableInPeriod($mainQuery, $periodStart, $periodEnd)
    {

        return $mainQuery->where(function($query) use ($periodStart, $periodEnd) {
            $query->whereDoesntHave(
                'contracts', occursInPeriod('starts_at', 'ends_at', $periodStart, $periodEnd, true, true)
            )->orWhereHas(
                'contracts',  occursInPeriod('starts_at', 'ends_at', $periodStart, $periodEnd, true, false)
            );
        })->whereDoesntHave('blocks', fn ($query) => $query->where('starts_at', '<=', $periodStart)->where('ends_at', '>=', $periodEnd));
    }

    /**
     * The free stretches of [$periodStart, $periodEnd] between the loaded contracts and blocks.
     */
    public function availabilityInPeriod($periodStart, $periodEnd)
    {
        $busy = $this->contracts->concat($this->relationLoaded('blocks') ? $this->blocks : [])->sortBy('starts_at');
        $currentStart = $periodStart;
        $availablity = [];
        foreach ($busy as $period) {
            if ($period->starts_at > $periodEnd) {
                break;
            }
            if ($period->starts_at > $currentStart) {
                $availablity[] = [$currentStart, $period->starts_at];
            }
            $currentStart = max($currentStart, $period->ends_at);
        }
        if ($currentStart < $periodEnd) {
            $availablity[] = [$currentStart, $periodEnd];
        }

        return $availablity;
    }
}
