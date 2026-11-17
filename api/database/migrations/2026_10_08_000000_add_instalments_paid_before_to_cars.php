<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Instalments of a credit paid before the car was added to the app (on paper), so an agency
     * that joins with cars half paid off doesn't see every past instalment as due.
     */
    public function up(): void
    {
        Schema::table('cars', function (Blueprint $table) {
            $table->unsignedSmallInteger('instalments_paid_before')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('cars', function (Blueprint $table) {
            $table->dropColumn('instalments_paid_before');
        });
    }
};
