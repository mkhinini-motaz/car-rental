<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;

use App\Support\DoesntConvertDates;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Hash;
use Tymon\JWTAuth\Contracts\JWTSubject;

class User extends Authenticatable implements JWTSubject
{
    use HasFactory, Notifiable, SoftDeletes, DoesntConvertDates;

    const ROLE_OWNER = 1;
    const ROLE_MANAGER = 2;

    // A code sent by SMS for a forgotten password lasts 10 minutes; an invitation lasts a week.
    const CODE_TTL = 600;
    const INVITE_TTL = 7 * 86400;
    const CODE_ATTEMPTS = 5; // wrong guesses before the code stops working

    protected $dateFormat = 'U';

    protected $fillable = [ 'first_name', 'last_name', 'phone', 'password', 'role', 'branch_id' ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'password_code',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function isOwner(): bool
    {
        return $this->role === self::ROLE_OWNER;
    }

    public function agency()
    {
        return $this->belongsTo(Agency::class);
    }

    /**
     * A manager tied to a branch works on its cars only (App\Support\BranchScope).
     */
    public function deviceTokens()
    {
        return $this->hasMany(DeviceToken::class);
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class)->withTrashed();
    }

    /**
     * Changes made to this account by the owners.
     */
    public function staffActivities()
    {
        return $this->hasMany(Activity::class, 'staff_id');
    }

    public function getJWTIdentifier()
    {
        return $this->getKey();
    }

    public function getJWTCustomClaims()
    {
        return [ 'pwd' => $this->passwordFingerprint() ]; // checked by TokenMatchesPassword
    }

    public function passwordFingerprint(): string
    {
        return substr(hash_hmac('sha256', (string) $this->password, config('app.key')), 0, 16);
    }

    /**
     * A 6-digit one-time code that lets this user choose a new password, replacing any earlier one.
     */
    public function issuePasswordCode(int $ttl): string
    {
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $this->forceFill([ 'password_code' => Hash::make($code), 'password_code_expires_at' => time() + $ttl, 'password_code_attempts' => 0 ])->save();

        return $code;
    }

    public function usePasswordCode(string $code, string $password): bool
    {
        if (! $this->password_code || $this->password_code_expires_at < time() || $this->password_code_attempts >= self::CODE_ATTEMPTS) {
            return false;
        }
        if (! Hash::check($code, $this->password_code)) {
            $this->increment('password_code_attempts');
            return false;
        }
        $this->forceFill([ 'password' => $password, 'password_code' => null, 'password_code_expires_at' => null ])->save();

        return true;
    }
}
