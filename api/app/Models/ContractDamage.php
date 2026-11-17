<?php

namespace App\Models;

use App\Support\DoesntConvertDates;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A damage marked on the car outline at pickup or return (stage as on ContractPhoto), or already
 * on the car when it came into the app (no contract, no stage). It stays on the car, shown at its
 * next handovers, until `repaired_at`.
 */
class ContractDamage extends Model
{
    use SoftDeletes, DoesntConvertDates;

    protected $dateFormat = 'U';

    protected $fillable = [ 'stage', 'x', 'y', 'note', 'amount', 'repaired_at' ];

    protected static function booted(): void
    {
        // Marked at a handover: on that rental's car.
        static::creating(fn (ContractDamage $damage) => $damage->car_id ??= $damage->contract?->car_id);
    }

    public function contract()
    {
        return $this->belongsTo(Contract::class);
    }

    public function car()
    {
        return $this->belongsTo(Car::class);
    }
}
