@extends('pdf.layout')

{{-- The invoice: numbered per agency and year, prices including VAT (shown when the agency has
     a rate), the fiscal stamp on top. What Tunisian law requires is to be checked with the
     agency's accountant. --}}
@section('content')
@php
    $total = $contract->totalPrice();
    $withoutVat = $agency->vat_rate ? (int) round($total * 10000 / (10000 + $agency->vat_rate)) : null;
    $toPay = $total + $agency->fiscal_stamp;
    $paid = (int) $contract->payments->sum('amount');
@endphp
<h1>{{ $t('invoice_title', [ 'number' => $ltr($contract->invoice_number) ]) }}</h1>
<div class="muted">{{ $t('date', [ 'date' => $date($contract->invoiced_at, 'd/m/Y') ]) }}</div>

<h2>{{ $t('invoice_to') }}</h2>
<div class="strong">{{ $contract->client->first_name }} {{ $contract->client->last_name }}</div>
<div>{{ $ltr($contract->client->phone) }}</div>
@if ($contract->client->id_number)<div>{{ $t('id_number') }} : {{ $ltr($contract->client->id_number) }}</div>@endif

<h2>{{ $t('price') }}</h2>
@include('pdf.lines', [ 'isInvoice' => true ])
<table>
    @if ($withoutVat !== null)
        <tr><td>{{ $t('total_ht') }}</td><td class="num">{{ $money($withoutVat) }}</td></tr>
        <tr><td>{{ $t('vat', [ 'rate' => $ltr(rtrim(rtrim(number_format($agency->vat_rate / 100, 2, ',', ''), '0'), ',')) ]) }}</td><td class="num">{{ $money($total - $withoutVat) }}</td></tr>
        <tr><td>{{ $t('total_ttc') }}</td><td class="num">{{ $money($total) }}</td></tr>
    @endif
    @if ($agency->fiscal_stamp)
        <tr><td>{{ $t('fiscal_stamp') }}</td><td class="num">{{ $money($agency->fiscal_stamp) }}</td></tr>
    @endif
    <tr><td class="strong">{{ $t('to_pay') }}</td><td class="num strong">{{ $money($toPay) }}</td></tr>
    <tr><td>{{ $t('paid') }}</td><td class="num">{{ $money($paid) }}</td></tr>
    <tr><td class="strong">{{ $t('remaining') }}</td><td class="num strong">{{ $money(max(0, $toPay - $paid)) }}</td></tr>
</table>
@endsection
