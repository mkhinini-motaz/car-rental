// Today on this phone as Unix seconds: [ midnight, next midnight ).
export function todayBounds(now = new Date()): [number, number] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return [ start.getTime() / 1000, end.getTime() / 1000 ];
}

const pad = (value: number) => String(value).padStart(2, '0');

// Strict overlap: back-to-back periods don't overlap.
export const occursInPeriod = (period1: [number, number], period2: [number, number]) =>
  period1[0] < period2[1] && period1[1] > period2[0];

// <input type="datetime-local"> and <input type="date"> values, in the browser's time zone.
// While a year is being typed the browser sends 0002, 0020, 0201...: keep the year's four digits
// both ways, and don't let `new Date()` read 0-99 as 1900-1999.
export const toDateTimeInput = (date: Date|null) => date ?
  `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}` : '';
export const toDateInput = (date: Date|null) => toDateTimeInput(date).slice(0, 10);
export const fromDateInput = (value: string): Date|null => {
  if (! value) {
    return null;
  }
  const [ year, month, day, hours = 0, minutes = 0 ] = value.split(/[-T:]/).map(Number);
  const date = new Date(2000, month - 1, day, hours, minutes);
  date.setFullYear(year, month - 1, day);
  return date;
};
