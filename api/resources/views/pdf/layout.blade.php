{{-- The agency's letterhead, then the document. --}}
<html lang="{{ $lang }}" dir="{{ $lang === 'ar' ? 'rtl' : 'ltr' }}">
<head>
<style>
    body { font-size: 10pt; color: #1f2937; }
    h1 { font-size: 16pt; margin: 0 0 2mm; }
    h2 { font-size: 11pt; margin: 5mm 0 1.5mm; color: #0b2e5f; border-bottom: 0.3mm solid #cbd5e1; padding-bottom: 1mm; }
    table { width: 100%; border-collapse: collapse; }
    td, th { padding: 1.2mm 1.5mm; vertical-align: top; }
    .lines th { background: #eef2f7; text-align: start; }
    .lines td { border-bottom: 0.2mm solid #e2e8f0; }
    .num { text-align: {{ $lang === 'ar' ? 'left' : 'right' }}; white-space: nowrap; }
    .muted { color: #64748b; }
    .strong { font-weight: bold; }
    .ltr { direction: ltr; }
    .box { border: 0.3mm solid #94a3b8; height: 30mm; }
    .terms { font-size: 8pt; color: #334155; }
</style>
</head>
<body>
<table>
    <tr>
        <td style="width: 60%">
            <div class="strong" style="font-size: 13pt">{{ $agency->name }}</div>
            @if ($agency->address)<div>{{ $agency->address }}</div>@endif
            @if ($agency->phone)<div>{{ $t('phone', [ 'phone' => $ltr($agency->phone) ]) }}</div>@endif
            @if ($agency->tax_id)<div>{{ $t('tax_id', [ 'id' => $ltr($agency->tax_id) ]) }}</div>@endif
        </td>
        <td class="num">
            @if ($agency->logo && \Illuminate\Support\Facades\Storage::exists($agency->logo))
                <img src="{{ \Illuminate\Support\Facades\Storage::path($agency->logo) }}" style="height: 20mm">
            @endif
        </td>
    </tr>
</table>
@yield('content')
</body>
</html>
