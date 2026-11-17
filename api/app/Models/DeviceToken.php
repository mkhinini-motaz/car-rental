<?php

namespace App\Models;

use App\Support\DoesntConvertDates;
use Illuminate\Database\Eloquent\Model;

class DeviceToken extends Model
{
    use DoesntConvertDates;

    protected $dateFormat = 'U';

    const LANGS = [ 'en', 'fr', 'tnfr', 'tnar', 'ar' ];

    protected $fillable = [ 'token', 'platform', 'lang', 'user_id' ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
