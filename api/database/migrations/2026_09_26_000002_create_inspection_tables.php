<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The vehicle inspection done at pickup and at return: photos from fixed angles and damage
     * marked on a car outline. `stage` and `angle` match the constants on App\Models\ContractPhoto.
     */
    public function up(): void
    {
        Schema::create('contract_photos', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('stage');
            $table->unsignedSmallInteger('angle');
            $table->string('path'); // on the default disk

            $table->foreignId('contract_id')->constrained()->cascadeOnDelete();

            $table->unsignedInteger('created_at');
            $table->unsignedInteger('updated_at');
            $table->unsignedInteger('deleted_at')->nullable();
        });

        Schema::create('contract_damages', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('stage');
            // Position on the outline in thousandths of its width and height, from the top left
            // (the front of the car is at the top).
            $table->unsignedSmallInteger('x');
            $table->unsignedSmallInteger('y');
            $table->string('note')->nullable();

            $table->foreignId('contract_id')->constrained()->cascadeOnDelete();

            $table->unsignedInteger('created_at');
            $table->unsignedInteger('updated_at');
            $table->unsignedInteger('deleted_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contract_damages');
        Schema::dropIfExists('contract_photos');
    }
};
