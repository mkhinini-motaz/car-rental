import { expect, test } from 'vitest';
import { fireEvent, waitFor, within } from '@testing-library/react';
import { click, renderPage, router, screen, sent, serve, signIn, t } from './harness';
import { at, clio, common, contract, DAY, manager, now, out, polo, reserved } from './fixtures';
import { todayBounds } from '../../src/support/day';
import { formatDateTime } from '../../src/support/utils';
import PlanningPage from '../../pages/planning';
import RentedPage from '../../pages/rented';

const [ today ] = todayBounds();
const block = { id: 4, car_id: 1, starts_at: at(4, 8), ends_at: at(5, 18), reason: 1 as const, note: 'Timing belt' };
const board = [
  { ...clio, contracts: [ reserved ], blocks: [ block ] },
  { ...polo, contracts: [ { ...out, ends_at: now - 3600 } ] }, // overdue
];
// A car's row on the board, and its day cells.
const cell = (row: number, day: number) =>
  document.querySelectorAll('div[style*="height: 48px"][style*="position: relative"]')[row].firstElementChild!.children[day] as HTMLElement;

test('the board: a row per car, bookings and blocks as bars, a week at a time', async () => {
  signIn(manager);
  serve({ ...common, 'GET planning': board });
  renderPage(PlanningPage, '/planning');

  const bar = await screen.findByText('Ahmed Trabelsi');
  expect(sent('GET planning')[0].params).toEqual({ starts_at: today, ends_at: todayBounds(new Date((today + 7 * DAY) * 1000))[0] });
  expect(screen.getByText('Leila Ben Salah').getAttribute('aria-label')).toContain(t('planning:overdue')); // said, not only red
  expect(screen.getByText(t('block:reason:1')).getAttribute('aria-label')).toContain(t('planning:blocked'));
  expect(screen.getByText(clio.licence_plate).closest('a')!.getAttribute('href')).toBe('/cars/1');
  expect(bar.getAttribute('href')).toBe('/contracts/1'); // a link: the keyboard and a new tab open it too

  fireEvent.click(document.querySelector('[data-testid=ChevronRightIcon]')!.closest('button')!);
  await waitFor(() => expect(sent('GET planning').at(-1)!.params.starts_at).toBe(todayBounds(new Date((today + 7 * DAY) * 1000))[0]));
  fireEvent.click(screen.getByText(t('planning:month')));
  await waitFor(() => expect(cell(0, 30)).toBeTruthy());
});

test('an empty day: book the car from it, or block it', async () => {
  signIn(manager);
  serve({ ...common, 'GET planning': board, 'POST car/1/block': block });
  renderPage(PlanningPage, '/planning');
  await screen.findByText('Ahmed Trabelsi');

  fireEvent.click(cell(0, 2));
  fireEvent.click(within(await screen.findByRole('menu')).getByText(t('planning:reserve'))); // the sidebar has one too
  expect(router.push).toHaveBeenCalledWith('/reservation?car=1&startsAt=' + at(2, 10)); // the agency's pickup time

  fireEvent.click(cell(0, 2));
  fireEvent.click(within(await screen.findByRole('menu')).getByText(t('block:new')));
  const dialog = within(await screen.findByRole('dialog'));
  fireEvent.click(dialog.getByText(t('block:reason:2')));
  fireEvent.change(dialog.getByLabelText(t('contract:note')), { target: { value: 'Wedding' } });
  fireEvent.click(dialog.getByText(t('common:save')));
  await waitFor(() => expect(sent('POST car/1/block')).toHaveLength(1));
  expect(sent('POST car/1/block')[0].data).toEqual({ starts_at: at(2, 8), ends_at: at(2, 18), reason: 2, note: 'Wedding' });
});

test('a block opened from the board can be removed', async () => {
  signIn(manager);
  serve({ ...common, 'GET planning': board, 'DELETE car/1/block/4': {} });
  renderPage(PlanningPage, '/planning');
  fireEvent.click(await screen.findByText(t('block:reason:1')));
  const dialog = within(await screen.findByRole('dialog'));
  expect(dialog.getByText(formatDateTime(block.starts_at) + ' → ' + formatDateTime(block.ends_at))).toBeTruthy();
  expect(dialog.getByText('Timing belt')).toBeTruthy();
  fireEvent.click(dialog.getByText(t('block:delete')));
  await waitFor(() => expect(sent('DELETE car/1/block/4')).toHaveLength(1));
});

test('rented cars: overdue first, then due back today, then later', async () => {
  signIn(manager);
  const late = { ...out, id: 5, ends_at: now - 7200 };
  const tonight = { ...out, id: 6, ends_at: Math.min(now + 60, todayBounds()[1] - 1) };
  const nextWeek = contract({ id: 7, status: 2, ends_at: at(7), paid: 270000 });
  serve({ ...common, 'GET contract': [ late, tonight, nextWeek ] });
  renderPage(RentedPage, '/rented');

  expect(await screen.findByText(t('rented:overdue', { count: 1 }))).toBeTruthy();
  expect(screen.getByText(t('rented:today', { count: 1 }))).toBeTruthy();
  expect(screen.getByText(t('rented:later', { count: 1 }))).toBeTruthy();
  expect(sent('GET contract')[0].params).toEqual({ status: [ 2 ], orderBy: 'ends_at', page: 1, perPage: 100 });
});

test('no car out', async () => {
  signIn(manager);
  serve({ ...common, 'GET contract': [] });
  renderPage(RentedPage, '/rented');
  expect(await screen.findByText(t('rented:none'))).toBeTruthy();
});
