import { expect, test } from 'vitest';
import { atTime } from '../src/classes/Agency';
import { coverage, daysAndHours } from '../src/classes/Availability';
import Car, { carState } from '../src/classes/Car';
import { clientName } from '../src/classes/Client';
import Contract, { extrasPrice, remainingRent, withAutoExtra } from '../src/classes/Contract';
import { employeeName } from '../src/classes/Employee';
import User, { isOwner } from '../src/classes/User';
import { translate } from '../src/i18n';

const now = 1_800_000_000;
const car = (fields: Partial<Car> = {}) => ({ status: 1, contracts: [], blocks: [], ...fields }) as Car;
const rental = (endsAt: number) => ({ status: 2, ends_at: endsAt }) as Contract;

test('where a car is: out (late, back today, later), off the road, blocked, or free', () => {
  expect(carState(car({ contracts: [ rental(now - 60) ] }), now, now + 3600)).toEqual({ label: 'car:state:overdue', tone: 'danger' });
  expect(carState(car({ contracts: [ rental(now + 60) ] }), now, now + 3600)).toEqual({ label: 'car:state:back_today', tone: 'info' });
  expect(carState(car({ contracts: [ rental(now + 7200) ] }), now, now + 3600).label).toBe('car:state:out');
  expect(carState(car({ status: 2 }), now, now)).toEqual({ label: 'car:status:2', tone: 'warn' });
  expect(carState(car({ status: 3 }), now, now)).toEqual({ label: 'car:status:3', tone: 'danger' });
  expect(carState(car({ blocks: [ {} as never ] }), now, now)).toEqual({ label: 'car:state:blocked', tone: 'warn' });
  expect(carState(car(), now, now)).toEqual({ label: 'car:status:1', tone: 'ok' });
  expect(carState(car({ status: 2, contracts: [ rental(now + 60) ] }), now, now + 3600).label).toBe('car:state:back_today'); // out beats maintenance
});

test('a rental\'s extras, per day or once, and the rent still owed', () => {
  const extras = [ { name: 'Baby seat', price: 10000, per: 'day' as const }, { name: 'Delivery', price: 40000, per: 'rental' as const } ];
  expect(extrasPrice(extras, 3)).toBe(70000);
  expect(extrasPrice(extras, 2.5)).toBe(65000);
  expect(extrasPrice([], 3)).toBe(0);
  expect(remainingRent({ total_price: 330000, paid: 230000 } as Contract)).toBe(100000);
  expect(remainingRent({ total_price: 330000 } as Contract)).toBe(330000);
});

test('an automatic extra replaces the one of its kind, or goes', () => {
  const seat = { name: 'Baby seat', price: 10000, per: 'day' as const };
  const driver = { name: 'Second driver', price: 15000, per: 'day' as const };
  const withDriver = withAutoExtra([ seat ], 'driver', driver);
  expect(withDriver).toEqual([ seat, { ...driver, kind: 'driver' } ]);
  expect(withAutoExtra(withDriver, 'driver', { ...driver, price: 20000 })).toEqual([ seat, { ...driver, price: 20000, kind: 'driver' } ]);
  expect(withAutoExtra(withDriver, 'driver', null)).toEqual([ seat ]);
});

test('names, roles and the agency\'s usual times', () => {
  expect(clientName({ first_name: 'Ahmed', last_name: 'Trabelsi' } as never)).toBe('Ahmed Trabelsi');
  expect(employeeName({ first_name: 'Rim', last_name: null })).toBe('Rim');
  expect(employeeName({ first_name: 'Karim', last_name: 'Jaziri' })).toBe('Karim Jaziri');
  expect(isOwner({ role: 1 } as User)).toBe(true);
  expect(isOwner({ role: 2 } as User)).toBe(false);
  expect(atTime(new Date(2026, 9, 1, 23, 59), '09:30')).toEqual(new Date(2026, 9, 1, 9, 30));
});

test('translations fill their parameters; a missing key shows itself', () => {
  expect(translate('car:daily_price', 'en', { price: '90 TND' })).toBe('90 TND / day');
  expect(translate('reservation:total', 'en', { price: '' })).toBe('Total: ');
  expect(translate('no:such_key', 'fr')).toBe('no:such_key');
  expect(translate('common:login', 'ar')).not.toBe('common:login');
});

test('a free stretch as a share of the searched period, and the time it misses at each end', () => {
  const searched: [number, number] = [ now, now + 4 * 86400 ];
  expect(coverage([ now + 86400, now + 4 * 86400 ], searched)).toEqual({ from: 25, to: 100, missingBefore: 86400, missingAfter: 0 });
  expect(coverage([ now, now + 3600 ], searched).missingAfter).toBe(4 * 86400 - 3600);
  expect(daysAndHours(30 * 3600)).toEqual([ 1, 6 ]);
  expect(daysAndHours(1800)).toEqual([ 0, 1 ]); // half an hour counts as one
  expect(daysAndHours(2 * 86400)).toEqual([ 2, 0 ]);
});
