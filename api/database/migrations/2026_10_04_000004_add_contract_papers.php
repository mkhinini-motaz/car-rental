<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The contract's paperwork: the client's signature (an SVG path drawn on the phone, in a
     * 600 × 200 box), and the invoice number, given the first time an invoice is asked for.
     * The agency's VAT rate and fiscal stamp go on invoices (0: not shown).
     */
    public function up(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            $table->text('signature')->nullable();
            $table->unsignedInteger('signed_at')->nullable();
            $table->string('invoice_number', 20)->nullable(); // 2026-0001, per agency and year
            $table->unsignedInteger('invoiced_at')->nullable();
        });
        Schema::table('agencies', function (Blueprint $table) {
            $table->unsignedSmallInteger('vat_rate')->default(0); // hundredths of a percent: 1900 = 19 %, prices include it
            $table->unsignedInteger('fiscal_stamp')->default(0); // millimes, the timbre fiscal added to an invoice
        });
    }

    public function down(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            $table->dropColumn([ 'signature', 'signed_at', 'invoice_number', 'invoiced_at' ]);
        });
        Schema::table('agencies', function (Blueprint $table) {
            $table->dropColumn([ 'vat_rate', 'fiscal_stamp' ]);
        });
    }
};
