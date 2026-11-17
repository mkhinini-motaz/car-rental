<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Expenses and maintenance per car, oil-change intervals, traffic fines, the agency's
     * pricing rules and the extras sold with a contract.
     */
    public function up(): void
    {
        Schema::table('cars', function (Blueprint $table) {
            // A swatch (#rrggbb) or, for a colour the palette doesn't have, its name.
            $table->string('colour', 30)->nullable()->change();
            $table->unsignedInteger('oil_change_every_km')->default(10000);
            $table->unsignedSmallInteger('oil_change_every_months')->default(12);
        });

        Schema::table('agencies', function (Blueprint $table) {
            $table->json('pricing')->nullable(); // seasons, duration discounts and extras, see App\Support\Pricing
        });

        Schema::table('contracts', function (Blueprint $table) {
            $table->json('extras')->nullable(); // [{ name, price, per }], prices copied at the time
        });

        // Categories match the constants on App\Models\Expense. car_id is null for agency-wide costs.
        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('category');
            $table->unsignedInteger('amount'); // millimes
            $table->unsignedInteger('spent_at');
            $table->unsignedInteger('mileage')->nullable();
            $table->string('garage')->nullable();
            $table->string('note')->nullable();

            $table->foreignId('car_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();

            $table->unsignedInteger('created_at');
            $table->unsignedInteger('updated_at');
            $table->unsignedInteger('deleted_at')->nullable();
        });

        // Statuses match the constants on App\Models\Fine. contract_id is the rental active when
        // the offence was committed, if any.
        Schema::create('fines', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('committed_at');
            $table->unsignedInteger('amount'); // millimes
            $table->string('reference')->nullable(); // the PV number
            $table->string('note')->nullable();
            $table->unsignedSmallInteger('status')->default(1);
            $table->unsignedInteger('settled_at')->nullable();

            $table->foreignId('car_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contract_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();

            $table->unsignedInteger('created_at');
            $table->unsignedInteger('updated_at');
            $table->unsignedInteger('deleted_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fines');
        Schema::dropIfExists('expenses');

        Schema::table('contracts', function (Blueprint $table) {
            $table->dropColumn('extras');
        });

        Schema::table('agencies', function (Blueprint $table) {
            $table->dropColumn('pricing');
        });

        Schema::table('cars', function (Blueprint $table) {
            $table->dropColumn([ 'oil_change_every_km', 'oil_change_every_months' ]);
            $table->string('colour', 7)->nullable()->change();
        });
    }
};
