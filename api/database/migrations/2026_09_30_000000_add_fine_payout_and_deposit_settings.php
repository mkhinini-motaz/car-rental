<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A fine can move money twice: the agency pays the authority (the payout), then the client
     * pays the agency back. And many agencies take no deposit at all: it's a setting now.
     */
    public function up(): void
    {
        Schema::table('fines', function (Blueprint $table) {
            $table->unsignedInteger('paid_out_at')->nullable(); // the agency paid the authority
            $table->unsignedSmallInteger('paid_out_method')->nullable(); // App\Models\Payment::METHOD_*
            $table->foreignId('paid_out_user_id')->nullable()->constrained('users')->nullOnDelete();
        });
        // Paid by the agency: that was the payout. `method` now only says how the client paid.
        DB::table('fines')->where('status', 4)->update([
            'paid_out_at' => DB::raw('settled_at'),
            'paid_out_method' => DB::raw('method'),
            'paid_out_user_id' => DB::raw('user_id'),
            'method' => null,
        ]);

        Schema::table('agencies', function (Blueprint $table) {
            $table->boolean('takes_deposit')->default(false);
            $table->unsignedInteger('default_deposit')->default(0); // millimes, suggested at pickup
            $table->unsignedSmallInteger('default_deposit_method')->default(1); // App\Models\Payment::METHOD_*
        });
        // Agencies that already took deposits keep the field at pickup.
        DB::table('agencies')->whereIn('id', DB::table('contracts')->join('cars', 'cars.id', '=', 'contracts.car_id')
            ->where('contracts.deposit', '>', 0)->select('cars.agency_id'))->update([ 'takes_deposit' => true ]);
    }

    public function down(): void
    {
        Schema::table('agencies', function (Blueprint $table) {
            $table->dropColumn([ 'takes_deposit', 'default_deposit', 'default_deposit_method' ]);
        });

        Schema::table('fines', function (Blueprint $table) {
            $table->dropConstrainedForeignId('paid_out_user_id');
            $table->dropColumn([ 'paid_out_at', 'paid_out_method' ]);
        });
    }
};
