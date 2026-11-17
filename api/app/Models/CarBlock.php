<?php

namespace App\Models;

use App\Support\DoesntConvertDates;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Days a car can't be rented without a contract: maintenance, the owner's own use...
 * Bookings treat it like a contract.
 */
class CarBlock extends Model
{
    use SoftDeletes, DoesntConvertDates;

    protected $dateFormat = 'U';

    const REASON_MAINTENANCE = 1;
    const REASON_PERSONAL = 2;
    const REASON_OTHER = 3;
    const REASONS = [ self::REASON_MAINTENANCE, self::REASON_PERSONAL, self::REASON_OTHER ];

    protected $fillable = [ 'starts_at', 'ends_at', 'reason', 'note' ];

    public function car()
    {
        return $this->belongsTo(Car::class);
    }

    public function scopeOverlapping($query, int $startsAt, int $endsAt)
    {
        return $query->where('starts_at', '<', $endsAt)->where('ends_at', '>', $startsAt);
    }
}
