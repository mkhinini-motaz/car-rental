<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The phones that get the staff's push notifications (Firebase Cloud Messaging tokens). A
     * token belongs to the last user who signed in on that phone.
     */
    public function up(): void
    {
        Schema::create('device_tokens', function (Blueprint $table) {
            $table->id();
            $table->string('token')->unique();
            $table->string('platform', 10); // android, ios
            $table->string('lang', 5)->default('tnfr'); // the app's language, for the notification's text

            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            $table->unsignedInteger('created_at');
            $table->unsignedInteger('updated_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('device_tokens');
    }
};
