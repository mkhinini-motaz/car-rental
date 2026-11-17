import { expect, test } from 'vitest';
import { fireEvent, waitFor, within } from '@testing-library/react';
import { click, invalid, money, renderPage, router, screen, sent, serve, signIn, t, type, unhandled } from './harness';
import { agency, ahmed, at, clio, common, contract, leila, manager, polo, pricing } from './fixtures';
import { formatDateTime } from '../../src/support/utils';
import ReservationPage from '../../pages/reservation';

// Clio free for three days from tomorrow; the Polo still out, due back yesterday.
const slot: [number, number] = [ at(1), at(4) ];
const later: [number, number] = [ at(2), at(6) ];
const search = [
  { ...clio, availability_in_period: [ slot ] },
  { ...polo, availability_in_period: [ later ], overdue_since: at(-1, 18) },
];
const quote = { daily_price: 85000, base_price: 90000, seasons: [], discount_percent: 5 };
const chip = (period: [number, number]) => formatDateTime(period[0]) + ' → ' + formatDateTime(period[1]);

function serveBooking(more: Record<string, unknown> = {}) {
  serve({
    ...common, 'GET agency/pricing': pricing, 'GET car': search, 'GET car/1/quote': quote, 'GET car/2/quote': quote,
    'GET client': [ ahmed, leila ], 'GET client/1': ahmed, 'GET client/2': leila, ...more,
  });
}

// The search runs again once the agency's usual times are known: wait for that one.
async function pick(period: [number, number]) {
  await screen.findAllByText(agency.name);
  fireEvent.click(await screen.findByText(chip(period)));
}

async function pickClient(label: string, name: string) {
  const buttons = await screen.findAllByText(t('client:choose'));
  fireEvent.click(label === 'client:label' ? buttons[0] : buttons.at(-1)!); // the second driver's comes last
  fireEvent.click(await within(await screen.findByRole('dialog')).findByText(name));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}

test('a reservation: a free slot, the suggested price, a client, delivery and extras', async () => {
  signIn(manager);
  serveBooking({ 'POST contract': [ contract({ id: 31 }) ] });
  renderPage(ReservationPage, '/reservation');

  await pick(slot);
  expect(screen.getByText(t('car:overdue_since', { date: formatDateTime(at(-1, 18)) }))).toBeTruthy();
  // Pickup at the agency's 10:00 to the next day's return at 10:00.
  await waitFor(() => expect(new Date(sent('GET car').at(-1)!.params.starts_at * 1000).getHours()).toBe(10));
  const searched = sent('GET car').at(-1)!.params;
  expect(searched.ends_at - searched.starts_at).toBe(24 * 3600);
  expect(await screen.findByDisplayValue('85')).toBeTruthy(); // the pricing rules' price for these days
  expect(screen.getByText(t('reservation:quote', { base: money(90000), details: '-5%' }))).toBeTruthy();

  await pickClient('client:label', 'Ahmed Trabelsi');
  fireEvent.click(screen.getAllByText('Enfidha airport · ' + money(40000))[0]); // delivered there, collected there
  fireEvent.click(screen.getByText('Baby seat'));
  fireEvent.click(screen.getByText(t('contract:source:6')));
  await type(t('contract:broker'), 'Hotel Riu');
  await type(t('contract:commission'), '10%');
  await type(t('contract:note'), 'Flight TU 745');
  // 3 days at 85, delivery and collection at 40 each, the baby seat 10 a day.
  expect(screen.getByText(t('reservation:total', { price: money(255000 + 80000 + 30000) }))).toBeTruthy();

  await click(t('reservation:save'));
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/contracts/31'));
  expect(sent('POST contract')[0].data).toEqual({
    client_id: 1, second_driver_id: null, pickup_location: 'Enfidha airport', return_location: 'Enfidha airport',
    extras: [
      { name: t('location:pickup:extra', { place: 'Enfidha airport' }), price: 40000, per: 'rental', kind: 'pickup' },
      { name: t('location:return:extra', { place: 'Enfidha airport' }), price: 40000, per: 'rental', kind: 'return' },
      { name: 'Baby seat', price: 10000, per: 'day' },
    ],
    note: 'Flight TU 745', source: 6, broker: 'Hotel Riu', commission: 36500,
    contracts: [ { car_id: 1, starts_at: slot[0], ends_at: slot[1], daily_price: 85000 } ],
  });
  expect(await screen.findByText(t('reservation:saved'))).toBeTruthy();
  expect(unhandled).toEqual([]);
});

test('checks before saving: the client, overlapping slots, the broker, the same second driver', async () => {
  signIn(manager);
  serveBooking();
  renderPage(ReservationPage, '/reservation');
  await pick(slot);
  fireEvent.click(screen.getByText(chip(later)));
  expect(await screen.findByText(t('car:availability:occurs_in_period'))).toBeTruthy();

  await click(t('reservation:save'));
  expect(await screen.findByText(t('client:required'))).toBeTruthy();

  await pickClient('client:label', 'Ahmed Trabelsi');
  fireEvent.click(screen.getByText(t('contract:source:6')));
  await click(t('reservation:save'));
  expect(await screen.findByText(t('contract:broker:invalid'))).toBeTruthy();

  await pickClient('driver:second', 'Ahmed Trabelsi');
  await click(t('reservation:save'));
  expect(await screen.findByText(t('driver:second:same'))).toBeTruthy();
  expect(sent('POST contract')).toEqual([]);
});

test('a car booked meanwhile: says so and drops the slots picked', async () => {
  signIn(manager);
  serveBooking({ 'POST contract': invalid({ 'contracts.0': [ 'contract:overlap' ] }) });
  renderPage(ReservationPage, '/reservation');
  await pick(slot);
  await pickClient('client:label', 'Ahmed Trabelsi');
  await click(t('reservation:save'));
  expect(await screen.findByText(t('contract:overlap'))).toBeTruthy();
  await waitFor(() => expect(screen.queryByText(t('reservation:save'))).toBeNull());
});

test('from the planning: the car and the day clicked are picked already', async () => {
  signIn(manager);
  serveBooking({ 'GET car/2': polo });
  renderPage(ReservationPage, '/reservation', '/reservation?car=2&startsAt=' + at(5));
  expect(await screen.findByDisplayValue('85')).toBeTruthy();
  expect(screen.getByText(new RegExp(formatDateTime(at(5)) + ' → ' + formatDateTime(at(6))))).toBeTruthy();
  expect(sent('GET car/2/quote')[0].params).toEqual({ starts_at: at(5), ends_at: at(6) });
});
