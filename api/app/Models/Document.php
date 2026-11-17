<?php

namespace App\Models;

use App\Support\DoesntConvertDates;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

/**
 * A photo of a car's or a client's papers. Deleting the row deletes the file.
 */
class Document extends Model
{
    use DoesntConvertDates;

    protected $dateFormat = 'U';

    // A car's papers, shown next to their expiry dates.
    const TYPE_CARTE_GRISE = 1;
    const TYPE_INSURANCE = 2;
    const TYPE_TECHNICAL_CONTROL = 3; // visite technique
    const TYPE_CIRCULATION_TAX = 4; // vignette
    const TYPE_CAR_OTHER = 9;
    const CAR_TYPES = [ 1, 2, 3, 4, 9 ];

    // A client's, photographed at the first rental so a returning client needn't bring copies.
    const TYPE_ID_CARD = 11;
    const TYPE_DRIVER_LICENCE = 12;
    const TYPE_PASSPORT = 13;
    const TYPE_CLIENT_OTHER = 19;
    const CLIENT_TYPES = [ 11, 12, 13, 19 ];

    protected $fillable = [ 'type', 'path', 'agency_id', 'car_id', 'client_id' ];

    protected $casts = [ 'type' => 'integer' ]; // as sent back right after an upload

    protected static function booted(): void
    {
        static::deleted(fn (Document $document) => Storage::delete($document->path));
    }
}
