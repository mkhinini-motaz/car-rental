<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The activity log also records changes to staff accounts (role, branch, disabled...):
     * such a line has a `staff_id` and no contract. A manager can be tied to one branch.
     */
    public function up(): void
    {
        Schema::table('activities', function (Blueprint $table) {
            $table->unsignedBigInteger('contract_id')->nullable()->change();
            $table->foreignId('staff_id')->nullable()->constrained('users')->cascadeOnDelete();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('branch_id');
        });

        Schema::table('activities', function (Blueprint $table) {
            $table->dropConstrainedForeignId('staff_id');
        });
    }
};
