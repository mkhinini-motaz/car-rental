<?php

namespace App\Models;

use App\Support\DoesntConvertDates;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Someone the agency pays, whether or not they log in (a mechanic, a washer). Staff accounts
 * get one automatically. Salaries are the owner's business only.
 */
class Employee extends Model
{
    use SoftDeletes, DoesntConvertDates;

    protected $dateFormat = 'U';

    protected $fillable = [ 'first_name', 'last_name', 'phone', 'role_label', 'monthly_salary', 'hired_at', 'active', 'user_id' ];

    protected $casts = [ 'active' => 'boolean' ];

    public function salaryPayments()
    {
        return $this->hasMany(SalaryPayment::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    /**
     * Still due for $month ('YYYY-MM'): the salary less what was paid as salary or advance
     * (bonuses are on top).
     */
    public function dueFor(string $month): int
    {
        $paid = $this->salaryPayments->where('month', $month)
            ->whereIn('type', [ SalaryPayment::TYPE_SALARY, SalaryPayment::TYPE_ADVANCE ])->sum('amount');

        return max(0, $this->monthly_salary - $paid);
    }
}
