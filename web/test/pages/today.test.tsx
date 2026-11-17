import { expect, test } from 'vitest';
import { fireEvent, waitFor, within } from '@testing-library/react';
import { click, money, renderPage, reply, screen, sent, serve, signIn, t, unhandled } from './harness';
import { at, car, clio, common, dashboard, DAY, employee, manager, now, out, owner, polo, reserved } from './fixtures';
import { todayBounds } from '../../src/support/day';
import { formatDate, plate } from '../../src/support/utils';
import TodayPage from '../../pages/today';

// Relative to now, so the labels don't depend on when the tests run.
const goingOut = { ...reserved, starts_at: now + 2 * 3600 };
const comingBack = { ...out, ends_at: now - 3600 };

test('the day: stats, who goes out, who comes back and what they still owe', async () => {
  signIn(owner);
  serve({ ...common, 'GET dashboard': dashboard({ pickups: [ goingOut ], returns: [ comingBack ], overdue: 1 }) });
  renderPage(TodayPage, '/today');

  expect(await screen.findByText(t('movement:going_out', { count: 1 }))).toBeTruthy();
  expect(screen.getByText('1/3')).toBeTruthy(); // cars at the agency
  expect(screen.getByText(t('movement:coming_back', { count: 1 }))).toBeTruthy();
  expect(screen.getByText(clio.licence_plate)).toBeTruthy();
  expect(screen.getByText(t('movement:ready'))).toBeTruthy();
  expect(screen.getAllByText(t('movement:overdue')).length).toBeGreaterThan(0);
  expect(screen.getByText(t('payment:remaining:value', { amount: money(100000) }))).toBeTruthy(); // Leila's balance
  expect(screen.getByText(t('handover:pickup')).closest('a')!.getAttribute('href')).toBe('/contracts/1/handover?stage=1');
  expect(screen.getByText(t('handover:return')).closest('a')!.getAttribute('href')).toBe('/contracts/2/handover?stage=2');

  const [ start, end ] = todayBounds();
  expect(sent('GET dashboard')[0].params).toEqual({ starts_at: start, ends_at: end });
  expect(document.title).toBe("M'saken Rent · Car rental");
  expect(unhandled).toEqual([]);
});

test('the day strip asks for another range; handled movements have no button', async () => {
  signIn(owner);
  serve({ ...common, 'GET dashboard': ({ params }: { params: { starts_at: number } }) => params.starts_at > now ?
    dashboard({ pickups: [], returns: [] }) :
    dashboard({ pickups: [ { ...reserved, status: 2, picked_up_at: now - 600 } ], returns: [] }) });
  renderPage(TodayPage, '/today');
  expect(await screen.findByText(t('movement:handed_over'))).toBeTruthy();
  expect(screen.queryByText(t('handover:pickup'))).toBeNull();
  expect(screen.getByText(t('movement:none:back'))).toBeTruthy();

  fireEvent.click(screen.getByText(t('today:range:tomorrow')));
  expect(await screen.findByText(t('movement:none'))).toBeTruthy();
  const tomorrow = todayBounds(new Date(Date.now() + DAY * 1000));
  expect(sent('GET dashboard').at(-1)!.params).toEqual({ starts_at: tomorrow[0], ends_at: tomorrow[1] });
});

test('cars to check: an oil change due and papers running out', async () => {
  signIn(manager);
  const oil = { ...polo, oil_change: { last_at: at(-200), last_mileage: 30000, due_mileage: 40000, due_at: at(20), is_due: true } };
  const papers = car({ id: 4, licence_plate: '140 TU 2222', insurance_ends_at: at(3), technical_control_ends_at: at(-2) });
  serve({ ...common, 'GET dashboard': dashboard({ pickups: [], returns: [], maintenance_due: [ oil ], expiring_cars: [ papers ] }) });
  renderPage(TodayPage, '/today');

  expect(await screen.findByText(t('today:cars_to_check'))).toBeTruthy();
  expect(screen.getByText(t('car:oil_change:due', { km: 40000, date: formatDate(at(20)) }))).toBeTruthy();
  expect(screen.getByText(t('car:insurance_ends_at', { date: formatDate(at(3)) }))).toBeTruthy();
  expect(screen.getByText(t('car:technical_control_ends_at', { date: formatDate(at(-2)) }))).toBeTruthy();
  expect(screen.queryByText(t('car:circulation_tax_ends_at', { date: formatDate(papers.circulation_tax_ends_at) }))).toBeNull(); // months away
  expect(screen.queryByText(t('today:to_pay'))).toBeNull();
});

test('the owner pays a bill due, after saying how', async () => {
  signIn(owner);
  serve({
    ...common,
    'GET dashboard': dashboard({ bills_due: [ { id: 5, category: 20, amount: 800000, every_months: 1, next_due_at: at(2), note: null, branch_id: null } ] }),
    'POST recurring-bill/5/pay': {},
  });
  renderPage(TodayPage, '/today');
  fireEvent.click(await screen.findByText(t('expense:category:20')));
  const loads = sent('GET dashboard').length;
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText(t('today:pay:how'))).toBeTruthy();
  fireEvent.click(within(dialog).getByText(t('payment:method:1')));
  await waitFor(() => expect(sent('POST recurring-bill/5/pay')).toHaveLength(1));
  expect(sent('POST recurring-bill/5/pay')[0].data).toEqual({ method: 1 });
  await waitFor(() => expect(sent('GET dashboard').length).toBeGreaterThan(loads)); // refreshed
});

test('the owner pays an instalment and a salary due', async () => {
  signIn(owner);
  const karim = employee();
  serve({
    ...common,
    'GET dashboard': dashboard({
      instalments_due: [ { car: clio, paid: 11, months: 36, amount: 1200000, remaining: 30000000, next_due_at: at(4), ends_at: at(700), lender: 'BIAT' } ],
      salaries_due: [ { employee: karim, due: 900000 } ],
    }),
    'POST expense': {},
    'POST employee/1/payment': {},
  });
  renderPage(TodayPage, '/today');

  fireEvent.click(await screen.findByText(t('today:instalment', { plate: plate(clio.licence_plate) })));
  fireEvent.click(within(await screen.findByRole('dialog')).getByText(t('payment:method:3')));
  await waitFor(() => expect(sent('POST expense')).toHaveLength(1));
  expect(sent('POST expense')[0].data).toMatchObject({ car_id: clio.id, category: 12, amount: 1200000, method: 3, note: 'BIAT' });

  fireEvent.click(screen.getByText('Karim Jaziri'));
  const dialog = await screen.findByRole('dialog');
  expect((within(dialog).getByLabelText(t('payment:amount')) as HTMLInputElement).value).toBe('900');
  fireEvent.click(within(dialog).getByText(t('common:save')));
  await waitFor(() => expect(sent('POST employee/1/payment')).toHaveLength(1));
  expect(sent('POST employee/1/payment')[0].data).toEqual({ type: 1, amount: 900000, method: 1, note: null });
});

test('a new agency starts by adding its cars', async () => {
  signIn(owner);
  serve({ ...common, 'GET dashboard': dashboard({ pickups: [], returns: [], cars_available: 0, cars_total: 0, cars_out: 0 }) });
  renderPage(TodayPage, '/today');
  expect(await screen.findByText(t('today:first_car'))).toBeTruthy();
  expect(screen.getByText(t('car:new')).closest('a')!.getAttribute('href')).toBe('/cars/new');
});

test('an API failure says so instead of an empty day', async () => {
  signIn(owner);
  serve({ ...common, 'GET dashboard': reply(500) });
  renderPage(TodayPage, '/today');
  expect(await screen.findByText(t('common:error:happened'))).toBeTruthy();
});

test('my tasks: only what was given to me; a car back is ticked cleaned from here', async () => {
  signIn(manager);
  const dirty = { ...out, id: 5, status: 4 as const, returned_at: now - 7200, return_user_id: manager.id, car: polo };
  serve({
    ...common,
    'GET dashboard': dashboard({ pickups: [ { ...goingOut, pickup_user_id: manager.id } ], returns: [ { ...comingBack, return_user_id: owner.id } ], to_clean: [ dirty ] }),
    'POST contract/5/cleaned': { ...dirty, cleaned_at: now },
  });
  renderPage(TodayPage, '/today');
  expect(await screen.findByText(t('movement:coming_back', { count: 1 }))).toBeTruthy();
  expect(screen.getByText(t('today:to_clean'))).toBeTruthy();

  fireEvent.click(screen.getByText(t('task:mine')));
  expect(await screen.findByText(t('movement:coming_back', { count: 0 }))).toBeTruthy(); // the owner's return
  expect(screen.getByText(t('movement:going_out', { count: 1 }))).toBeTruthy();

  fireEvent.click(screen.getByLabelText(t('task:cleaned')));
  await waitFor(() => expect(sent('POST contract/5/cleaned')).toHaveLength(1));
  expect(sent('POST contract/5/cleaned')[0].data).toEqual({ cleaned: true });
});
