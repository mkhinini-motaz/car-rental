<?php

namespace App\Models;

use App\Support\DoesntConvertDates;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Money the agency receives that isn't rent, on a car or not: an insurance payout after an
 * accident, parts sold. Cash ones are in the cash book.
 */
class Income extends Model
{
    use SoftDeletes, DoesntConvertDates;

    protected $dateFormat = 'U';

    const CATEGORY_INSURANCE_PAYOUT = 1;
    const CATEGORY_REIMBURSEMENT = 2; // a client paying back a cost that isn't a fine or a charge
    const CATEGORY_PARTS_SALE = 3;
    const CATEGORY_OTHER = 4;
    const CATEGORIES = [ 1, 2, 3, 4 ];

    protected $fillable = [ 'category', 'amount', 'received_at', 'method', 'note', 'car_id', 'user_id' ];

    public function car()
    {
        return $this->belongsTo(Car::class)->withTrashed();
    }

    public function user()
    {
        return $this->belongsTo(User::class)->withTrashed();
    }
}
