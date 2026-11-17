<?php

namespace App\Http\Controllers;

use App\Support\AgencyImport;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\ValidationException;

/**
 * The agency's cars, clients and rentals from spreadsheets (App\Support\AgencyImport). Owner only.
 */
class ImportController extends Controller
{
    /**
     * What each file holds, for the apps' guide, with a day-long link to its template (the phone's
     * browser downloads it without a session).
     */
    public function show()
    {
        return response()->json([ 'data' => collect(AgencyImport::KINDS)->mapWithKeys(fn ($kind) => [ $kind => [
            'columns' => collect(AgencyImport::columns($kind))->map(fn ($column, $name) => [
                'name' => $name,
                'type' => $column['type'],
                'required' => $column['required'],
                'label' => $column['label'],
                'example' => $column['examples'][0] ?: null,
                'options' => $column['options'] ? collect($column['options'])->map(fn ($words, $value) => [
                    'value' => $value, 'label' => AgencyImport::OPTION_LABELS[$name] . $value, 'words' => $words,
                ])->values() : null,
            ])->values(),
            'template_url' => url(URL::temporarySignedRoute('import.template', now()->addDay(), [ 'kind' => $kind ], absolute: false)),
        ] ]) ]);
    }

    public function template(string $kind)
    {
        abort_unless(in_array($kind, AgencyImport::KINDS, true), 404);

        return response(AgencyImport::template($kind), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"$kind.csv\"",
        ]);
    }

    /**
     * Checks the uploaded files (`files[cars]`, `files[clients]`, `files[rentals]`) or the rows the
     * apps send back with the user's corrections (`rows[cars]`: line and cells), and with `apply`
     * saves them. The report lists every row with its fixes, errors and result; a file's also says
     * how its header was read.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'files'   => 'array',
            'files.*' => 'file|max:4096',
            'rows'    => 'array',
            'rows.*'  => 'array|max:' . AgencyImport::MAX_ROWS,
            'apply'   => 'boolean',
        ]);
        $kinds = array_keys([ ...($data['files'] ?? []), ...($data['rows'] ?? []) ]);
        if (! $kinds || array_diff($kinds, AgencyImport::KINDS)) {
            throw ValidationException::withMessages([ 'files' => 'import:error:kind' ]);
        }
        // By hand: wildcard rules over thousands of rows exhaust the memory.
        foreach ($data['rows'] ?? [] as $kind => $rows) {
            foreach ($rows as $row) {
                $cells = $row['cells'] ?? null;
                if (! is_int($row['line'] ?? null) || $row['line'] < 1 || ! is_array($cells)
                    || collect($cells)->contains(fn ($cell) => $cell !== null && (! is_string($cell) || mb_strlen($cell) > 2000))) {
                    throw ValidationException::withMessages([ "rows.$kind" => 'import:error:invalid' ]);
                }
            }
        }

        $headers = [];
        $datasets = [];
        foreach ($request->file('files', []) as $kind => $file) {
            [ 'header' => $headers[$kind], 'rows' => $datasets[$kind] ] = AgencyImport::read($file->get(), $kind);
        }
        foreach ($data['rows'] ?? [] as $kind => $rows) {
            $datasets[$kind] ??= $rows;
        }
        $import = new AgencyImport($request->user()->agency);
        $report = $request->boolean('apply') ? $import->apply($datasets) : $import->check($datasets);
        foreach ($headers as $kind => $header) {
            $report[$kind]['header'] = $header;
        }

        return response()->json([ 'data' => $report ]);
    }
}
