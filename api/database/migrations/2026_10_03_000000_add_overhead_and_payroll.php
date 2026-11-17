<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The agency's own costs: its branches (rent), recurring bills, employees and what they are
     * paid. Expenses can be tagged with a branch, an employee (phone credit) or a contract (a
     * repair that counts against the client).
     */
    public function up(): void
    {
        Schema::create('branches', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('address')->nullable();
            $table->unsignedInteger('monthly_rent')->default(0); // millimes
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('created_at');
            $table->unsignedInteger('updated_at');
            $table->unsignedInteger('deleted_at')->nullable();
        });

        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->string('first_name', 100);
            $table->string('last_name', 100)->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('role_label', 50)->nullable(); // "mechanic", "washer", "manager"
            $table->unsignedInteger('monthly_salary')->default(0); // millimes
            $table->unsignedInteger('hired_at')->nullable();
            $table->boolean('active')->default(true);
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete(); // their login, if they have one
            $table->unsignedInteger('created_at');
            $table->unsignedInteger('updated_at');
            $table->unsignedInteger('deleted_at')->nullable();
        });
        // Staff who log in are employees too.
        foreach (DB::table('users')->whereNull('deleted_at')->get() as $user) {
            DB::table('employees')->insert([
                'first_name' => $user->first_name, 'last_name' => $user->last_name, 'phone' => $user->phone,
                'agency_id' => $user->agency_id, 'user_id' => $user->id, 'active' => true, 'created_at' => time(), 'updated_at' => time(),
            ]);
        }

        // Types match App\Models\SalaryPayment.
        Schema::create('salary_payments', function (Blueprint $table) {
            $table->id();
            $table->string('month', 7); // 'YYYY-MM' the payment counts for
            $table->unsignedSmallInteger('type');
            $table->unsignedInteger('amount'); // millimes
            $table->unsignedInteger('paid_at');
            $table->unsignedSmallInteger('method')->default(1); // App\Models\Payment::METHOD_*
            $table->string('note')->nullable();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedInteger('created_at');
            $table->unsignedInteger('updated_at');
            $table->unsignedInteger('deleted_at')->nullable();
        });

        // A bill that comes back (rent, internet): the Today screen shows it when due; nothing is
        // paid by itself.
        Schema::create('recurring_bills', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('category'); // App\Models\Expense::CATEGORY_*
            $table->unsignedInteger('amount'); // millimes
            $table->unsignedSmallInteger('every_months')->default(1);
            $table->unsignedInteger('next_due_at');
            $table->string('note')->nullable();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedInteger('created_at');
            $table->unsignedInteger('updated_at');
            $table->unsignedInteger('deleted_at')->nullable();
        });

        Schema::table('expenses', function (Blueprint $table) {
            $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('employee_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('contract_id')->nullable()->constrained()->nullOnDelete();
        });
        // "Other" spent on no car was the agency's own cost: it has its own category now.
        DB::table('expenses')->whereNull('car_id')->where('category', 9)->update([ 'category' => 39 ]);

        Schema::table('cars', function (Blueprint $table) {
            $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete(); // its home branch
        });
    }

    public function down(): void
    {
        Schema::table('cars', function (Blueprint $table) {
            $table->dropConstrainedForeignId('branch_id');
        });
        DB::table('expenses')->where('category', 39)->update([ 'category' => 9 ]);
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropConstrainedForeignId('contract_id');
            $table->dropConstrainedForeignId('employee_id');
            $table->dropConstrainedForeignId('branch_id');
        });
        Schema::dropIfExists('recurring_bills');
        Schema::dropIfExists('salary_payments');
        Schema::dropIfExists('employees');
        Schema::dropIfExists('branches');
    }
};
