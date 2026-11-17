<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Colour and a photo so staff recognise a car in lists, a status the availability search
     * respects, and the last known odometer reading (updated at pickup and return).
     */
    public function up(): void
    {
        Schema::table('cars', function (Blueprint $table) {
            $table->string('colour', 7)->nullable(); // #rrggbb
            $table->unsignedSmallInteger('status')->default(1);
            $table->string('photo')->nullable(); // path on the default disk
            $table->unsignedInteger('mileage')->nullable();
        });

        Schema::table('agencies', function (Blueprint $table) {
            $table->string('phone', 20)->nullable();
            $table->string('address')->nullable();
            $table->string('logo')->nullable(); // path on the default disk
        });
    }

    public function down(): void
    {
        Schema::table('cars', function (Blueprint $table) {
            $table->dropColumn([ 'colour', 'status', 'photo', 'mileage' ]);
        });

        Schema::table('agencies', function (Blueprint $table) {
            $table->dropColumn([ 'phone', 'address', 'logo' ]);
        });
    }
};
