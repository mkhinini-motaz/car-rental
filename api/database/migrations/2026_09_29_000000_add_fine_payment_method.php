<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * How a fine was paid and who recorded it, so fines paid in cash show in the cash book.
     */
    public function up(): void
    {
        Schema::table('fines', function (Blueprint $table) {
            $table->unsignedSmallInteger('method')->nullable(); // App\Models\Payment::METHOD_*, when paid by the client or the agency
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete(); // who settled it
        });
    }

    public function down(): void
    {
        Schema::table('fines', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
            $table->dropColumn('method');
        });
    }
};
