<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Client flags and notes, a second driver and delivery places on contracts, charges at
     * return, days a car is blocked off the planning, who recorded each payment and expense,
     * the contract activity log and the cash book's manual movements.
     */
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->unsignedSmallInteger('flag')->nullable(); // App\Models\Client::FLAG_*
            $table->text('notes')->nullable();
        });

        Schema::table('contracts', function (Blueprint $table) {
            $table->foreignId('second_driver_id')->nullable()->constrained('clients')->nullOnDelete();
            $table->string('pickup_location', 100)->nullable();
            $table->string('return_location', 100)->nullable();
            $table->json('charges')->nullable(); // [{ type: km|late|damage, unit (late: hour|day), quantity, amount }], set at return
            $table->unsignedInteger('closed_at')->nullable();
            $table->unsignedInteger('deposit_returned')->nullable(); // millimes, set at close
        });
        // Closed before this: the deposit went back less what was kept.
        DB::table('contracts')->where('status', 4)->update([
            'closed_at' => DB::raw('coalesce(returned_at, ends_at)'),
            'deposit_returned' => DB::raw('deposit - deposit_kept'),
        ]);

        Schema::table('contract_damages', function (Blueprint $table) {
            $table->unsignedInteger('amount')->nullable(); // charged for it at return, millimes
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
        });

        Schema::table('expenses', function (Blueprint $table) {
            $table->unsignedSmallInteger('method')->default(1); // App\Models\Payment::METHOD_*
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
        });

        // A car taken off the planning without a contract. Reasons match App\Models\CarBlock.
        Schema::create('car_blocks', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('starts_at');
            $table->unsignedInteger('ends_at');
            $table->unsignedSmallInteger('reason');
            $table->string('note')->nullable();
            $table->foreignId('car_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('created_at');
            $table->unsignedInteger('updated_at');
            $table->unsignedInteger('deleted_at')->nullable();
        });

        // Who did what to a contract and its payments. Never edited or deleted.
        Schema::create('activities', function (Blueprint $table) {
            $table->id();
            $table->string('action', 30);
            $table->json('changes')->nullable();
            $table->foreignId('contract_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedInteger('created_at');
            $table->unsignedInteger('updated_at');
        });

        // Cash put in or taken out of the till by hand. Types match App\Models\CashMovement.
        Schema::create('cash_movements', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('type');
            $table->unsignedInteger('amount'); // millimes
            $table->unsignedInteger('moved_at');
            $table->string('note')->nullable();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedInteger('created_at');
            $table->unsignedInteger('updated_at');
            $table->unsignedInteger('deleted_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_movements');
        Schema::dropIfExists('activities');
        Schema::dropIfExists('car_blocks');

        Schema::table('expenses', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
            $table->dropColumn('method');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
        });

        Schema::table('contract_damages', function (Blueprint $table) {
            $table->dropColumn('amount');
        });

        Schema::table('contracts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('second_driver_id');
            $table->dropColumn([ 'pickup_location', 'return_location', 'charges', 'closed_at', 'deposit_returned' ]);
        });

        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn([ 'flag', 'notes' ]);
        });
    }
};
