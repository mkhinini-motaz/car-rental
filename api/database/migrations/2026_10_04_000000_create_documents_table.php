<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Photos of papers: a car's (carte grise, insurance, visite technique, vignette) or a client's
     * (ID card, driving licence, passport). One of car_id and client_id is set. `type` matches the
     * constants on App\Models\Document. No soft delete: a client's papers must be gone on request.
     */
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('type');
            $table->string('path'); // on the default (private) disk

            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->foreignId('car_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('client_id')->nullable()->constrained()->cascadeOnDelete();

            $table->unsignedInteger('created_at');
            $table->unsignedInteger('updated_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
