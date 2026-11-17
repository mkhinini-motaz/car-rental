<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A contract goes reserved → out (handed over) → returned → closed (settled), or cancelled.
     * Pickup and return record the time and the odometer; the security deposit is taken at
     * pickup and settled at close. Rent payments are their own rows.
     * Statuses match the constants on App\Models\Contract.
     */
    public function up(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            $table->unsignedSmallInteger('status')->default(1);
            $table->unsignedInteger('picked_up_at')->nullable();
            $table->unsignedInteger('pickup_mileage')->nullable();
            $table->unsignedInteger('returned_at')->nullable();
            $table->unsignedInteger('return_mileage')->nullable();
            $table->unsignedInteger('deposit')->default(0);
            $table->unsignedSmallInteger('deposit_method')->nullable();
            $table->unsignedInteger('deposit_kept')->default(0);
            $table->string('deposit_kept_reason')->nullable();
        });

        // Existing contracts: cancelled ones were soft-deleted; past ones are treated as settled
        // and running ones as handed over at their start.
        $now = time();
        DB::table('contracts')->whereNotNull('deleted_at')->update([ 'status' => 5 ]);
        DB::table('contracts')->whereNull('deleted_at')->where('ends_at', '<=', $now)
            ->update([ 'status' => 4, 'picked_up_at' => DB::raw('starts_at'), 'returned_at' => DB::raw('ends_at') ]);
        DB::table('contracts')->whereNull('deleted_at')->where('ends_at', '>', $now)->where('starts_at', '<=', $now)
            ->update([ 'status' => 2, 'picked_up_at' => DB::raw('starts_at') ]);

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('amount'); // millimes
            $table->unsignedSmallInteger('method');
            $table->unsignedInteger('paid_at');

            $table->foreignId('contract_id')->constrained()->cascadeOnDelete();

            $table->unsignedInteger('created_at');
            $table->unsignedInteger('updated_at');
            $table->unsignedInteger('deleted_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');

        Schema::table('contracts', function (Blueprint $table) {
            $table->dropColumn([
                'status', 'picked_up_at', 'pickup_mileage', 'returned_at', 'return_mileage',
                'deposit', 'deposit_method', 'deposit_kept', 'deposit_kept_reason',
            ]);
        });
    }
};
