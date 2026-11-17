<?php

namespace App\Support;

use App\Models\Agency;
use App\Models\Car;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\File;
use Mpdf\Mpdf;

/**
 * Paperwork as PDF (mPDF, which shapes Arabic and lays it out right to left): a Blade view under
 * resources/views/pdf, its words from lang/{fr,ar}/pdf.php.
 */
class Pdf
{
    const LANGS = [ 'fr', 'ar' ];

    public static function render(string $view, array $data, string $lang, string $title = ''): string
    {
        File::ensureDirectoryExists(storage_path('app/mpdf'));
        $mpdf = new Mpdf([
            'mode' => 'utf-8',
            'format' => 'A4',
            'tempDir' => storage_path('app/mpdf'),
            'margin_left' => 14, 'margin_right' => 14, 'margin_top' => 12, 'margin_bottom' => 12,
            'default_font' => 'dejavusans',
        ]);
        $mpdf->autoScriptToLang = true;
        $mpdf->autoLangToFont = true;
        $mpdf->SetTitle($title); // the browser tab's name
        if ($lang === 'ar') {
            $mpdf->SetDirectionality('rtl');
        }
        $mpdf->WriteHTML(view('pdf.' . $view, [
            ...$data,
            'lang' => $lang,
            't' => fn (string $key, array $params = []) => __('pdf.' . $key, $params, $lang),
            'money' => fn (int $millimes) => self::ltr(self::money($millimes)),
            'date' => fn (?int $time, string $format = 'd/m/Y H:i') => $time ? self::ltr(CarbonImmutable::createFromTimestamp($time, Agency::TIMEZONE)->format($format)) : '—',
            'ltr' => fn (?string $text) => $text === null || $text === '' ? '—' : self::ltr($text),
            'plate' => fn (string $plate) => Car::embedPlate($plate),
        ])->render());

        return $mpdf->Output('', 'S');
    }

    // Plates, phones, numbers and amounts keep their left-to-right order inside Arabic text (a
    // left-to-right embedding, which mPDF honours).
    public static function ltr(string $text): string
    {
        return "\u{202A}" . $text . "\u{202C}";
    }

    // 90000 → '90,000 TND': money on paper keeps its three decimals.
    public static function money(int $millimes): string
    {
        return number_format($millimes / 1000, 3, ',', ' ') . ' TND';
    }
}
