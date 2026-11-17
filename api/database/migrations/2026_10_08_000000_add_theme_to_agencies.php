<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The agency's look, chosen by the owner for every staff member: a palette and light or dark.
     */
    public function up(): void
    {
        Schema::table('agencies', function (Blueprint $table) {
            $table->string('theme', 20)->nullable(); // App\Models\Agency::THEMES; null: the apps' default
            $table->unsignedSmallInteger('theme_mode')->default(1); // App\Models\Agency::THEME_MODE_*
        });
    }

    public function down(): void
    {
        Schema::table('agencies', function (Blueprint $table) {
            $table->dropColumn([ 'theme', 'theme_mode' ]);
        });
    }
};
