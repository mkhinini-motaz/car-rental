<?php

namespace App\Models;

use App\Support\DoesntConvertDates;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A bill that comes back every N months (rent, internet). When it's paid, an expense is
 * recorded and the due date moves forward; nothing happens by itself.
 */
class RecurringBill extends Model
{
    use SoftDeletes, DoesntConvertDates;

    protected $dateFormat = 'U';

    protected $fillable = [ 'category', 'amount', 'every_months', 'next_due_at', 'note', 'branch_id' ];

    public function branch()
    {
        return $this->belongsTo(Branch::class)->withTrashed();
    }

    public function moveToNextDueDate(): void
    {
        $this->next_due_at = CarbonImmutable::createFromTimestamp($this->next_due_at, Agency::TIMEZONE)
            ->addMonthsNoOverflow($this->every_months)->getTimestamp();
    }
}
