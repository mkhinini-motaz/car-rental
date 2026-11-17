{{-- What the rental costs, line by line, with what was paid and what's left. --}}
@php
    $days = round($contract->days(), 2);
    $paid = (int) $contract->payments->sum('amount');
@endphp
<table class="lines">
    <tr><th>{{ $t('description') }}</th><th class="num">{{ $t('amount') }}</th></tr>
    <tr>
        <td>{{ $t('rental_of', [ 'car' => $ltr($contract->car->manufacturer . ' ' . $contract->car->model_name . ' · ' . $plate($contract->car->licence_plate)), 'start' => $date($contract->starts_at), 'end' => $date($contract->ends_at) ]) }}<br>
            <span class="muted">{{ $t('rent', [ 'days' => $days, 'price' => $money($contract->daily_price) ]) }}</span></td>
        <td class="num">{{ $money($contract->rentPrice()) }}</td>
    </tr>
    @foreach ($contract->extras ?? [] as $extra)
        <tr><td>{{ $extra['name'] }}{{ $extra['per'] === 'day' ? ' (' . $t('days', [ 'days' => $days ]) . ')' : '' }}</td>
            <td class="num">{{ $money((int) round($extra['per'] === 'day' ? $extra['price'] * $contract->days() : $extra['price'])) }}</td></tr>
    @endforeach
    @foreach ($contract->charges ?? [] as $charge)
        <tr><td>{{ $t('charge_' . $charge['type'], [ 'quantity' => $charge['quantity'] ?? '', 'unit' => $t('unit_' . ($charge['unit'] ?? 'day')) ]) }}</td>
            <td class="num">{{ $money((int) $charge['amount']) }}</td></tr>
    @endforeach
    <tr><td class="strong">{{ $t('total') }}</td><td class="num strong">{{ $money($contract->totalPrice()) }}</td></tr>
    @if (! ($isInvoice ?? false))
        <tr><td>{{ $t('paid') }}</td><td class="num">{{ $money($paid) }}</td></tr>
        <tr><td class="strong">{{ $t('remaining') }}</td><td class="num strong">{{ $money(max(0, $contract->totalPrice() - $paid)) }}</td></tr>
    @endif
</table>
