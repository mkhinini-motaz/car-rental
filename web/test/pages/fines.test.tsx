import { expect, test } from 'vitest';
import { fireEvent, waitFor, within } from '@testing-library/react';
import { click, invalid, money, renderPage, router, screen, sent, serve, signIn, t } from './harness';
import { ahmed, at, clio, common, contract, leila, manager, out, owner, polo } from './fixtures';
import Fine from '../../src/classes/Fine';
import { formatDateTime } from '../../src/support/utils';
import FinesPage from '../../pages/fines';
import FinePage from '../../pages/fines/[id]';

const fine = (fields: Partial<Fine> = {}): Fine => ({
  id: 8, committed_at: at(-1, 15), amount: 60000, reference: 'PV 12345', note: null, status: 1, settled_at: null, method: null,
  paid_out_at: null, paid_out_method: null, car_id: polo.id, contract_id: out.id, client_id: null, car: polo, contract: out,
  ...fields,
});

test('fines: each with its status, car and client; a new one finds the client itself', async () => {
  signIn(manager);
  serve({ ...common, 'GET fine': [ fine(), fine({ id: 9, status: 4, contract_id: null, contract: null, car: clio, car_id: clio.id }) ], 'GET car': [ clio, polo ], 'POST fine': fine({ id: 10 }) });
  renderPage(FinesPage, '/fines');

  expect(await screen.findByText(t('fine:status:1'))).toBeTruthy();
  expect(screen.getByText('Leila Ben Salah')).toBeTruthy();
  expect(screen.getAllByText(formatDateTime(at(-1, 15)) + ' · PV 12345')).toHaveLength(2);
  expect(screen.getByText(t('fine:no_contract'))).toBeTruthy();
  expect(screen.getAllByText(money(60000))).toHaveLength(2);

  await click(t('fine:new'));
  const dialog = within(await screen.findByRole('dialog'));
  fireEvent.change(dialog.getByLabelText(t('payment:amount')), { target: { value: '60' } });
  fireEvent.click(dialog.getByText(t('fine:save')));
  expect(await screen.findByText(t('fine:invalid'))).toBeTruthy(); // no car

  fireEvent.click(await dialog.findByText(polo.licence_plate));
  fireEvent.change(dialog.getByLabelText(t('fine:committed_at')), { target: { value: '2026-09-20T15:05' } });
  fireEvent.change(dialog.getByLabelText(t('fine:reference')), { target: { value: ' PV 12345 ' } });
  fireEvent.click(dialog.getByText(t('fine:save')));
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/fines/10'));
  expect(sent('POST fine')[0].data).toEqual({
    car_id: 2, committed_at: new Date(2026, 8, 20, 15, 5).getTime() / 1000, amount: 60000, reference: 'PV 12345', note: null,
  });
});

test('a fine\'s two sides: the client pays, the agency pays the authority', async () => {
  signIn(manager);
  serve({ ...common, 'GET fine/8': fine({ contract: { ...out, deposit: 300000 } }), 'PUT fine/8': fine({ status: 2 }), 'POST fine/8/payout': fine() });
  renderPage(FinePage, '/fines/[id]', '/fines/8');

  fireEvent.click(await screen.findByText(t('fine:method:direct')));
  await click(t('fine:settle:client'));
  await waitFor(() => expect(sent('PUT fine/8')).toHaveLength(1));
  expect(sent('PUT fine/8')[0].data).toEqual({ status: 2, method: null, paid_out_method: 1 });

  serve({ 'PUT fine/8': invalid({ status: [ 'fine:deposit:unavailable' ] }) });
  await click(t('fine:settle:deposit'));
  expect(await screen.findByText(t('fine:deposit:unavailable'))).toBeTruthy();

  fireEvent.click(within(screen.getByText(t('fine:payout:method')).parentElement!).getByText(t('payment:method:3')));
  await click(t('fine:payout:record'));
  await waitFor(() => expect(sent('POST fine/8/payout')).toHaveLength(1));
  expect(sent('POST fine/8/payout')[0].data).toEqual({ method: 3 });
  expect(screen.queryByText(t('fine:delete'))).toBeNull(); // the owner's
});

test('the owner deletes a fine; a payout can be undone', async () => {
  signIn(owner);
  serve({ ...common, 'GET fine/8': fine({ paid_out_at: at(-1), paid_out_method: 1 }), 'DELETE fine/8/payout': fine(), 'DELETE fine/8': {} });
  renderPage(FinePage, '/fines/[id]', '/fines/8');
  expect(await screen.findByText(t('fine:payout:done', { date: formatDateTime(at(-1)), method: t('payment:method:1') }))).toBeTruthy();
  await click(t('fine:payout:undo'));
  await waitFor(() => expect(sent('DELETE fine/8/payout')).toHaveLength(1));

  await click(t('fine:delete'));
  fireEvent.click(within(await screen.findByRole('dialog')).getByText(t('common:confirm')));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/fines'));
});

test('a fine taken from a deposit already settled can\'t change', async () => {
  signIn(owner);
  serve({ ...common, 'GET fine/8': fine({ status: 3, contract: contract({ id: 2, status: 4 }) }) });
  renderPage(FinePage, '/fines/[id]', '/fines/8');
  expect(await screen.findByText(t('fine:deposit:settled'))).toBeTruthy();
  expect(screen.queryByText(t('fine:client_side'))).toBeNull();
  expect(screen.queryByText(t('fine:delete'))).toBeNull();
});

test('a fine from a rental kept on paper: staff name who had the car', async () => {
  signIn(manager);
  const paper = fine({ contract_id: null, contract: null, committed_at: at(-90) });
  serve({ ...common, 'GET fine/8': paper, 'GET client': [ ahmed, leila ], 'PUT fine/8/client': { ...paper, client_id: leila.id, client: leila } });
  renderPage(FinePage, '/fines/[id]', '/fines/8');

  expect(await screen.findByText(t('fine:renter:hint'))).toBeTruthy();
  fireEvent.click(screen.getByText(t('client:choose')));
  fireEvent.click(await within(await screen.findByRole('dialog')).findByText('Leila Ben Salah'));
  await waitFor(() => expect(sent('PUT fine/8/client')[0].data).toEqual({ client_id: leila.id }));
});
