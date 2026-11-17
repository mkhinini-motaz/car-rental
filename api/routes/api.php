<?php

use App\Http\Controllers\AgencyController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BranchController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\RecurringBillController;
use App\Http\Controllers\CashBookController;
use App\Http\Controllers\CheckInController;
use App\Http\Controllers\CarController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\ContractController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DeviceTokenController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\FineController;
use App\Http\Controllers\ImportController;
use App\Http\Controllers\IncomeController;
use App\Http\Controllers\PdfController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\SignupController;
use App\Http\Controllers\FileController;
use App\Http\Controllers\UserController;
use App\Http\Middleware\TokenMatchesPassword;

Route::post('login', [AuthController::class, 'login'])->middleware('throttle:5,1');
Route::post('otp/request', [AuthController::class, 'requestCode'])->middleware('throttle:5,1,otp');
Route::post('password/reset', [AuthController::class, 'resetPassword'])->middleware('throttle:5,1,reset');
Route::post('signup/code', [SignupController::class, 'requestCode'])->middleware('throttle:5,1,signup-code');
Route::post('signup', [SignupController::class, 'store'])->middleware('throttle:5,1,signup');
Route::delete('device-token/{token}', [DeviceTokenController::class, 'destroy'])->middleware('throttle:10,1');
Route::get('file/{path}', FileController::class)->where('path', '.*')->middleware('signed:relative')->name('file');
Route::get('checkin/{contract}', [CheckInController::class, 'show'])->middleware('signed:relative')->name('checkin');
Route::post('checkin/{contract}', [CheckInController::class, 'store'])->middleware([ 'signed:relative', 'throttle:10,1' ]);
Route::get('pdf/{kind}/{contract}', [PdfController::class, 'show'])->middleware('signed:relative')->name('pdf');
Route::get('report/export', [ReportController::class, 'export'])->middleware('signed:relative')->name('report.export');
Route::get('import/template/{kind}', [ImportController::class, 'template'])->middleware('signed:relative')->name('import.template');
Route::group([ 'middleware' => [ 'auth', TokenMatchesPassword::class ] ], function ($router) {
    Route::post('logout', [AuthController::class, 'logout']);
    Route::post('refresh', [AuthController::class, 'refresh']);
    Route::get('me', [AuthController::class, 'me']);
    Route::put('me', [AuthController::class, 'updateMe']);

    Route::get('agency', [AgencyController::class, 'show']);
    Route::get('agency/pricing', [AgencyController::class, 'pricing']);
    Route::get('dashboard', [DashboardController::class, 'show']);
    Route::get('planning', [CarController::class, 'planning']);

    Route::get('expense', [ExpenseController::class, 'index']);
    Route::post('expense', [ExpenseController::class, 'store']);

    Route::get('fine', [FineController::class, 'index']);
    Route::post('fine', [FineController::class, 'store']);
    Route::get('fine/{fineId}', [FineController::class, 'show']);
    Route::put('fine/{fineId}', [FineController::class, 'update']);
    Route::put('fine/{fineId}/client', [FineController::class, 'updateClient']);
    Route::post('fine/{fineId}/payout', [FineController::class, 'storePayout']);
    Route::delete('fine/{fineId}/payout', [FineController::class, 'destroyPayout']);

    Route::get('car', [CarController::class, 'index']);
    Route::get('car/{carId}', [CarController::class, 'show']);
    Route::get('car/{carId}/quote', [CarController::class, 'quote']);
    Route::post('car/{carId}/photo', [CarController::class, 'photo']);
    Route::post('car/{carId}/block', [CarController::class, 'storeBlock']);
    Route::delete('car/{carId}/block/{blockId}', [CarController::class, 'destroyBlock']);
    Route::post('car/{carId}/damage', [CarController::class, 'storeDamages']);
    Route::post('car/{carId}/damage/{damageId}/repair', [CarController::class, 'repairDamage']);

    Route::get('client', [ClientController::class, 'index']);
    Route::post('client', [ClientController::class, 'store']);
    Route::get('client/{clientId}', [ClientController::class, 'show']);
    Route::put('client/{clientId}', [ClientController::class, 'update']);
    Route::post('client/{clientId}/document', [DocumentController::class, 'storeForClient']);
    Route::post('car/{carId}/document', [DocumentController::class, 'storeForCar']);
    Route::delete('document/{documentId}', [DocumentController::class, 'destroy']);
    Route::post('device-token', [DeviceTokenController::class, 'store']);

    Route::get('contract', [ContractController::class, 'index']);
    Route::post('contract', [ContractController::class, 'store']);
    Route::post('contract/past', [ContractController::class, 'storePast']); // from the paper notebook
    Route::get('contract/{contractId}', [ContractController::class, 'show']);
    Route::put('contract/{contractId}', [ContractController::class, 'update']);
    Route::post('contract/{contractId}/pickup', [ContractController::class, 'pickup']);
    Route::get('contract/{contractId}/charges', [ContractController::class, 'charges']);
    Route::post('contract/{contractId}/return', [ContractController::class, 'return']);
    // Keeping part of the deposit is checked inside: managers can close with all of it returned.
    Route::post('contract/{contractId}/close', [ContractController::class, 'close']);
    Route::post('contract/{contractId}/cleaned', [ContractController::class, 'cleaned']);
    Route::post('contract/{contractId}/payment', [ContractController::class, 'storePayment']);
    Route::post('contract/{contractId}/pdf', [PdfController::class, 'link']);
    Route::post('contract/{contractId}/signature', [PdfController::class, 'sign']);
    Route::post('contract/{contractId}/checkin-link', [CheckInController::class, 'link']);

    // The owner only (AppServiceProvider's `owner` gate): a manager gets a 403.
    Route::group([ 'middleware' => 'can:owner' ], function () {
        Route::get('user', [UserController::class, 'index']);
        Route::post('user', [UserController::class, 'store']);
        Route::put('user/{userId}', [UserController::class, 'update']);
        Route::post('user/{userId}/invite', [UserController::class, 'invite']);
        Route::get('user/{userId}/activity', [UserController::class, 'activity']);

        Route::put('agency', [AgencyController::class, 'update']);
        Route::post('agency/logo', [AgencyController::class, 'logo']);
        Route::put('agency/pricing', [AgencyController::class, 'updatePricing']);
        Route::get('report', [ReportController::class, 'show']);
        Route::get('cashbook', [CashBookController::class, 'show']);
        Route::get('import', [ImportController::class, 'show']); // cars, clients and rentals from spreadsheets
        Route::post('import', [ImportController::class, 'store']);
        Route::post('cash-movement', [CashBookController::class, 'storeMovement']);
        Route::delete('cash-movement/{movementId}', [CashBookController::class, 'destroyMovement']);

        Route::post('car', [CarController::class, 'store']);
        Route::put('car/{carId}', [CarController::class, 'update']);
        Route::put('car/{carId}/purchase', [CarController::class, 'updatePurchase']);
        Route::post('car/{carId}/sale', [CarController::class, 'storeSale']);
        Route::delete('car/{carId}/sale', [CarController::class, 'destroySale']);

        // Payroll and overhead.
        Route::get('employee', [EmployeeController::class, 'index']);
        Route::post('employee', [EmployeeController::class, 'store']);
        Route::get('employee/{employeeId}', [EmployeeController::class, 'show']);
        Route::put('employee/{employeeId}', [EmployeeController::class, 'update']);
        Route::post('employee/{employeeId}/payment', [EmployeeController::class, 'storePayment']);
        Route::delete('employee/{employeeId}/payment/{paymentId}', [EmployeeController::class, 'destroyPayment']);
        Route::get('branch', [BranchController::class, 'index']);
        Route::post('branch', [BranchController::class, 'store']);
        Route::put('branch/{branchId}', [BranchController::class, 'update']);
        Route::delete('branch/{branchId}', [BranchController::class, 'destroy']);
        Route::get('recurring-bill', [RecurringBillController::class, 'index']);
        Route::post('recurring-bill', [RecurringBillController::class, 'store']);
        Route::put('recurring-bill/{billId}', [RecurringBillController::class, 'update']);
        Route::delete('recurring-bill/{billId}', [RecurringBillController::class, 'destroy']);
        Route::post('recurring-bill/{billId}/pay', [RecurringBillController::class, 'pay']);

        Route::get('income', [IncomeController::class, 'index']);
        Route::post('income', [IncomeController::class, 'store']);
        Route::delete('income/{incomeId}', [IncomeController::class, 'destroy']);
        Route::delete('expense/{expenseId}', [ExpenseController::class, 'destroy']);
        Route::delete('fine/{fineId}', [FineController::class, 'destroy']);
        Route::delete('contract/{contractId}', [ContractController::class, 'destroy']);
        Route::delete('contract/{contractId}/payment/{paymentId}', [ContractController::class, 'destroyPayment']);
    });
});
