<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A damage stays on the car, shown at its next handovers, until it is marked repaired.
     */
    public function up(): void
    {
        Schema::table('contract_damages', function (Blueprint $table) {
            $table->unsignedInteger('repaired_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('contract_damages', function (Blueprint $table) {
            $table->dropColumn('repaired_at');
        });
    }
};
