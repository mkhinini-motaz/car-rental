import { defaultLang, translate } from "../i18n";
import { LOCAL, LOCAL_CURRENCY } from "../constants";
import Translatable from "../classes/Translatable";

/**
 * @param amount                {number}
 * @param selectedLang          {string}
 * @param selectedLangWriteFrom {string}
 *
 * @returns {string}
 */

export function formatMoneyDisplay(amount: number, selectedLang: keyof Translatable = defaultLang.code, selectedLangWriteFrom = defaultLang.writeFrom) {
  let formatter = new Intl.NumberFormat(LOCAL, {
    currency: LOCAL_CURRENCY,
  });

  if (selectedLangWriteFrom === 'right') {
    return formatter.format(amount / 1000).replace(LOCAL_CURRENCY, '') + ' ' +
      translate(LOCAL_CURRENCY, selectedLang);
  }

  return formatter.format(amount / 1000).replace(LOCAL_CURRENCY, '') + ' ' + translate(LOCAL_CURRENCY, selectedLang);
}

// A Tunisian mobile or landline as typed, shaped '+216 22 123 456': the +216 stays, eight digits
// at most, and the first one is a real prefix (2, 3, 4, 5, 7 or 9).
export function maskPhone(typed: string): string {
  const digits = typed.replace(/\D/g, '').replace(/^216/, '').replace(/^[^234579]+/, '').slice(0, 8);
  return '+216 ' + [ digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 8) ].filter(Boolean).join(' ');
}


export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const formatDate = (unixTimestamp: number, separator = '/') => {
  const date = (new Date(unixTimestamp * 1000));
  const day = date.getDate().toString().length > 1 ? date.getDate() : '0' + date.getDate();
  let month = (date.getMonth() + 1).toString();
  month = month.length > 1 ? month : '0' + month;

  return day + separator + month + separator + date.getFullYear().toString();
};

export const formatTime = (unixTimestamp: number) => {
  const date = (new Date(unixTimestamp * 1000));
  let hours = date.getHours().toString();
  hours = hours.length > 1 ? hours : '0' + hours;
  let minutes = date.getMinutes().toString();
  minutes = minutes.length > 1 ? minutes : '0' + minutes;

  return hours + ':' + minutes;
};

export const formatDateTime = (unixTimestamp: number) => {
  return formatDate(unixTimestamp) + ' ' + formatTime(unixTimestamp);
};

// Between a start and an end, in a line that reads right to left in Arabic (a translated label
// first): the arrow points the way the language reads. A line of digits alone reads left to right.
export const arrow = (writeFrom: 'left'|'right') => writeFrom === 'right' ? ' ← ' : ' → ';

// A plate as on the car, the series on the left: 245 تونس 1234 in every language. It stays left to
// right (an plate), and a mark after تونس keeps the number after it on its right, where the bidi
// algorithm would pull it left. Any other text comes back as it is.
export function plate(text: string): string {
  const match = /^(\d+ [\u0600-\u06FF][\u0600-\u06FF ]*)( \d+)$/.exec(text);
  return match ? '\u2066' + match[1] + '\u200E' + match[2] + '\u2069' : text;
}

export const strToDate = (date: string, delimiter: string = '-') => {
  const [day, month, year] = date.split(delimiter);
  return new Date(year + '-' + month + '-' + day);
};

export const diffInDays = (unixTimestampFrom: number, unixTimestampTo: number) => {
  return Math.round(((unixTimestampTo - unixTimestampFrom) / (60 * 60 * 24)) * 100) / 100;
};


export function debounce<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>): void => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

export const formatLocalPhoneNumber = (phone: string) => {
  phone = phone.replace(' ', '');
  const match = phone.match(/(\+216)([0-9]{2})([0-9]{3})([0-9]{3})/)
  if (!match) {
    return phone;
  }

  return match[2] + ' ' + match[3] + ' ' + match[4];
};

export const addDaysToDate = (date: Date, numberOfDays: number) => {
  date.setMinutes(date.getMinutes() + numberOfDays);
  return date;
}

export const periodsAreEqual = (period1: [number, number], period2: [number, number]) => {
  return (period1[0] + period1[1]) === (period2[0] + period2[1]);
}

export const occursInPeriod = (period1: [number, number], period2: [number, number]) => {
  // starts within period
  if (period1[0] > period2[0] && period1[0] < period2[1]) {
    return true
  }
  // ends within period
  if (period1[1] > period2[0] && period1[1] < period2[1]) {
    return true
  }

  // starts before period, ends after it
  if (period1[0] <= period2[0] && period1[1] >= period2[1]) {
    return true
  }

  // starts before period's end endsAtColumn is null
  if (period1[0] <= period2[1] && ! period2[1]) {
    return true
  }

  return false;
}

export const doesntOccurInPeriod = (period1: [number, number], period2: [number, number]) => {
  return ! occursInPeriod(period1, period2);
}
