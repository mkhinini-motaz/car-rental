<?php

namespace App\Support\Helpers;

/**
 * Query builder helper for the Like operator
 *
 * Return value can be used as follow :
 *     \Illuminate\Database\Query\Builder::where(fieldsLike(...))
 *     \Illuminate\Database\Eloquent\Model::with(['relationName' => fieldsLike(...)])
 *
 * @param string $term
 * @param array ...$fields
 *
 * @return \Closure
 */
function fieldsLike($term, ...$fields)
{
    // Grouped, so the ORs don't swallow constraints already on the query (e.g. inside whereHas).
    return function ($query) use ($term, $fields) {
        $query->where(function ($query) use ($term, $fields) {
            foreach ($fields as $field) {
                $query->orWhere($field, 'LIKE', '%' . $term . '%');
            }
        });
    };
}

/**
 * Query builder helper for first name and last name search with the Like operator
 *
 * Return value can be used as follow :
 *     \Illuminate\Database\Query\Builder::where(firstNameLastNameLike(...))
 *     \Illuminate\Database\Eloquent\Model::with(['relationName' => firstNameLastNameLike(...)])
 *
 * @param string $term
 *
 * @return \Closure
 */
function firstNameLastNameLike($term)
{
    return function ($query) use ($term) {
        $query->whereRaw("CONCAT(last_name, ' ', first_name) LIKE ?", ["%{$term}%"])
              ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", ["%{$term}%"]);
    };
}

/**
 * Defines a callable that creates an Eloquent where clause to find entities that occurs in period. The queried entity
 * must have a start date and an end date column, end date may be null , applying order is optional.
 *
 * Return value can be used as follow :
 *     \Illuminate\Database\Query\Builder::where(whereOccursInPeriod(...))
 *     \Illuminate\Database\Eloquent\Model::with(['relationName' => whereOccursInPeriod(...)])
 *
 * @param string $startsAtColumnName  must be a valid column name in the entity using this function
 * @param string $endsAtColumnName    must be a valid column name in the entity using this function
 * @param int $periodStartsAt         UNIX timestamp
 * @param int $periodEndsAt           UNIX timestamp
 * @param int $periodEndsAt           UNIX timestamp
 * @param bool $withInnerSearch
 * @param bool $withOuterSearch
 *
 * @return \Closure
 */
function occursInPeriod($startsAtColumnName, $endsAtColumnName, $periodStartsAt, $periodEndsAt, $withInnerSearch = true, $withOuterSearch = true)
{
    if (! $withInnerSearch && ! $withOuterSearch) {
        throw new \InvalidArgumentException('At least one of $withInnerSearch or $withOuterSearch should be true');
    }

    return function ($query) use ($startsAtColumnName, $endsAtColumnName, $periodStartsAt, $periodEndsAt, $withInnerSearch, $withOuterSearch) {
        $query->where(function ($mainQuery) use ($startsAtColumnName, $endsAtColumnName, $periodStartsAt, $periodEndsAt, $withInnerSearch, $withOuterSearch) {
            if ($withInnerSearch) {
                $mainQuery->where(function ($firstQuery) use ($startsAtColumnName, $periodStartsAt, $periodEndsAt) {
                    // starts within period
                    $firstQuery->where($startsAtColumnName, '>=', $periodStartsAt)
                        ->where($startsAtColumnName, '<', $periodEndsAt);

                })->orWhere(function ($secondQuery) use ($endsAtColumnName, $periodStartsAt, $periodEndsAt) {
                    // ends within period
                    $secondQuery->where($endsAtColumnName, '>=', $periodStartsAt)
                        ->where($endsAtColumnName, '<', $periodEndsAt);

                });
            }

            if ($withOuterSearch) {
                $mainQuery->orWhere(function ($thirdQuery) use ($startsAtColumnName, $endsAtColumnName, $periodStartsAt, $periodEndsAt) {
                    // starts before period, ends after it
                    $thirdQuery->where($startsAtColumnName, '<=', $periodStartsAt)
                        ->where($endsAtColumnName, '>=', $periodEndsAt);
    
                })->orWhere(function ($fourthQuery) use ($startsAtColumnName, $endsAtColumnName, $periodEndsAt) {
                    // starts before period's end endsAtColumn is null
                    $fourthQuery->where($startsAtColumnName, '<', $periodEndsAt)
                        ->whereNull($endsAtColumnName);
                });
            }
        });
    };
}

/**
 * A permanent link the app can load an uploaded file from (a car photo, a logo, an inspection
 * photo) without sending its token. Files live on the private default disk; the link is signed,
 * so paths can't be guessed or changed, and relative to the host, so it works whatever address
 * the phone reaches the API at. Served by FileController. Personal papers pass `$minutes`: their
 * link stops working after that.
 *
 * @param string|null $path
 * @param int|null $minutes
 *
 * @return string|null
 */
function fileUrl($path, $minutes = null)
{
    if (! $path) {
        return null;
    }

    return url($minutes ?
        \Illuminate\Support\Facades\URL::temporarySignedRoute('file', now()->addMinutes($minutes), [ 'path' => $path ], absolute: false) :
        \Illuminate\Support\Facades\URL::signedRoute('file', [ 'path' => $path ], absolute: false));
}

/**
 * Stores an uploaded photo on the default disk under `$folder` and returns its path, like
 * `UploadedFile::store()`. The apps shrink photos before sending them (1600 px on the longest side,
 * JPEG quality 0.7), and what fits that is stored untouched so it isn't compressed twice. Anything
 * bigger (an old build, a browser that couldn't resize, a direct call) is turned upright, scaled to
 * 1600 px and saved again as a JPEG at quality 70, transparency on white. What gd can't read is
 * stored as it came: the request already validated it as an image.
 *
 * @param \Illuminate\Http\UploadedFile $file
 * @param string $folder
 *
 * @return string
 */
function uploadFile($file, $folder)
{
    $maxSide = 1600;
    [ $width, $height ] = @getimagesize($file->getRealPath()) ?: [ 0, 0 ];
    $isOversized = max($width, $height) > $maxSide || $file->getSize() > 1024 * 1024;
    // ponytail: gd holds the whole bitmap, 4 bytes a pixel; above 40 MP (160 MB) the photo is kept as is.
    $source = $isOversized && $width * $height <= 40_000_000 ? @imagecreatefromstring($file->getContent()) : false;
    if (! $source) {
        return $file->store($folder);
    }

    // The camera may only record how the phone was held; gd drops that note, so apply it first.
    $orientation = function_exists('exif_read_data') ? (@exif_read_data($file->getRealPath())['Orientation'] ?? 1) : 1;
    $angle = [ 3 => 180, 6 => -90, 8 => 90 ][ $orientation ] ?? 0;
    if ($angle) {
        $source = imagerotate($source, $angle, 0);
    }

    $scale = min(1, $maxSide / max(imagesx($source), imagesy($source)));
    $photo = imagecreatetruecolor(max(1, (int) round(imagesx($source) * $scale)), max(1, (int) round(imagesy($source) * $scale)));
    imagefill($photo, 0, 0, imagecolorallocate($photo, 255, 255, 255));
    imagecopyresampled($photo, $source, 0, 0, 0, 0, imagesx($photo), imagesy($photo), imagesx($source), imagesy($source));
    ob_start();
    imagejpeg($photo, null, 70);
    $path = $folder . '/' . \Illuminate\Support\Str::random(40) . '.jpg';
    \Illuminate\Support\Facades\Storage::put($path, ob_get_clean());

    return $path;
}
