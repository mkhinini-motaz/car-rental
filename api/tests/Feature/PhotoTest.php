<?php

namespace Tests\Feature;

use App\Models\Car;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use function App\Support\Helpers\uploadFile;

class PhotoTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_photo_bigger_than_the_apps_send_is_scaled_down_and_one_that_fits_is_kept(): void
    {
        Storage::fake();
        $user = User::factory()->create();
        $car = Car::factory()->create([ 'agency_id' => $user->agency_id ]);

        $this->actingAsUser($user)->postJson("/api/car/{$car->id}/photo", [ 'photo' => UploadedFile::fake()->image('camera.jpg', 3000, 2000) ])->assertOk();
        $path = $car->refresh()->photo;
        $this->assertStringEndsWith('.jpg', $path);
        $this->assertSame([ 1600, 1067 ], array_slice(getimagesize(Storage::path($path)), 0, 2));

        $fits = UploadedFile::fake()->image('app.png', 1200, 900);
        $path = uploadFile($fits, 'cars/1');
        $this->assertStringEndsWith('.png', $path); // untouched, not compressed twice
        $this->assertSame($fits->getSize(), Storage::size($path));
    }

    public function test_transparency_goes_on_white_and_a_sideways_camera_photo_is_turned_upright(): void
    {
        Storage::fake();
        $logo = imagecreatetruecolor(2000, 1000);
        imagealphablending($logo, false);
        imagesavealpha($logo, true);
        imagefill($logo, 0, 0, imagecolorallocatealpha($logo, 0, 0, 0, 127));
        imagepng($logo, $file = tempnam(sys_get_temp_dir(), 'logo'));
        $path = uploadFile(new UploadedFile($file, 'logo.png', 'image/png', null, true), 'agencies/1');
        $stored = imagecreatefromjpeg(Storage::path($path));
        $this->assertSame([ 1600, 800 ], [ imagesx($stored), imagesy($stored) ]);
        $this->assertGreaterThan(250, imagecolorat($stored, 0, 0) & 0xFF); // white, not black

        if (! function_exists('exif_read_data')) {
            $this->markTestSkipped('The exif extension is not loaded.');
        }
        // A landscape bitmap, white at its left end, whose EXIF says "rotate 90° clockwise to view" (orientation 6).
        $sideways = imagecreatetruecolor(1700, 10);
        imagefilledrectangle($sideways, 0, 0, 199, 9, imagecolorallocate($sideways, 255, 255, 255));
        ob_start();
        imagejpeg($sideways);
        $jpeg = ob_get_clean();
        $exif = "Exif\0\0MM\0\x2A\0\0\0\x08\0\x01\x01\x12\0\x03\0\0\0\x01\0\x06\0\0\0\0\0\0";
        file_put_contents($file, substr($jpeg, 0, 2) . "\xFF\xE1" . pack('n', strlen($exif) + 2) . $exif . substr($jpeg, 2));
        $this->assertSame(6, exif_read_data($file)['Orientation']);

        $path = uploadFile(new UploadedFile($file, 'sideways.jpg', 'image/jpeg', null, true), 'contracts/1');
        $upright = imagecreatefromjpeg(Storage::path($path));
        $this->assertSame([ 9, 1600 ], [ imagesx($upright), imagesy($upright) ]);
        $this->assertGreaterThan(250, imagecolorat($upright, 4, 0) & 0xFF); // the left end is now the top
    }
}
