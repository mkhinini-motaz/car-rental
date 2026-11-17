@extends('pdf.layout')

{{-- A receipt for one payment. --}}
@section('content')
<h1>{{ $t('receipt_title', [ 'number' => $payment->id ]) }}</h1>
<div class="muted">{{ $t('date', [ 'date' => $date($payment->paid_at) ]) }}</div>
<p style="font-size: 12pt; margin-top: 8mm">{{ $t('receipt_text', [
    'name' => $contract->client->first_name . ' ' . $contract->client->last_name,
    'amount' => $money($payment->amount),
    'method' => $t('method_' . $payment->method),
    'id' => $contract->id,
]) }}</p>
<p class="muted">{{ $t('rental_of', [ 'car' => $ltr($contract->car->manufacturer . ' ' . $contract->car->model_name . ' · ' . $plate($contract->car->licence_plate)), 'start' => $date($contract->starts_at), 'end' => $date($contract->ends_at) ]) }}</p>
<table style="margin-top: 10mm">
    <tr><td style="width: 52%"></td><td class="box"><div>{{ $t('signature_agency') }}</div></td></tr>
</table>
@endsection
