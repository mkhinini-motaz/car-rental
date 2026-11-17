<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Models\Agency;
use App\Models\Contract;
use App\Support\BranchScope;
use App\Support\Pdf;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\Rule;

/**
 * The rental contract (signed by the client), its invoice and payment receipts, in French or
 * Arabic. The apps ask for a link, then open or share it: the PDF itself is served by a signed
 * URL that works for a week without a session, so it can go to the client by WhatsApp.
 */
class PdfController extends Controller
{
    const KINDS = [ 'contract', 'invoice', 'receipt' ];

    public function link(Request $request, $contractId)
    {
        $agency = $request->user()->agency;
        $contract = $this->find($agency, $contractId);
        $data = $request->validate([
            'kind' => [ 'required', Rule::in(self::KINDS) ],
            'lang' => [ 'required', Rule::in(Pdf::LANGS) ],
            'payment_id' => [ 'required_if:kind,receipt', 'nullable', 'integer' ],
        ]);
        if ($data['kind'] === 'receipt') {
            $contract->payments()->findOrFail($data['payment_id']);
        }
        if ($data['kind'] === 'invoice' && ! $contract->invoice_number) {
            $this->numberInvoice($agency, $contract);
        }

        return response()->json([ 'data' => [ 'url' => url(URL::temporarySignedRoute('pdf', now()->addWeek(), [
            'kind' => $data['kind'], 'contract' => $contract->id, 'lang' => $data['lang'], 'payment' => $data['payment_id'] ?? null,
        ], absolute: false)) ] ]);
    }

    /**
     * The client signs on the phone (at pickup, or later on the contract).
     */
    public function sign(Request $request, $contractId)
    {
        $contract = $this->find($request->user()->agency, $contractId);
        $data = $request->validate([ 'signature' => self::SIGNATURE_RULES ]);
        $contract->forceFill([ 'signature' => $data['signature'], 'signed_at' => time() ])->save();
        Activity::record($contract, 'signed');

        return response()->noContent();
    }

    // An SVG path in a 600 × 200 box: moves and lines only.
    const SIGNATURE_RULES = [ 'required', 'string', 'max:30000', 'regex:/^[ML0-9 .,]+$/' ];

    public function show(Request $request, string $kind, int $contract)
    {
        abort_unless(in_array($kind, self::KINDS, true) && in_array($request->query('lang'), Pdf::LANGS, true), 404);
        $contract = Contract::with([ 'car.agency', 'client', 'secondDriver', 'payments' ])->findOrFail($contract);
        $payment = $kind === 'receipt' ? $contract->payments->firstWhere('id', (int) $request->query('payment')) : null;
        abort_if($kind === 'receipt' && ! $payment, 404);

        $name = match ($kind) { 'invoice' => 'facture-' . $contract->invoice_number, 'receipt' => 'recu-' . $payment->id, default => 'contrat-' . $contract->id };
        $pdf = Pdf::render($kind, [ 'contract' => $contract, 'agency' => $contract->car->agency, 'payment' => $payment ], $request->query('lang'), $name);

        return response($pdf, 200, [ 'Content-Type' => 'application/pdf', 'Content-Disposition' => 'inline; filename="' . $name . '.pdf"' ]);
    }

    private function find(Agency $agency, $contractId): Contract
    {
        return Contract::whereHas('car', fn ($query) => $query->where('agency_id', $agency->id))->findOrFail($contractId);
    }

    /**
     * The agency's next number this year: 2026-0001, 2026-0002...
     */
    private function numberInvoice(Agency $agency, Contract $contract): void
    {
        DB::transaction(function () use ($agency, $contract) {
            Agency::whereKey($agency->id)->lockForUpdate()->first(); // one number at a time per agency
            $year = CarbonImmutable::now(Agency::TIMEZONE)->format('Y');
            // Across every branch: a branch manager's invoice still takes the agency's next number.
            $last = Contract::withoutGlobalScope(BranchScope::class)->withTrashed()
                ->whereHas('car', fn ($query) => $query->withoutGlobalScope(BranchScope::class)->where('agency_id', $agency->id))
                ->where('invoice_number', 'like', "$year-%")->max('invoice_number');
            $contract->forceFill([ 'invoice_number' => sprintf('%s-%04d', $year, $last ? (int) substr($last, 5) + 1 : 1), 'invoiced_at' => time() ])->save();
        });
    }
}
