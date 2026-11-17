<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The agency's defaults, read instead of hard-coded values: tax ID and contract terms for the
     * paperwork, the usual pickup and return times, when to warn about papers and oil changes,
     * how long a car may stay in the fleet, and the employer's social charges on salaries.
     */
    public function up(): void
    {
        Schema::table('agencies', function (Blueprint $table) {
            $table->string('tax_id', 30)->nullable(); // matricule fiscal
            $table->text('contract_terms')->nullable();
            $table->string('pickup_time', 5)->default('10:00'); // HH:MM, the agency's time
            $table->string('return_time', 5)->default('10:00');
            $table->unsignedSmallInteger('expiry_warning_days')->default(7); // insurance, tax, technical control
            $table->unsignedInteger('oil_warning_km')->default(500); // flagged this far before it's due
            $table->unsignedSmallInteger('oil_warning_days')->default(7);
            $table->unsignedTinyInteger('fleet_max_years')->default(3); // Tunisian rule: sold 3 years after first registration
            $table->unsignedSmallInteger('employer_charges_rate')->default(0); // hundredths of a percent (1657 = 16.57 %), 0 = off
        });
    }

    public function down(): void
    {
        Schema::table('agencies', function (Blueprint $table) {
            $table->dropColumn([ 'tax_id', 'contract_terms', 'pickup_time', 'return_time', 'expiry_warning_days', 'oil_warning_km', 'oil_warning_days', 'fleet_max_years', 'employer_charges_rate' ]);
        });
    }
};
