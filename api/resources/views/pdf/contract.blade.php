@extends('pdf.layout')

{{-- The rental contract, laid out like the agency's paper one: the parties, the car, the dates
     and kilometres, the price and deposit, the terms, and the client's signature. --}}
@section('content')
@php
    $people = array_filter([ 'renter' => $contract->client, 'second_driver' => $contract->secondDriver ]);
    $car = $contract->car;
@endphp
<h1>{{ $t('contract_title', [ 'id' => $contract->id ]) }}</h1>
<div class="muted">{{ $t('date', [ 'date' => $date($contract->picked_up_at ?? $contract->created_at, 'd/m/Y') ]) }}</div>

@foreach ($people as $role => $person)
    <h2>{{ $t($role) }}</h2>
    <table>
        <tr><td style="width: 35%">{{ $t('name') }}</td><td class="strong">{{ $person->first_name }} {{ $person->last_name }}</td></tr>
        <tr><td>{{ $t('phone', [ 'phone' => '' ]) }}</td><td>{{ $ltr($person->phone) }}</td></tr>
        <tr><td>{{ $t('birth_date') }}</td><td>{{ $ltr($person->birth_date) }}</td></tr>
        <tr><td>{{ $t('id_number') }}</td><td>{{ $ltr($person->id_number) }}</td></tr>
        <tr><td>{{ $t('licence') }}</td><td>{{ $ltr($person->driver_licence_number) }} · {{ $t('licence_date') }} {{ $ltr($person->driver_licence_delivery_date) }}</td></tr>
    </table>
@endforeach

<h2>{{ $t('car') }}</h2>
<table>
    <tr><td style="width: 35%">{{ $t('car') }}</td><td class="strong">{{ $ltr($car->manufacturer . ' ' . $car->model_name . ' ' . $car->model_year) }}</td></tr>
    <tr><td>{{ $t('plate') }}</td><td class="strong">{{ $plate($car->licence_plate) }}</td></tr>
</table>

<h2>{{ $t('rental') }}</h2>
<table class="lines">
    <tr><th></th><th>{{ $t('pickup') }}</th><th>{{ $t('return') }}</th></tr>
    <tr><td>{{ $t('date', [ 'date' => '' ]) }}</td><td>{{ $date($contract->picked_up_at ?? $contract->starts_at) }}</td><td>{{ $date($contract->returned_at ?? $contract->ends_at) }}</td></tr>
    <tr><td>{{ $t('place') }}</td><td>{{ $contract->pickup_location ?? $t('agency') }}</td><td>{{ $contract->return_location ?? $t('agency') }}</td></tr>
    <tr><td>{{ $t('mileage') }}</td><td>{{ $contract->pickup_mileage !== null ? $ltr(number_format($contract->pickup_mileage, 0, ',', ' ') . ' km') : '' }}</td><td>{{ $contract->return_mileage !== null ? $ltr(number_format($contract->return_mileage, 0, ',', ' ') . ' km') : '' }}</td></tr>
</table>

<h2>{{ $t('price') }}</h2>
@include('pdf.lines')
<table>
    <tr><td style="width: 35%">{{ $t('deposit') }}</td><td>{{ $contract->deposit ? $money($contract->deposit) . ' (' . $t('method_' . $contract->deposit_method) . ')' : $t('deposit_none') }}</td></tr>
</table>

@if ($agency->contract_terms)
    <h2>{{ $t('terms') }}</h2>
    <div class="terms">{!! nl2br(e($agency->contract_terms)) !!}</div>
@endif

<table style="margin-top: 6mm">
    <tr>
        <td class="box" style="width: 48%">
            <div>{{ $t('signature_client') }}</div>
            @if ($contract->signature)
                <img src="data:image/svg+xml;base64,{{ base64_encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200" width="600" height="200"><path d="' . $contract->signature . '" fill="none" stroke="#111827" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>') }}" style="height: 22mm">
            @endif
            @if ($contract->signed_at)<div class="muted">{{ $t('signed_on', [ 'date' => $date($contract->signed_at) ]) }}</div>@endif
        </td>
        <td style="width: 4%"></td>
        <td class="box"><div>{{ $t('signature_agency') }}</div></td>
    </tr>
</table>
@endsection
