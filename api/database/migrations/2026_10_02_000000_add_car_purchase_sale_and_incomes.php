<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * What a car cost (price, fees, credit or leasing), what it should fetch, its sale, and money
     * the agency receives that isn't rent (an insurance payout, parts sold).
     */
    public function up(): void
    {
        Schema::table('cars', function (Blueprint $table) {
            $table->unsignedInteger('purchase_price')->nullable(); // millimes
            $table->unsignedInteger('bought_at')->nullable();
            $table->unsignedInteger('purchase_fees')->default(0); // registration and paperwork
            $table->string('supplier', 100)->nullable();
            // Credit or leasing: an advance, then equal monthly instalments.
            $table->unsignedInteger('advance')->nullable();
            $table->unsignedInteger('instalment_amount')->nullable();
            $table->unsignedSmallInteger('instalment_months')->nullable();
            $table->unsignedInteger('first_instalment_at')->nullable();
            $table->string('lender', 100)->nullable();
            $table->unsignedInteger('expected_sale_price')->nullable(); // the owner's estimate, for fleet renewal
            // Sold: it leaves the fleet but keeps its history.
            $table->unsignedInteger('sold_at')->nullable();
            $table->unsignedInteger('sale_price')->nullable();
            $table->string('buyer_name', 100)->nullable();
            $table->string('buyer_phone', 20)->nullable();
            $table->unsignedSmallInteger('sale_method')->nullable(); // App\Models\Payment::METHOD_*
        });

        // Categories match App\Models\Income.
        Schema::create('incomes', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('category');
            $table->unsignedInteger('amount'); // millimes
            $table->unsignedInteger('received_at');
            $table->unsignedSmallInteger('method')->default(1); // App\Models\Payment::METHOD_*
            $table->string('note')->nullable();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->foreignId('car_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedInteger('created_at');
            $table->unsignedInteger('updated_at');
            $table->unsignedInteger('deleted_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('incomes');

        Schema::table('cars', function (Blueprint $table) {
            $table->dropColumn([
                'purchase_price', 'bought_at', 'purchase_fees', 'supplier', 'advance', 'instalment_amount', 'instalment_months',
                'first_instalment_at', 'lender', 'expected_sale_price', 'sold_at', 'sale_price', 'buyer_name', 'buyer_phone', 'sale_method',
            ]);
        });
    }
};
