<?php

namespace App\Models;

use App\Support\DoesntConvertDates;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ContractPhoto extends Model
{
    use SoftDeletes, DoesntConvertDates;

    protected $dateFormat = 'U';

    const STAGE_PICKUP = 1;
    const STAGE_RETURN = 2;

    // The fixed angles the app asks for, then any extra (a close-up of a damage).
    const ANGLE_FRONT = 1;
    const ANGLE_BACK = 2;
    const ANGLE_LEFT = 3;
    const ANGLE_RIGHT = 4;
    const ANGLE_INTERIOR = 5;
    const ANGLE_DASHBOARD = 6; // shows the odometer and the fuel gauge
    const ANGLE_OTHER = 7;
    const ANGLES = [ 1, 2, 3, 4, 5, 6, 7 ];

    protected $fillable = [ 'stage', 'angle', 'path' ];
}
