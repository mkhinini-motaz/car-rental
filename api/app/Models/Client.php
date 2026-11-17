<?php

namespace App\Models;

use App\Support\DoesntConvertDates;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Model;

class Client extends Model
{
    use HasFactory, SoftDeletes, DoesntConvertDates;

    protected $dateFormat = 'U';

    const GENDER_MALE = 1;
    const GENDER_FEMALE = 2;

    // Why staff don't want to rent to this person again.
    const FLAG_UNPAID = 1;
    const FLAG_DAMAGE = 2;
    const FLAG_LATE = 3;
    const FLAG_OTHER = 4;
    const FLAGS = [ self::FLAG_UNPAID, self::FLAG_DAMAGE, self::FLAG_LATE, self::FLAG_OTHER ];

    // What a flagged client can be recognised by: people change phone numbers, not ID cards.
    const IDENTIFIERS = [ 'phone', 'id_number', 'driver_licence_number' ];

    protected $fillable = [
        'first_name', 'last_name', 'phone', 'gender', 'birth_date',
        'id_number', 'driver_licence_number', 'driver_licence_delivery_date', 'driver_licence_expiry_date', 'flag', 'notes',
        'rentals_before', // a regular client's rentals kept on paper, before the app
    ];

    public function agency()
    {
        return $this->belongsTo(Agency::class);
    }

    public function contracts()
    {
        return $this->hasMany(Contract::class);
    }

    public function documents()
    {
        return $this->hasMany(Document::class);
    }

    /**
     * The agency's rules this client breaks today: too young, licence too recent, licence
     * expired. A missing date breaks nothing (the pickup asks for the licence anyway).
     *
     * @return array<array{code: string, min?: int, value?: int, date?: string}>
     */
    public function eligibilityIssues(Agency $agency): array
    {
        $today = CarbonImmutable::now(Agency::TIMEZONE)->startOfDay();
        $date = fn ($value) => $value ? CarbonImmutable::createFromFormat('!d/m/Y', $value, Agency::TIMEZONE) : null;
        $yearsSince = fn ($value) => (int) floor($date($value)->diffInYears($today));
        $issues = [];

        if ($agency->min_driver_age && $this->birth_date && $yearsSince($this->birth_date) < $agency->min_driver_age) {
            $issues[] = [ 'code' => 'age', 'min' => $agency->min_driver_age, 'value' => $yearsSince($this->birth_date) ];
        }
        if ($agency->min_licence_years && $this->driver_licence_delivery_date && $yearsSince($this->driver_licence_delivery_date) < $agency->min_licence_years) {
            $issues[] = [ 'code' => 'licence_years', 'min' => $agency->min_licence_years, 'value' => $yearsSince($this->driver_licence_delivery_date) ];
        }
        if ($this->driver_licence_expiry_date && $date($this->driver_licence_expiry_date)->lt($today)) {
            $issues[] = [ 'code' => 'licence_expired', 'date' => $this->driver_licence_expiry_date ];
        }

        return $issues;
    }

    /**
     * Flagged clients of the agency who are this person: this record, or another one with the
     * same phone, ID number or licence number. Each comes with what matched.
     */
    public function flaggedMatches()
    {
        $identifiers = collect(self::IDENTIFIERS)->filter(fn ($field) => filled($this->$field));

        return self::where('agency_id', $this->agency_id)
            ->whereNotNull('flag')
            ->where(function ($query) use ($identifiers) {
                $query->whereKey($this->id);
                $identifiers->each(fn ($field) => $query->orWhere($field, $this->$field));
            })
            ->get()
            ->map(function (Client $client) use ($identifiers) {
                $client->matched_on = $client->id === $this->id ?
                    [ 'self' ] :
                    $identifiers->filter(fn ($field) => $client->$field === $this->$field)->values()->all();
                return $client;
            });
    }
}
