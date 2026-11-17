<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Who hands the car over and who takes it back (and cleans it after): staff of the agency.
     * A returned car is to clean until `cleaned_at`.
     */
    public function up(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            $table->foreignId('pickup_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('return_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('cleaned_at')->nullable();
        });

        // Cars returned before this were cleaned long ago.
        DB::table('contracts')->whereNotNull('returned_at')->update([ 'cleaned_at' => DB::raw('returned_at') ]);
    }

    public function down(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('pickup_user_id');
            $table->dropConstrainedForeignId('return_user_id');
            $table->dropColumn('cleaned_at');
        });
    }
};
