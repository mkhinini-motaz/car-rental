import { expect, test, vi } from 'vitest';
import { isOverlapError, requestErrorKey, serverFieldErrors, validationErrors } from '../src/support/alert';
import { clearUserToken, getUserToken, setUserToken } from '../src/support/auth';
import { syncAutoExtras } from '../src/support/extras';
import { priceInputFromMillimes } from '../src/support/money';
import { pdfLang } from '../src/support/pdf';
import { todayBounds } from '../src/support/day';
import {
  debounce, diffInDays, formatDate, formatDateTime, formatLocalPhoneNumber, formatMoneyDisplay, formatTime, parseDmy, periodsAreEqual, plate, toDmy, toMaskedPhone,
} from '../src/support/utils';
import { messagesFor, messageText, whatsappUrl } from '../src/support/whatsapp';
import { translate } from '../src/i18n';
import Contract from '../src/classes/Contract';
import { Pricing } from '../src/api/agency';

const unprocessable = (errors: Record<string, string[]>) => ({ response: { status: 422, data: { errors } } });

test('Laravel\'s 422 errors, and the message a failed request gets', () => {
  expect(validationErrors(unprocessable({ phone: [ 'validation.unique' ] }))).toEqual({ phone: [ 'validation.unique' ] });
  expect(validationErrors({ response: { status: 500, data: { errors: { x: [ 'y' ] } } } })).toEqual({});
  expect(validationErrors(undefined)).toEqual({});

  expect(isOverlapError(unprocessable({ 'contracts.0': [ 'contract:overlap' ] }))).toBe(true);
  expect(requestErrorKey(unprocessable({ 'contracts.0': [ 'contract:overlap' ] }))).toBe('contract:overlap');
  expect(requestErrorKey({ code: 'ERR_NETWORK' })).toBe('network:error');
  expect(requestErrorKey({ response: { status: 403 } })).toBe('common:forbidden');
  expect(requestErrorKey({ response: { status: 500 } })).toBe('common:error:happened');

  expect(serverFieldErrors(unprocessable({ licence_plate: [ 'The licence plate has already been taken.' ], model_year: [ 'The model year must be an integer.' ] })))
    .toEqual({ licence_plate: 'validation:taken', model_year: 'validation:invalid' });
  expect(serverFieldErrors(unprocessable({ phone: [ 'taken' ] }), 'validation:phone:used')).toEqual({ phone: 'validation:phone:used' });
});

test('the token survives storage being blocked: logged out, no crash', () => {
  setUserToken('abc');
  expect(getUserToken()).toBe('abc');
  clearUserToken();
  expect(getUserToken()).toBeNull();

  const blocked = () => { throw new DOMException('blocked', 'SecurityError'); };
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked);
  expect(() => setUserToken('abc')).not.toThrow();
  expect(getUserToken()).toBeNull();
  expect(() => clearUserToken()).not.toThrow();
});

test('dates show as dd/mm/yyyy hh:mm in the agency\'s time zone', () => {
  const at = new Date(2026, 2, 5, 9, 7).getTime() / 1000;
  expect(formatDate(at)).toBe('05/03/2026');
  expect(formatDate(at, '-')).toBe('05-03-2026');
  expect(formatTime(at)).toBe('09:07');
  expect(formatDateTime(at)).toBe('05/03/2026 09:07');
  expect(parseDmy('05/03/2026')).toEqual(new Date(2026, 2, 5));
  expect(parseDmy(null)).toBeNull();
  expect(toDmy(new Date(2026, 2, 5))).toBe('05/03/2026');
  expect(toDmy(null)).toBeNull();

  const [ start, end ] = todayBounds(new Date(2026, 9, 1, 15, 30));
  expect(start).toBe(new Date(2026, 9, 1).getTime() / 1000);
  expect(end - start).toBe(24 * 3600);
});

test('rental days count hours too, to two decimals', () => {
  expect(diffInDays(0, 3 * 86400)).toBe(3);
  expect(diffInDays(0, 86400 + 6 * 3600)).toBe(1.25);
  expect(diffInDays(0, 86400 / 3)).toBe(0.33);
  expect(periodsAreEqual([ 1, 2 ], [ 1, 2 ])).toBe(true);
  expect(periodsAreEqual([ 1, 2 ], [ 1, 3 ])).toBe(false);
});

test('phone numbers: +216 and eight digits, shown grouped', () => {
  expect(formatLocalPhoneNumber('+21622123456')).toBe('22 123 456');
  expect(formatLocalPhoneNumber('+216 22 123 456')).toBe('22 123 456');
  expect(formatLocalPhoneNumber('+33612345678')).toBe('+33612345678'); // not Tunisian: as is
  expect(toMaskedPhone('+21622123456')).toBe('+216 22 123 456');
});

test('money is millimes, shown in dinars with the currency of the language', () => {
  expect(priceInputFromMillimes(87500)).toBe('87.5');
  expect(priceInputFromMillimes(90000)).toBe('90');
  expect(formatMoneyDisplay(90000, 'en')).toMatch(/^90 TND$/);
  expect(formatMoneyDisplay(1234500, 'en')).toBe('1\u202F234,5 TND'); // Tunisian grouping, not tn (Tswana): 1'234.5
  expect(formatMoneyDisplay(90000, 'ar')).toBe('90 ' + translate('TND', 'ar'));
});

test('debounce: only the last call in the pause runs', () => {
  vi.useFakeTimers();
  const search = vi.fn();
  const debounced = debounce(search, 400);
  debounced('a');
  debounced('ab');
  vi.advanceTimersByTime(399);
  expect(search).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(search).toHaveBeenCalledTimes(1);
  expect(search).toHaveBeenCalledWith('ab');
  vi.useRealTimers();
});

test('papers come in Arabic for the Arabic-script languages, French otherwise', () => {
  expect([ 'ar', 'tnar', 'fr', 'tnfr', 'en' ].map(pdfLang)).toEqual([ 'ar', 'ar', 'fr', 'fr', 'fr' ]);
});

const rules: Pricing = {
  seasons: [], discounts: [], extras: [], second_driver_price: 15000, locations: [ { name: 'Enfidha airport', fee: 40000 }, { name: 'Hotel Riu', fee: 0 } ],
  charge_extra_km: false, km_per_day: 0, extra_km_price: 0, late_grace_hours: 0, late_per: 'none', late_hour_price: 0, washing_price: 20000,
};

test('the second driver and delivery places bring their fees, and take them away', () => {
  const babySeat = { name: 'Baby seat', price: 10000, per: 'day' as const };
  const driver = { id: 2 } as never;
  let extras = syncAutoExtras([ babySeat ], rules, 'en', { secondDriver: driver, pickupLocation: 'Enfidha airport', returnLocation: 'Hotel Riu' });
  expect(extras).toEqual([
    babySeat,
    { name: 'Second driver', price: 15000, per: 'day', kind: 'driver' },
    { name: 'Delivery: Enfidha airport', price: 40000, per: 'rental', kind: 'pickup' }, // the hotel is free
  ]);
  extras = syncAutoExtras(extras, rules, 'fr', { secondDriver: null, pickupLocation: 'Somewhere typed', returnLocation: null });
  expect(extras).toEqual([ babySeat ]); // a typed-in address has no fee
  expect(syncAutoExtras([ babySeat ], undefined, 'en', { secondDriver: driver, pickupLocation: null, returnLocation: null })).toEqual([ babySeat ]);
  expect(syncAutoExtras([], { ...rules, second_driver_price: 0 }, 'en', { secondDriver: driver, pickupLocation: null, returnLocation: null })).toEqual([]);
});

test('WhatsApp: which messages fit the rental, and their text', () => {
  const contract = {
    status: 1, starts_at: new Date(2026, 9, 1, 10).getTime() / 1000, ends_at: new Date(2026, 9, 4, 10).getTime() / 1000, total_price: 270000,
    pickup_location: 'Enfidha airport', return_location: null,
    client: { first_name: 'Ahmed' }, car: { manufacturer: 'Renault', model_name: 'Clio', licence_plate: '215 TU 4521' },
  } as unknown as Contract;
  expect(messagesFor(contract)).toEqual([ 'confirm', 'checkin', 'pickup' ]);
  expect(messagesFor({ ...contract, status: 2 })).toEqual([ 'return' ]);
  expect(messagesFor({ ...contract, status: 4 })).toEqual([]);

  const t = (key: string, params?: object) => translate(key, 'en', params);
  const text = messageText('confirm', contract, { name: "M'saken Rent", phone: '+21673000111' } as never, t, millimes => millimes / 1000 + ' TND');
  expect(text).toBe('Hello Ahmed, your booking is confirmed: Renault Clio (215 TU 4521), from 01/10/2026 10:00 to 04/10/2026 10:00 · Enfidha airport. Total: 270 TND.'
    + "\nM'saken Rent · 73 000 111");
  expect(messageText('checkin', contract, undefined, t, String, 'https://car.example/checkin?link=x')).toContain('here: https://car.example/checkin?link=x');
  expect(whatsappUrl('+216 22 123 456', 'Hello & bye')).toBe('https://wa.me/21622123456?text=Hello%20%26%20bye');
});

test('a plate reads as on the car, the series on the left, in every language', () => {
  expect(plate('245 تونس 1234')).toBe('\u2066245 تونس\u200E 1234\u2069');
  expect(plate('215 TU 4521')).toBe('215 TU 4521');
  expect(plate('Coffee')).toBe('Coffee');
});
