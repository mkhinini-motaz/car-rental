<?php

namespace App\Models;

use App\Support\DoesntConvertDates;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Agency extends Model
{
    use HasFactory, SoftDeletes, DoesntConvertDates;

    protected $dateFormat = 'U';

    // Every agency is in Tunisia: months, days and seasons are counted in its time.
    const TIMEZONE = 'Africa/Tunis';

    // The palettes the apps know (`PALETTES` in carweb's theme.ts and the phone app's copy).
    const THEMES = [
        'navy', 'plate', 'noir', 'racing', 'oxblood', 'electric', 'rosso', 'papaya', 'taxi',
        'gulf', 'sea', 'rose', 'desert', 'blossom', 'lilac', 'mint', 'apricot', 'paper',
    ];
    const THEME_MODE_DEVICE = 1; // light or dark as each phone or computer is set
    const THEME_MODE_LIGHT = 2;
    const THEME_MODE_DARK = 3;
    const THEME_MODES = [ self::THEME_MODE_DEVICE, self::THEME_MODE_LIGHT, self::THEME_MODE_DARK ];

    protected $fillable = [
        'name', 'phone', 'address', 'takes_deposit', 'default_deposit', 'default_deposit_method',
        'tax_id', 'contract_terms', 'pickup_time', 'return_time', 'expiry_warning_days', 'oil_warning_km', 'oil_warning_days',
        'fleet_max_years', 'employer_charges_rate', 'min_driver_age', 'min_licence_years',
        'vat_rate', 'fiscal_stamp', 'theme', 'theme_mode',
    ];

    protected $casts = [ 'pricing' => 'array', 'takes_deposit' => 'boolean' ];

    public function expenses()
    {
        return $this->hasMany(Expense::class);
    }

    public function fines()
    {
        return $this->hasMany(Fine::class);
    }

    public function users()
    {
        return $this->hasMany(User::class);
    }

    public function cashMovements()
    {
        return $this->hasMany(CashMovement::class);
    }

    public function cars()
    {
        return $this->hasMany(Car::class);
    }

    public function incomes()
    {
        return $this->hasMany(Income::class);
    }

    public function branches()
    {
        return $this->hasMany(Branch::class);
    }

    public function employees()
    {
        return $this->hasMany(Employee::class);
    }

    public function recurringBills()
    {
        return $this->hasMany(RecurringBill::class);
    }

    public function salaryPayments()
    {
        return $this->hasManyThrough(SalaryPayment::class, Employee::class);
    }

    public function clients()
    {
        return $this->hasMany(Client::class);
    }

    public function documents()
    {
        return $this->hasMany(Document::class);
    }

    // The phones signed in to the agency (disabled staff's excluded: their users are soft-deleted).
    public function deviceTokens()
    {
        return $this->hasManyThrough(DeviceToken::class, User::class);
    }

    public function contracts()
    {
        return $this->hasManyThrough(Contract::class, Car::class);
    }
}
