<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Where the booking came from (`source`, App\Models\Contract::SOURCES), the hotel, travel agency
     * or courtier who brought it, and the commission they take: a cost of the rental.
     */
    public function up(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            $table->unsignedTinyInteger('source')->nullable();
            $table->string('broker', 100)->nullable();
            $table->unsignedInteger('commission')->default(0); // millimes
        });
    }

    public function down(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            $table->dropColumn([ 'source', 'broker', 'commission' ]);
        });
    }
};
