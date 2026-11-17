<?php

namespace App\Models;

use App\Support\DoesntConvertDates;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Money paid to an employee for a month: the salary, an advance during the month (it reduces
 * what is due at the end), or a bonus. Cash ones are in the cash book.
 */
class SalaryPayment extends Model
{
    use SoftDeletes, DoesntConvertDates;

    protected $dateFormat = 'U';

    const TYPE_SALARY = 1;
    const TYPE_ADVANCE = 2;
    const TYPE_BONUS = 3;
    const TYPES = [ 1, 2, 3 ];

    protected $fillable = [ 'month', 'type', 'amount', 'paid_at', 'method', 'note', 'user_id' ];

    public function employee()
    {
        return $this->belongsTo(Employee::class)->withTrashed();
    }

    public function user()
    {
        return $this->belongsTo(User::class)->withTrashed();
    }
}
