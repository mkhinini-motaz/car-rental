<?php

namespace App\Http\Controllers;

use App\Models\Agency;
use App\Support\MonthlyReport;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;

/**
 * The owner's monthly numbers (see App\Support\MonthlyReport for what counts where) and
 * their spreadsheet.
 */
class ReportController extends Controller
{
    // Words for the spreadsheet, which has no translations.
    const STATUS_NAMES = [ 1 => 'reserved', 2 => 'out', 3 => 'returned', 4 => 'closed', 5 => 'cancelled' ];
    const CATEGORY_NAMES = [
        1 => 'oil change', 2 => 'tyres', 3 => 'brakes', 4 => 'repair', 5 => 'fuel', 6 => 'insurance', 7 => 'tax', 8 => 'washing', 9 => 'other',
        10 => 'technical visit', 11 => 'registration', 12 => 'instalment', 13 => 'accident', 14 => 'GPS', 15 => 'parking',
        20 => 'rent', 21 => 'electricity', 22 => 'water', 23 => 'internet', 24 => 'phone', 25 => 'accountant', 26 => 'bank fees',
        27 => 'taxes and licences', 28 => 'marketing', 29 => 'software', 30 => 'office supplies', 31 => 'CNSS', 39 => 'other (agency)',
    ];

    public function show(Request $request)
    {
        [ $year, $month ] = $this->validateMonth($request);
        $agency = $request->user()->agency;

        return response()->json([ 'data' => [
            ...(new MonthlyReport($agency, $year, $month))->toArray(),
            'export_url' => url(URL::temporarySignedRoute('report.export', now()->addHour(), [ 'agency' => $agency->id, 'year' => $year, 'month' => $month ], absolute: false)),
        ] ]);
    }

    /**
     * The month's rentals and expenses as a spreadsheet (CSV, opens in Excel or Sheets).
     * Reached through the signed `export_url`, so the phone's browser can download it.
     */
    public function export(Request $request)
    {
        [ $year, $month ] = $this->validateMonth($request);
        $agency = Agency::findOrFail($request->integer('agency'));
        $monthStart = CarbonImmutable::create($year, $month, 1, 0, 0, 0, Agency::TIMEZONE);
        $report = new MonthlyReport($agency, $year, $month);
        $numbers = $report->toArray();
        $date = fn ($timestamp) => CarbonImmutable::createFromTimestamp($timestamp, Agency::TIMEZONE)->format('d/m/Y H:i');
        $dinars = fn ($millimes) => number_format($millimes / 1000, 3, '.', '');

        $file = fopen('php://temp', 'r+');
        fwrite($file, "\u{FEFF}"); // tells Excel it's UTF-8, for Arabic names
        // The month's figures first.
        foreach ([
            [ 'Revenue (TND)', $dinars($numbers['revenue']) ], [ 'Other income (TND)', $dinars($numbers['other_income']) ],
            [ 'Car costs (TND)', $dinars($numbers['car_costs']) ], [ 'Instalments (TND)', $dinars($numbers['instalments']) ],
            [ 'Overhead (TND)', $dinars($numbers['overhead']) ], [ 'Payroll (TND)', $dinars($numbers['payroll'] + $numbers['employer_charges']) ],
            [ 'Broker commissions (TND)', $dinars($numbers['commissions']) ],
            [ 'Net (TND)', $dinars($numbers['net']) ], [ 'Utilization', round($numbers['utilization_rate'] * 100, 1) . ' %' ],
            [ 'Average daily rate (TND)', $dinars($numbers['kpis']['average_daily_rate']) ], [ 'Contracts started', $numbers['kpis']['contracts_started'] ],
            [ 'Contracts cancelled', $numbers['kpis']['contracts_cancelled'] ], [ 'Average rental (days)', $numbers['kpis']['average_days'] ],
            [ 'Late returns', $numbers['kpis']['late_returns'] ], [ 'Hours late', $numbers['kpis']['late_hours'] ],
            [ 'Rent owed now (TND)', $dinars($numbers['owed_rent']) ], [ 'Fines owed now (TND)', $dinars($numbers['owed_fines']) ],
        ] as $row) {
            fputcsv($file, $row);
        }
        fputcsv($file, []);
        fputcsv($file, [ 'Contract', 'Status', 'Car', 'Plate', 'Client', 'Phone', 'Start', 'End', 'Days', 'Price/day (TND)', 'Extras (TND)', 'Charges (TND)', 'Total (TND)', 'Paid (TND)', 'Owed (TND)', 'Broker', 'Commission (TND)' ]);
        foreach ($report->monthContracts() as $contract) {
            $paid = (int) $contract->paid;
            fputcsv($file, [
                $contract->id, self::STATUS_NAMES[$contract->status], "{$contract->car->manufacturer} {$contract->car->model_name}", $contract->car->licence_plate,
                "{$contract->client->first_name} {$contract->client->last_name}", $contract->client->phone,
                $date($contract->starts_at), $date($contract->ends_at), round($contract->days(), 2), $dinars($contract->daily_price),
                $dinars($contract->extrasPrice()), $dinars($contract->chargesPrice()), $dinars($contract->totalPrice()), $dinars($paid), $dinars(max(0, $contract->totalPrice() - $paid)),
                $contract->broker, $dinars($contract->commission),
            ]);
        }
        fputcsv($file, []);
        fputcsv($file, [ 'Expense', 'Category', 'Car', 'Date', 'Amount (TND)', 'Km', 'Garage', 'Note' ]);
        foreach ($report->monthExpenses() as $expense) {
            fputcsv($file, [
                $expense->id, self::CATEGORY_NAMES[$expense->category] ?? $expense->category, $expense->car?->licence_plate ?? $expense->branch?->name ?? 'agency', $date($expense->spent_at),
                $dinars($expense->amount), $expense->mileage, $expense->garage, $expense->note,
            ]);
        }
        rewind($file);

        return response(stream_get_contents($file), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="report-' . $monthStart->format('Y-m') . '.csv"',
        ]);
    }

    private function validateMonth(Request $request): array
    {
        $request->validate([
            'year'  => 'required|integer|min:2000|max:2100',
            'month' => 'required|integer|min:1|max:12',
        ]);

        return [ $request->integer('year'), $request->integer('month') ];
    }
}
