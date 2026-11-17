<?php

namespace App\Models;

use App\Support\BranchScope;
use App\Support\DoesntConvertDates;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A traffic fine (PV) on one of the agency's cars, matched to the rental active when it was
 * committed. With no rental in the app then (one kept on paper before the agency joined), staff
 * name the renter: `client_id`.
 */
#[ScopedBy(BranchScope::class)] // a branch manager's cars only
class Fine extends Model
{
    use SoftDeletes, DoesntConvertDates;

    protected $dateFormat = 'U';

    // The client's side. The agency paying the authority is separate (`paid_out_at`), so a fine
    // the agency paid and the client repaid later moves money twice.
    const STATUS_UNPAID = 1; // the client owes it
    const STATUS_PAID_BY_CLIENT = 2; // to the agency (`method`), or straight to the authority (`method` null)
    const STATUS_FROM_DEPOSIT = 3; // kept from the deposit the agency still holds
    const STATUS_PAID_BY_AGENCY = 4; // the agency's loss, counted as a car expense
    const STATUSES = [ 1, 2, 3, 4 ];

    protected $fillable = [ 'committed_at', 'amount', 'reference', 'note', 'car_id' ];

    protected $attributes = [ 'status' => self::STATUS_UNPAID ];

    public function car()
    {
        return $this->belongsTo(Car::class);
    }

    public function contract()
    {
        return $this->belongsTo(Contract::class);
    }

    public function client()
    {
        return $this->belongsTo(Client::class)->withTrashed();
    }

    public function user()
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function paidOutUser()
    {
        return $this->belongsTo(User::class, 'paid_out_user_id')->withTrashed();
    }
}
