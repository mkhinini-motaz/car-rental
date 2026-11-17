<?php

namespace Tests\Feature;

use App\Models\Car;
use App\Models\Contract;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PdfTest extends TestCase
{
    use RefreshDatabase;

    const SIGNATURE = 'M10 150 L60 40 L120 160 L200 60 M250 100 L400 100';

    public function test_the_signed_contract_the_numbered_invoice_and_a_receipt_come_as_pdf_in_french_and_arabic(): void
    {
        $user = User::factory()->create();
        $user->agency->update([ 'tax_id' => '1234567/A/M/000', 'contract_terms' => "Le véhicule est rendu avec le plein.\nLa caution est rendue au retour.", 'vat_rate' => 1900, 'fiscal_stamp' => 1000 ]);
        $car = Car::factory()->create([ 'agency_id' => $user->agency_id ]);
        $contract = Contract::factory()->create([ 'car_id' => $car->id, 'daily_price' => 90000, 'starts_at' => time(), 'ends_at' => time() + 3 * 86400 ]);
        $payment = $contract->payments()->create([ 'amount' => 100000, 'method' => Payment::METHOD_CASH, 'paid_at' => time(), 'user_id' => $user->id ]);
        $link = fn (array $data) => $this->actingAsUser($user)->postJson("/api/contract/{$contract->id}/pdf", $data);

        $this->actingAsUser($user)->postJson("/api/contract/{$contract->id}/signature", [ 'signature' => '<script>' ])->assertUnprocessable();
        $this->actingAsUser($user)->postJson("/api/contract/{$contract->id}/signature", [ 'signature' => self::SIGNATURE ])->assertNoContent();
        $this->assertSame(self::SIGNATURE, $contract->fresh()->signature);

        foreach ([ 'fr', 'ar' ] as $lang) {
            $url = $link([ 'kind' => 'contract', 'lang' => $lang ])->assertOk()->json('data.url');
            $pdf = $this->get($url)->assertOk()->assertHeader('Content-Type', 'application/pdf');
            $this->assertStringStartsWith('%PDF', $pdf->getContent());
        }

        // Invoices are numbered per agency and year, once.
        $first = $link([ 'kind' => 'invoice', 'lang' => 'fr' ])->assertOk()->json('data.url');
        $this->get($first)->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $number = $contract->fresh()->invoice_number;
        $this->assertMatchesRegularExpression('/^\d{4}-0001$/', $number);
        $link([ 'kind' => 'invoice', 'lang' => 'ar' ])->assertOk();
        $this->assertSame($number, $contract->fresh()->invoice_number);
        $other = Contract::factory()->create([ 'car_id' => $car->id, 'starts_at' => time() + 10 * 86400, 'ends_at' => time() + 12 * 86400 ]);
        $this->actingAsUser($user)->postJson("/api/contract/{$other->id}/pdf", [ 'kind' => 'invoice', 'lang' => 'fr' ])->assertOk();
        $this->assertSame(substr($number, 0, 5) . '0002', $other->fresh()->invoice_number);

        $receipt = $link([ 'kind' => 'receipt', 'lang' => 'fr', 'payment_id' => $payment->id ])->assertOk()->json('data.url');
        $this->get($receipt)->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $link([ 'kind' => 'receipt', 'lang' => 'fr', 'payment_id' => 999 ])->assertNotFound();

        // The file needs the signed link; another agency can't ask for one.
        $this->get("/api/pdf/contract/{$contract->id}?lang=fr")->assertForbidden();
        $stranger = User::factory()->create();
        $this->actingAsUser($stranger)->postJson("/api/contract/{$contract->id}/pdf", [ 'kind' => 'contract', 'lang' => 'fr' ])->assertNotFound();
    }
}
