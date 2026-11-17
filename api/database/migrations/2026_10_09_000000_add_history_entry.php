<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Old data an agency that joins with a past can enter: what a car brought in before the app
     * (its payback then counts), and who had the car for a fine from a rental kept on paper.
     */
    public function up(): void
    {
        Schema::table('cars', function (Blueprint $table) {
            $table->unsignedInteger('earned_before')->nullable(); // millimes, after its running costs
        });

        Schema::table('fines', function (Blueprint $table) {
            // Only when no rental in the app matches (the paper contract's renter).
            $table->foreignId('client_id')->nullable()->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('fines', function (Blueprint $table) {
            $table->dropConstrainedForeignId('client_id');
        });

        Schema::table('cars', function (Blueprint $table) {
            $table->dropColumn('earned_before');
        });
    }
};
