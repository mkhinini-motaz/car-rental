<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A one-time code that lets a user set a new password: sent by SMS when they forgot it, or
     * handed out by the owner when they invite someone. Only its hash is stored. An invited user
     * has no password until they use the code.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('password')->nullable()->change();
            $table->string('password_code')->nullable();
            $table->unsignedInteger('password_code_expires_at')->nullable();
            $table->unsignedTinyInteger('password_code_attempts')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([ 'password_code', 'password_code_expires_at', 'password_code_attempts' ]);
        });
    }
};
