import { expect, test, vi } from 'vitest';
import { fireEvent, waitFor, within } from '@testing-library/react';
import { click, invalid, money, renderPage, router, screen, sent, serve, signIn, t, type } from './harness';
import { agency, ahmed, at, common, contract, manager, now, out, owner, pricing, reserved } from './fixtures';
import { formatDateTime } from '../../src/support/utils';
import { messageText, whatsappUrl } from '../../src/support/whatsapp';
import ContractPage from '../../pages/contracts/[id]';

const page = (id: number) => renderPage(ContractPage, '/contracts/[id]', '/contracts/' + id);
const confirm = async () => fireEvent.click(within(await screen.findByRole('dialog')).getByText(t('common:confirm')));

function serveContract(data: typeof reserved, more: Record<string, unknown> = {}) {
  serve({ ...common, 'GET agency/pricing': pricing, ['GET contract/' + data.id]: data, 'GET client/1': ahmed, 'GET client/2': out.client, ...more });
}

// A new tab, opened at once so the browser allows it, sent to the link when it comes back.
function newTab() {
  const tab = { location: { href: '' }, close: vi.fn() };
  vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
  return tab;
}

test('a reservation: changed and saved, handed over from here', async () => {
  signIn(manager);
  serveContract(reserved, { 'PUT contract/1': reserved });
  page(1);
  const price = await screen.findByDisplayValue('90');
  expect(document.title).toBe(t('contract:label') + ' #1 · Car rental');
  expect(screen.getByText(t('handover:pickup')).closest('a')!.getAttribute('href')).toBe('/contracts/1/handover?stage=1');
  expect(screen.queryByText(t('contract:cancel'))).toBeNull(); // the owner's
  expect(screen.getByText(t('contract:total', { days: 3, price: money(270000) }))).toBeTruthy();

  fireEvent.change(price, { target: { value: '80' } });
  fireEvent.click(screen.getByText('+ ' + t('contract:add_day')));
  expect(screen.getByText(t('contract:total', { days: 4, price: money(320000) }))).toBeTruthy();
  await click(t('common:save'));
  await waitFor(() => expect(sent('PUT contract/1')).toHaveLength(1));
  expect(sent('PUT contract/1')[0].data).toEqual({
    starts_at: reserved.starts_at, ends_at: reserved.ends_at + 24 * 3600, daily_price: 80000, client_id: 1, second_driver_id: null,
    pickup_location: null, return_location: null, note: null, extras: [], source: null, broker: null, commission: 0,
  });
  expect(await screen.findByText(t('contract:saved'))).toBeTruthy();
});

test('the owner cancels a reservation, after confirming', async () => {
  signIn(owner);
  serveContract(reserved, { 'DELETE contract/1': {} });
  page(1);
  await click(t('contract:cancel'));
  await confirm();
  await waitFor(() => expect(router.back).toHaveBeenCalled());
  expect(sent('DELETE contract/1')).toHaveLength(1);
});

test('payments: what is owed, a payment recorded, one removed', async () => {
  signIn(owner);
  const withPayments = { ...out, deposit_available: 300000, payments: [ { id: 7, contract_id: 2, amount: 230000, method: 1 as const, paid_at: at(-3) } ] };
  serveContract(withPayments, { 'POST contract/2/payment': {}, 'DELETE contract/2/payment/7': {} });
  page(2);
  expect(await screen.findByText(t('payment:due', { amount: money(330000) }))).toBeTruthy();
  expect(screen.getByText(t('payment:remaining:value', { amount: money(100000) }))).toBeTruthy();
  expect(screen.getByText(t('handover:return')).closest('a')!.getAttribute('href')).toBe('/contracts/2/handover?stage=2');

  await click(t('payment:add'));
  expect(await screen.findByText(t('payment:amount:invalid'))).toBeTruthy();
  fireEvent.change(screen.getByLabelText(t('payment:amount')), { target: { value: '100' } });
  fireEvent.click(screen.getByText(t('payment:method:5'))); // out of the deposit held
  await click(t('payment:add'));
  await waitFor(() => expect(sent('POST contract/2/payment')).toHaveLength(1));
  expect(sent('POST contract/2/payment')[0].data).toEqual({ amount: 100000, method: 5 });

  fireEvent.click(document.querySelector('[data-testid=DeleteOutlinedIcon]')!.closest('button')!);
  await confirm();
  await waitFor(() => expect(sent('DELETE contract/2/payment/7')).toHaveLength(1));
});

test('a manager can take a payment but not remove one', async () => {
  signIn(manager);
  serveContract({ ...out, payments: [ { id: 7, contract_id: 2, amount: 230000, method: 1 as const, paid_at: at(-3) } ] });
  page(2);
  expect(await screen.findByText(t('payment:add'))).toBeTruthy();
  expect(document.querySelector('[data-testid=DeleteOutlinedIcon]')).toBeNull();
});

test('closing a returned rental: the deposit kept needs a reason; unpaid rent blocks it', async () => {
  signIn(owner);
  const returned = { ...out, status: 3 as const, returned_at: now - 3600, return_mileage: 40900, deposit_available: 300000, paid: 330000 };
  serveContract(returned, { 'POST contract/2/close': invalid({ payments: [ 'contract:unpaid' ] }) });
  page(2);
  expect(await screen.findByText(t('handover:driven', { km: 690 }))).toBeTruthy();
  await type(t('deposit:kept:amount'), '50');
  expect(screen.getByText(t('deposit:returned', { amount: money(250000) }))).toBeTruthy();
  await click(t('contract:close'));
  expect(await screen.findByText(t('deposit:reason:required'))).toBeTruthy();

  await type(t('deposit:kept:reason'), 'Fuel');
  await click(t('contract:close'));
  await confirm();
  expect(await screen.findByText(t('contract:unpaid'))).toBeTruthy();
  expect(sent('POST contract/2/close')[0].data).toEqual({ deposit_kept: 50000, deposit_kept_reason: 'Fuel' });
});

test('the contract and its invoice as PDF, opened or shared', async () => {
  signIn(manager);
  serveContract(reserved, { 'POST contract/1/pdf': { url: 'https://api.example/pdf/1' } });
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
  const tab = newTab();
  page(1);

  fireEvent.click(await screen.findByText(t('papers:lang:ar')));
  await click(t('papers:contract'));
  await waitFor(() => expect(tab.location.href).toBe('https://api.example/pdf/1'));
  expect(sent('POST contract/1/pdf')[0].data).toEqual({ kind: 'contract', lang: 'ar' });

  fireEvent.click(screen.getAllByLabelText(t('papers:share'))[1]);
  expect(await screen.findByText(t('papers:copied'))).toBeTruthy();
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://api.example/pdf/1');
  expect(sent('POST contract/1/pdf')[1].data).toEqual({ kind: 'invoice', lang: 'ar' });
});

test('WhatsApp messages to the client, the check-in link made on click', async () => {
  signIn(manager);
  serveContract(reserved, { 'POST contract/1/checkin-link': { url: 'https://car.example/checkin?link=abc' } });
  const tab = newTab();
  page(1);
  const english = (key: string, params?: object) => t(key, params as Record<string, any>);
  const confirmLink = (await screen.findByText(t('whatsapp:send:confirm'))).closest('a')!;
  expect(confirmLink.getAttribute('href')).toBe(whatsappUrl(ahmed.phone, messageText('confirm', reserved, agency, english, money)));
  expect(confirmLink.getAttribute('href')).toContain('https://wa.me/21622123456?text=');
  expect(screen.getByText(t('whatsapp:send:pickup'))).toBeTruthy();

  await click(t('whatsapp:send:checkin'));
  await waitFor(() => expect(tab.location.href).toBe(whatsappUrl(ahmed.phone, messageText('checkin', reserved, agency, english, money, 'https://car.example/checkin?link=abc'))));
});

test('the client signs on the screen when they didn\'t at pickup', async () => {
  signIn(manager);
  serveContract(reserved, { 'POST contract/1/signature': {} });
  page(1);
  await click(t('signature:sign'));
  const dialog = within(await screen.findByRole('dialog'));
  const pad = dialog.getByText(t('signature:hint')).parentElement!.querySelector('svg')!;
  vi.spyOn(pad, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 600, height: 200 } as DOMRect);
  fireEvent.pointerDown(pad, { clientX: 10, clientY: 20 });
  fireEvent.pointerMove(pad, { clientX: 100, clientY: 50 });
  fireEvent.pointerMove(pad, { clientX: 180, clientY: 40 });
  fireEvent.pointerUp(pad);
  fireEvent.click(dialog.getByText(t('common:save')));
  await waitFor(() => expect(sent('POST contract/1/signature')).toHaveLength(1));
  expect(sent('POST contract/1/signature')[0].data).toEqual({ signature: 'M10 20 L100 50 L180 40' });
});

test('a closed contract: read only, with what happened and who did it', async () => {
  signIn(owner);
  const closed = contract({
    status: 4, picked_up_at: at(-6), pickup_mileage: 20000, returned_at: at(-3), return_mileage: 20450, ends_at: at(-3), deposit: 300000, deposit_method: 1,
    deposit_kept: 20000, deposit_kept_reason: 'Fuel', deposit_returned: 280000, closed_at: at(-3), paid: 270000,
    activities: [ { id: 1, action: 'updated', changes: { daily_price: [ 95000, 90000 ] }, user: { id: 1, first_name: 'Sami', last_name: 'Mansour' }, created_at: at(-7) } ],
    damages: [ { id: 1, stage: 2, x: 300, y: 200, note: 'Rear bumper scratch', amount: 60000, contract_id: 1, repaired_at: null, created_at: at(-3) } ],
  });
  serveContract(closed);
  page(1);
  expect(await screen.findByText(t('deposit:kept', { amount: money(20000), reason: 'Fuel' }))).toBeTruthy();
  expect(screen.getByText(t('deposit:returned', { amount: money(280000) }))).toBeTruthy();
  expect(screen.getByText(t('activity:by', { action: t('activity:updated'), user: 'Sami Mansour', date: formatDateTime(at(-7)) }))).toBeTruthy();
  expect(screen.getByText(t('activity:field:daily_price') + ' : ' + money(95000) + ' → ' + money(90000))).toBeTruthy();
  expect(screen.getByText('Rear bumper scratch')).toBeTruthy();
  expect(screen.queryByText(t('common:save'))).toBeNull();
  expect(screen.queryByText(t('payment:add'))).toBeNull();
  expect(screen.queryByText(t('signature:sign'))).toBeNull();
});

test('who hands the car over and takes it back, saved on click', async () => {
  signIn(owner);
  const staff = [ { id: 1, first_name: 'Sami', last_name: 'Mansour', branch_id: null }, { id: 2, first_name: 'Hela', last_name: 'Gharbi', branch_id: null } ];
  serveContract(reserved, { 'GET agency': { ...agency, staff }, 'PUT contract/1': { ...reserved, pickup_user_id: 2 } });
  page(1);
  expect(await screen.findByText(t('task:pickup_user'))).toBeTruthy();
  fireEvent.click(screen.getAllByText('Hela Gharbi')[0]); // the pickup's
  await waitFor(() => expect(sent('PUT contract/1')).toHaveLength(1));
  expect(sent('PUT contract/1')[0].data).toEqual({ pickup_user_id: 2 });
});

test('a returned car is ticked cleaned; its pickup is past', async () => {
  signIn(manager);
  const staff = [ { id: 2, first_name: 'Hela', last_name: 'Gharbi', branch_id: null } ];
  const back = contract({ id: 3, status: 3, picked_up_at: at(-3), returned_at: now - 3600, return_user_id: 2 });
  serveContract(back, { 'GET agency': { ...agency, staff }, 'POST contract/3/cleaned': { ...back, cleaned_at: now } });
  page(3);
  fireEvent.click(await screen.findByLabelText(t('task:cleaned')));
  await waitFor(() => expect(sent('POST contract/3/cleaned')).toHaveLength(1));
  expect(sent('POST contract/3/cleaned')[0].data).toEqual({ cleaned: true });
  expect(screen.queryByText(t('task:pickup_user'))).toBeNull(); // handed over already
});
