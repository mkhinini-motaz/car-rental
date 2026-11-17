<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Phone bookings only give a name and a number; the ID and licence details are taken at
     * pickup. Phones are unique per agency, not across agencies.
     */
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->string('birth_date')->nullable()->change();
            $table->unsignedSmallInteger('gender')->nullable()->change();
            $table->string('id_number', 20)->nullable()->change();
            $table->string('driver_licence_number', 20)->nullable()->change();
            $table->string('driver_licence_delivery_date', 20)->nullable()->change();

            $table->dropUnique(['phone']);
            $table->unique(['agency_id', 'phone']);
        });

        Schema::table('contracts', function (Blueprint $table) {
            $table->text('note')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            $table->dropColumn('note');
        });

        Schema::table('clients', function (Blueprint $table) {
            $table->dropUnique(['agency_id', 'phone']);
            $table->unique('phone');

            $table->string('birth_date')->nullable(false)->change();
            $table->unsignedSmallInteger('gender')->nullable(false)->change();
            $table->string('id_number', 20)->nullable(false)->change();
            $table->string('driver_licence_number', 20)->nullable(false)->change();
            $table->string('driver_licence_delivery_date', 20)->nullable(false)->change();
        });
    }
};
