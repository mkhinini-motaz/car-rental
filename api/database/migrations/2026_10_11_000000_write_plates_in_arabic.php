<?php

use App\Models\Car;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Plates as on the plate itself: 245 TU 1234 becomes 245 تونس 1234. A plate whose new form is
     * taken already (the same car typed both ways) stays as it was.
     */
    public function up(): void
    {
        $this->rewrite(fn (string $plate) => Car::normalizePlate($plate));
    }

    public function down(): void
    {
        $this->rewrite(fn (string $plate) => str_replace(' تونس ', ' TU ', $plate));
    }

    private function rewrite(callable $write): void
    {
        foreach (DB::table('cars')->pluck('licence_plate', 'id') as $id => $plate) {
            $new = $write($plate);
            if ($new !== $plate && ! DB::table('cars')->where('licence_plate', $new)->exists()) {
                DB::table('cars')->where('id', $id)->update([ 'licence_plate' => $new ]);
            }
        }
    }
};
