<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * More old data an agency that joins with a past can enter: the damage already on a car when
     * it came into the app (marked on the car, not at a handover: no contract, no stage), and how
     * many times a regular client rented before the app.
     */
    public function up(): void
    {
        Schema::table('contract_damages', function (Blueprint $table) {
            $table->foreignId('car_id')->nullable()->constrained()->cascadeOnDelete();
        });
        DB::table('contract_damages')->update([
            'car_id' => DB::table('contracts')->select('car_id')->whereColumn('contracts.id', 'contract_damages.contract_id'),
        ]);
        Schema::table('contract_damages', function (Blueprint $table) {
            $table->unsignedBigInteger('contract_id')->nullable()->change();
            $table->unsignedSmallInteger('stage')->nullable()->change();
        });

        Schema::table('clients', function (Blueprint $table) {
            $table->unsignedSmallInteger('rentals_before')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn('rentals_before');
        });

        DB::table('contract_damages')->whereNull('contract_id')->delete();
        Schema::table('contract_damages', function (Blueprint $table) {
            $table->unsignedBigInteger('contract_id')->nullable(false)->change();
            $table->unsignedSmallInteger('stage')->nullable(false)->change();
            $table->dropConstrainedForeignId('car_id');
        });
    }
};
