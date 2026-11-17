<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Storage;

/**
 * Serves an upload through the signed link `fileUrl()` gives. Links don't expire and a file
 * never changes (a new photo gets a new name), so phones may cache it for good.
 */
class FileController extends Controller
{
    public function __invoke(string $path)
    {
        abort_unless(Storage::exists($path), 404);

        return Storage::response($path, null, [ 'Cache-Control' => 'private, max-age=31536000, immutable' ]);
    }
}
