<?php

namespace App\Console\Commands;

use App\Models\Agency;
use App\Support\AgencyImport;
use Illuminate\Console\Command;
use Illuminate\Validation\ValidationException;

/**
 * The apps' import (App\Support\AgencyImport) for us at onboarding: cars.csv, clients.csv and
 * rentals.csv from one folder (any of them). A dry run unless --apply, listing the guesses the
 * import makes (applied with --apply, so read them first) and the rows it rejects.
 */
class ImportAgency extends Command
{
    protected $signature = 'agency:import
        {agency : The agency\'s id}
        {folder : Folder with cars.csv, clients.csv and/or rentals.csv}
        {--apply : Save the rows; without it nothing is saved}';

    protected $description = "Import an agency's cars, clients and rentals from CSV files (a dry run unless --apply)";

    public function handle(): int
    {
        $agency = Agency::findOrFail($this->argument('agency'));
        $folder = rtrim($this->argument('folder'), '/');
        $datasets = [];
        foreach (AgencyImport::KINDS as $kind) {
            if (is_file("$folder/$kind.csv")) {
                try {
                    $datasets[$kind] = AgencyImport::read(file_get_contents("$folder/$kind.csv"), $kind);
                } catch (ValidationException $exception) {
                    $this->error("$kind.csv: " . $exception->validator->errors()->first());
                    return self::FAILURE;
                }
            }
        }
        if (! $datasets) {
            $this->error("No cars.csv, clients.csv or rentals.csv in $folder.");
            return self::FAILURE;
        }
        $this->info("{$agency->name} (agency {$agency->id})" . ($this->option('apply') ? '' : ': dry run, nothing is saved'));

        $import = new AgencyImport($agency);
        $rows = collect($datasets)->map(fn ($dataset) => $dataset['rows'])->all();
        $report = $this->option('apply') ? $import->apply($rows) : $import->check($rows);
        foreach ($report as $kind => $result) {
            $header = $datasets[$kind]['header'];
            $counts = $result['counts'];
            $this->newLine();
            $this->line("<options=bold>$kind.csv</>: {$counts['new']} new, {$counts['updated']} updated, {$counts['unchanged']} unchanged, {$counts['rejected']} rejected");
            foreach ($header['fixes'] as $fix) {
                $this->line("  column \"{$fix['from']}\" read as {$fix['to']}" . ($fix['sure'] ? '' : ' (guess)'));
            }
            if ($header['ignored']) {
                $this->line('  columns ignored: ' . implode(', ', $header['ignored']));
            }
            $lines = collect($result['rows'])->flatMap(fn ($row) => [
                ...collect($row['fixes'])->where('sure', false)->map(fn ($fix) => [ $row['line'], $fix['column'], "guess: \"{$fix['from']}\" → \"{$fix['to']}\"" ]),
                ...collect($row['errors'])->map(fn ($error) => [ $row['line'], $error['column'], $error['code'] . ($error['params'] ? ' ' . json_encode($error['params'], JSON_UNESCAPED_UNICODE) : '') ]),
            ]);
            if ($lines->isNotEmpty()) {
                $this->table([ 'Row', 'Column', 'What' ], $lines->all());
            }
        }
        $this->newLine();
        $this->info($this->option('apply') ? 'Saved.' : 'Nothing saved. Run again with --apply to save the rows that are not rejected, guesses included.');

        return self::SUCCESS;
    }
}
