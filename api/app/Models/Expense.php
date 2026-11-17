<?php

namespace App\Models;

use App\Support\DoesntConvertDates;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Money the agency spends: on a car (car categories) or on the agency itself (agency
 * categories, optionally for a branch or an employee). The maintenance categories form the
 * car's maintenance log. A repair can be tied to the contract that caused it: it then counts
 * against that client.
 */
class Expense extends Model
{
    use SoftDeletes, DoesntConvertDates;

    protected $dateFormat = 'U';

    const CATEGORY_OIL_CHANGE = 1;
    const CATEGORY_TYRES = 2;
    const CATEGORY_BRAKES = 3;
    const CATEGORY_REPAIR = 4;
    const CATEGORY_FUEL = 5;
    const CATEGORY_INSURANCE = 6;
    const CATEGORY_TAX = 7;
    const CATEGORY_WASHING = 8;
    const CATEGORY_OTHER = 9;
    const CATEGORY_TECHNICAL_VISIT = 10;
    const CATEGORY_REGISTRATION = 11;
    const CATEGORY_INSTALMENT = 12; // a credit or leasing instalment: pays for the car, not a running cost
    const CATEGORY_ACCIDENT = 13;
    const CATEGORY_GPS = 14;
    const CATEGORY_PARKING = 15;
    const CAR_CATEGORIES = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 ];

    // The agency's own costs (overhead).
    const CATEGORY_RENT = 20;
    const CATEGORY_ELECTRICITY = 21;
    const CATEGORY_WATER = 22;
    const CATEGORY_INTERNET = 23;
    const CATEGORY_PHONE = 24; // phone and phone credit, possibly for an employee
    const CATEGORY_ACCOUNTANT = 25;
    const CATEGORY_BANK_FEES = 26;
    const CATEGORY_TAXES = 27; // patente, municipal tax, TVA, cahier des charges
    const CATEGORY_MARKETING = 28;
    const CATEGORY_SOFTWARE = 29;
    const CATEGORY_OFFICE = 30;
    const CATEGORY_CNSS = 31; // the employer's social charges, paid each quarter
    const CATEGORY_OTHER_AGENCY = 39;
    const AGENCY_CATEGORIES = [ 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 39 ];

    const CATEGORIES = [ ...self::CAR_CATEGORIES, ...self::AGENCY_CATEGORIES ];
    const MAINTENANCE_CATEGORIES = [ self::CATEGORY_OIL_CHANGE, self::CATEGORY_TYRES, self::CATEGORY_BRAKES, self::CATEGORY_REPAIR ];

    // How a car's running costs are grouped on its page.
    const COST_GROUPS = [
        'insurance' => [ self::CATEGORY_INSURANCE ],
        'technical_visit' => [ self::CATEGORY_TECHNICAL_VISIT ],
        'tax' => [ self::CATEGORY_TAX, self::CATEGORY_REGISTRATION ],
        'maintenance' => [ self::CATEGORY_OIL_CHANGE, self::CATEGORY_TYRES, self::CATEGORY_BRAKES, self::CATEGORY_REPAIR, self::CATEGORY_ACCIDENT ],
        'other' => [ self::CATEGORY_FUEL, self::CATEGORY_WASHING, self::CATEGORY_OTHER, self::CATEGORY_GPS, self::CATEGORY_PARKING ],
    ];

    protected $fillable = [ 'category', 'amount', 'spent_at', 'mileage', 'garage', 'note', 'car_id', 'method', 'user_id', 'branch_id', 'employee_id', 'contract_id' ];

    public function car()
    {
        return $this->belongsTo(Car::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class)->withTrashed();
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class)->withTrashed();
    }

    public function contract()
    {
        return $this->belongsTo(Contract::class)->withTrashed();
    }

    public function isAgencyCost(): bool
    {
        return in_array($this->category, self::AGENCY_CATEGORIES, true);
    }
}
