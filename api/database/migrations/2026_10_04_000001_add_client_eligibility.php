<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Who may rent: the licence's expiry on the client, and the agency's rules (a minimum age and
     * years since the licence was issued; insurers refuse claims otherwise). 0 turns a rule off.
     * Breaking one only warns staff.
     */
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->string('driver_licence_expiry_date', 20)->nullable(); // dd/mm/yyyy, like the other client dates
        });
        Schema::table('agencies', function (Blueprint $table) {
            $table->unsignedTinyInteger('min_driver_age')->default(0);
            $table->unsignedTinyInteger('min_licence_years')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn('driver_licence_expiry_date');
        });
        Schema::table('agencies', function (Blueprint $table) {
            $table->dropColumn([ 'min_driver_age', 'min_licence_years' ]);
        });
    }
};
