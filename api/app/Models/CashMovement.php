<?php

namespace App\Models;

use App\Support\DoesntConvertDates;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Cash put in or taken out of the till by hand, outside rentals and expenses.
 */
class CashMovement extends Model
{
    use SoftDeletes, DoesntConvertDates;

    protected $dateFormat = 'U';

    const TYPE_ADDED = 1;        // in: change for the till, owner's money
    const TYPE_WITHDRAWAL = 2;   // out: taken by the owner
    const TYPE_BANK_DEPOSIT = 3; // out: taken to the bank
    const TYPES = [ self::TYPE_ADDED, self::TYPE_WITHDRAWAL, self::TYPE_BANK_DEPOSIT ];

    protected $fillable = [ 'type', 'amount', 'moved_at', 'note', 'user_id' ];

    public function user()
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function signedAmount(): int
    {
        return $this->type === self::TYPE_ADDED ? $this->amount : -$this->amount;
    }
}
