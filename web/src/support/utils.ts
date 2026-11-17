import { defaultLang, translate } from '../i18n';
import { LOCAL, LOCAL_CURRENCY } from '../constants';
import Translatable from '../classes/Translatable';

// Millimes as '1 234,5 TND' (Tunisian grouping), whatever the language.
export function formatMoneyDisplay(amount: number, selectedLang: keyof Translatable = defaultLang.code as keyof Translatable) {
  const formatter = new Intl.NumberFormat(LOCAL);
  return formatter.format(amount / 1000) + ' ' + translate(LOCAL_CURRENCY, selectedLang);
}

const pad = (value: number) => String(value).padStart(2, '0');

// dd/mm/yyyy and hh:mm in the browser's time zone, Latin digits in every language.
export const formatDate = (unixTimestamp: number, separator = '/') => {
  const date = new Date(unixTimestamp * 1000);
  return pad(date.getDate()) + separator + pad(date.getMonth() + 1) + separator + date.getFullYear();
};

export const formatTime = (unixTimestamp: number) => {
  const date = new Date(unixTimestamp * 1000);
  return pad(date.getHours()) + ':' + pad(date.getMinutes());
};

export const formatDateTime = (unixTimestamp: number) => formatDate(unixTimestamp) + ' ' + formatTime(unixTimestamp);

// Between a start and an end ('start → end'): the arrow points the way the language reads.
export const arrow = (isRtl: boolean) => isRtl ? ' ← ' : ' → ';

// A plate as on the car, the series on the left: 245 تونس 1234 in every language. It stays left to
// right (an plate), and a mark after تونس keeps the number after it on its right, where the bidi
// algorithm would pull it left. Any other text comes back as it is.
export function plate(text: string): string {
  const match = /^(\d+ [\u0600-\u06FF][\u0600-\u06FF ]*)( \d+)$/.exec(text);
  return match ? '\u2066' + match[1] + '\u200E' + match[2] + '\u2069' : text;
}

export const diffInDays = (unixTimestampFrom: number, unixTimestampTo: number) =>
  Math.round(((unixTimestampTo - unixTimestampFrom) / (60 * 60 * 24)) * 100) / 100;

export function debounce<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>): void => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

// '+21622123456' → '22 123 456'
export const formatLocalPhoneNumber = (phone: string) => {
  const match = phone.replaceAll(' ', '').match(/(\+216)([0-9]{2})([0-9]{3})([0-9]{3})/);
  return match ? match[2] + ' ' + match[3] + ' ' + match[4] : phone;
};

export const toMaskedPhone = (phone: string) => `${phone.slice(0, 4)} ${phone.slice(4, 6)} ${phone.slice(6, 9)} ${phone.slice(9)}`;

export const periodsAreEqual = (period1: [number, number], period2: [number, number]) =>
  period1[0] === period2[0] && period1[1] === period2[1];

// The API stores a client's dates and a car's first registration as 'dd/mm/yyyy' strings.
export const parseDmy = (value: string|null) => {
  if (! value) {
    return null;
  }
  const [ day, month, year ] = value.split('/').map(Number);
  return new Date(year, month - 1, day);
};
export const toDmy = (date: Date|null) => date ? formatDate(date.getTime() / 1000) : null;
