<?php

namespace App\Models;

use App\Support\BranchScope;
use App\Support\DoesntConvertDates;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Validation\ValidationException;

#[ScopedBy(BranchScope::class)] // a branch manager's cars only
class Contract extends Model
{
    use HasFactory, SoftDeletes, DoesntConvertDates;

    protected $dateFormat = 'U';

    // reserved → out (car handed over) → returned → closed (settled). Cancelled contracts are
    // also soft-deleted, so they drop out of every query and free the car.
    const STATUS_RESERVED = 1;
    const STATUS_OUT = 2;
    const STATUS_RETURNED = 3;
    const STATUS_CLOSED = 4;
    const STATUS_CANCELLED = 5;
    const STATUSES = [ self::STATUS_RESERVED, self::STATUS_OUT, self::STATUS_RETURNED, self::STATUS_CLOSED, self::STATUS_CANCELLED ];

    // Where the booking came from. A broker (hotel, travel agency, courtier) is named in `broker`
    // and may take a `commission`.
    const SOURCE_WALK_IN = 1;
    const SOURCE_PHONE = 2;
    const SOURCE_WHATSAPP = 3;
    const SOURCE_SOCIAL = 4; // Facebook, Instagram
    const SOURCE_WEBSITE = 5;
    const SOURCE_BROKER = 6;
    const SOURCES = [ 1, 2, 3, 4, 5, 6 ];

    protected $fillable = [
        'car_id', 'client_id', 'daily_price', 'starts_at', 'ends_at', 'note',
        'second_driver_id', 'pickup_location', 'return_location', 'source', 'broker', 'commission',
        'pickup_user_id', 'return_user_id', // who hands the car over, who takes it back and cleans it
    ];

    protected $attributes = [ 'status' => self::STATUS_RESERVED ];

    protected $casts = [ 'extras' => 'array', 'charges' => 'array' ];

    public function car()
    {
        return $this->belongsTo(Car::class);
    }

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function secondDriver()
    {
        return $this->belongsTo(Client::class, 'second_driver_id');
    }

    public function pickupUser()
    {
        return $this->belongsTo(User::class, 'pickup_user_id')->withTrashed();
    }

    public function returnUser()
    {
        return $this->belongsTo(User::class, 'return_user_id')->withTrashed();
    }

    public function activities()
    {
        return $this->hasMany(Activity::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function photos()
    {
        return $this->hasMany(ContractPhoto::class);
    }

    public function damages()
    {
        return $this->hasMany(ContractDamage::class);
    }

    public function fines()
    {
        return $this->hasMany(Fine::class);
    }

    /**
     * Contracts that share time with [$startsAt, $endsAt). Back-to-back contracts don't overlap.
     */
    public function scopeOverlapping($query, int $startsAt, int $endsAt)
    {
        return $query->where('starts_at', '<', $endsAt)->where('ends_at', '>', $startsAt);
    }

    /**
     * Locks the car row so two people can't book it at the same time, then refuses the period
     * if another contract of that car overlaps it. Call inside a transaction.
     */
    public static function lockFreeCar(Agency $agency, int $carId, int $startsAt, int $endsAt, string $errorKey, ?int $ignoreContractId = null): Car
    {
        $car = $agency->cars()->lockForUpdate()->findOrFail($carId);
        if ($car->sold_at) {
            throw ValidationException::withMessages([ $errorKey => 'car:sold' ]);
        }
        $isTaken = $car->contracts()
            ->overlapping($startsAt, $endsAt)
            ->when($ignoreContractId, fn ($query) => $query->whereKeyNot($ignoreContractId))
            ->exists() || $car->blocks()->overlapping($startsAt, $endsAt)->exists();
        if ($isTaken) {
            throw ValidationException::withMessages([ $errorKey => 'contract:overlap' ]);
        }

        return $car;
    }

    public function days(): float
    {
        return ($this->ends_at - $this->starts_at) / (60 * 60 * 24);
    }

    /**
     * Rent in millimes: the daily price times the booked days, part days included.
     */
    public function rentPrice(): int
    {
        return (int) round($this->daily_price * $this->days());
    }

    /**
     * Extras (additional driver, child seat, airport delivery...), charged once or per day.
     */
    public function extrasPrice(): int
    {
        return (int) round(collect($this->extras ?? [])->sum(fn ($extra) => $extra['per'] === 'day' ? $extra['price'] * $this->days() : $extra['price']));
    }

    /**
     * Charged at return: kilometres over the allowance, lateness, damage.
     */
    public function chargesPrice(): int
    {
        return (int) collect($this->charges ?? [])->sum('amount');
    }

    /**
     * What the client owes for the rental in millimes: rent, extras and return charges. Fines are separate.
     */
    public function totalPrice(): int
    {
        return $this->rentPrice() + $this->extrasPrice() + $this->chargesPrice();
    }

    /**
     * Fines paid out of the deposit, which reduce what goes back to the client.
     */
    public function finesFromDeposit(): int
    {
        return (int) $this->fines()->where('status', Fine::STATUS_FROM_DEPOSIT)->sum('amount');
    }

    /**
     * The deposit still held: less the fines and the payments taken out of it.
     */
    public function depositAvailable(): int
    {
        return $this->deposit - $this->finesFromDeposit()
            - (int) $this->payments()->where('method', Payment::METHOD_DEPOSIT)->sum('amount');
    }
}
