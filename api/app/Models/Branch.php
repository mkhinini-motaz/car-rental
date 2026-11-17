<?php

namespace App\Models;

use App\Support\DoesntConvertDates;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * One of the agency's premises, with its monthly rent. Not a delivery place (those are in the
 * pricing rules).
 */
class Branch extends Model
{
    use SoftDeletes, DoesntConvertDates;

    protected $dateFormat = 'U';

    protected $fillable = [ 'name', 'address', 'monthly_rent' ];
}
