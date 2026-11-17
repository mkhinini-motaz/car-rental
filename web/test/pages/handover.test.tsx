import { expect, test, vi } from 'vitest';
import { fireEvent, waitFor, within } from '@testing-library/react';
import { click, invalid, money, renderPage, router, screen, sent, serve, signIn, t, type } from './harness';
import { ahmed, client, common, manager, now, out, pricing, reserved } from './fixtures';
import HandoverPage from '../../pages/contracts/[id]/handover';
import { toDateTimeInput } from '../../src/support/day';

const photo = new File([ 'jpeg' ], 'front.jpg', { type: 'image/jpeg' });
const page = (id: number, stage: number) => renderPage(HandoverPage, '/contracts/[id]/handover', `/contracts/${id}/handover?stage=${stage}`);
const fields = (form: FormData) => Object.fromEntries([ ...form.entries() ].map(([ key, value ]) => [ key, typeof value === 'string' ? value : 'file' ]));
const confirmMissingPhotos = async () => {
  const dialog = within(await screen.findByRole('dialog'));
  expect(dialog.getByText(t('handover:photos:missing'))).toBeTruthy();
  fireEvent.click(dialog.getByText(t('common:confirm')));
};

test('pickup: odometer, the agency\'s usual deposit, a photo and the client\'s signature', async () => {
  signIn(manager);
  serve({ ...common, 'GET contract/1': reserved, 'GET client/1': ahmed, 'POST contract/1/pickup': { ...reserved, status: 2 } });
  page(1, 1);
  expect(await screen.findByDisplayValue('24500')).toBeTruthy(); // the car's last reading
  expect(screen.getByDisplayValue('300')).toBeTruthy(); // the agency's deposit
  expect(screen.queryByText(t('client:incomplete'))).toBeNull();

  fireEvent.change(document.querySelectorAll('input[type=file]')[0], { target: { files: [ photo ] } }); // the front
  await waitFor(() => expect(document.querySelector('img[src="blob:preview"]')).toBeTruthy());

  await click(t('signature:sign'));
  const pad = within(await screen.findByRole('dialog')).getByText(t('signature:hint')).parentElement!.querySelector('svg')!;
  vi.spyOn(pad, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 300, height: 100 } as DOMRect); // drawn at half size
  fireEvent.pointerDown(pad, { clientX: 10, clientY: 10 });
  fireEvent.pointerMove(pad, { clientX: 50, clientY: 30 });
  fireEvent.pointerUp(pad);
  fireEvent.click(within(screen.getByRole('dialog')).getByText(t('common:save')));
  expect(await screen.findByText(t('signature:again'))).toBeTruthy();

  await click(t('handover:pickup:save'));
  await confirmMissingPhotos();
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/contracts/1'));
  const { at, ...sentFields } = fields(sent('POST contract/1/pickup')[0].data);
  expect(sentFields).toEqual({ mileage: '24500', deposit: '300000', deposit_method: '1', signature: 'M20 20 L100 60', 'photos[0][angle]': '1', 'photos[0][file]': 'file' });
  expect(Math.abs(Number(at) - Date.now() / 1000)).toBeLessThan(60);
  expect(await screen.findByText(t('handover:pickup:done'))).toBeTruthy();
});

test('pickup: a damage marked from the keyboard, the arrows then Enter', async () => {
  signIn(manager);
  serve({ ...common, 'GET contract/1': reserved, 'GET client/1': ahmed });
  page(1, 1);
  const outline = await screen.findByLabelText(t('inspection:damages:keys'));
  for (const key of [ 'ArrowRight', 'ArrowRight', 'ArrowUp', 'Enter' ]) {
    fireEvent.keyDown(outline, { key }); // from the middle, 5 % a step
  }
  expect(screen.getByLabelText('1. ' + t('contract:note'))).toBeTruthy();
  const mark = within(outline).getByText('1');
  expect([ mark.style.left, mark.style.top ]).toEqual([ '60%', '45%' ]);
});

test('pickup: a client without their papers is sent to complete them first', async () => {
  signIn(manager);
  const incomplete = client({ id_number: null });
  serve({ ...common, 'GET contract/1': { ...reserved, client: incomplete }, 'GET client/1': incomplete, 'POST contract/1/pickup': invalid({ client: [ 'client:incomplete' ] }) });
  page(1, 1);
  expect(await screen.findByText(t('client:incomplete'))).toBeTruthy();
  expect(screen.getByText(t('client:complete')).closest('a')!.getAttribute('href'))
    .toBe('/clients/1/edit?back=' + encodeURIComponent('/contracts/1/handover?stage=1'));

  await type(t('deposit:amount'), 'abc');
  await click(t('handover:pickup:save'));
  expect(await screen.findByText(t('handover:deposit:invalid'))).toBeTruthy();

  await type(t('deposit:amount'), '');
  await click(t('handover:pickup:save'));
  await confirmMissingPhotos();
  await waitFor(() => expect(screen.getAllByText(t('client:incomplete'))).toHaveLength(2)); // the message too
  expect(router.replace).not.toHaveBeenCalled();
});

test('return: the odometer, charges as the API counts them, one waived, a new damage charged from the deposit', async () => {
  signIn(manager);
  serve({
    ...common, 'GET contract/2': out, 'POST contract/2/return': { ...out, status: 3 },
    'GET contract/2/charges': { charges: [ { type: 'late', unit: 'day', quantity: 1, amount: 110000 }, { type: 'km', quantity: 50, amount: 25000 } ], deposit_available: 300000 },
  });
  page(2, 2);
  expect(await screen.findByText(t('handover:mileage:at_pickup', { km: 40210 }))).toBeTruthy();
  await type(t('handover:mileage'), '40100');
  await click(t('handover:return:save'));
  expect(await screen.findByText(t('handover:mileage:invalid'))).toBeTruthy();

  await type(t('handover:mileage'), '40900');
  expect(await screen.findByText(t('charge:late:day', { quantity: 1, amount: money(110000) }))).toBeTruthy();
  await waitFor(() => expect(sent('GET contract/2/charges').at(-1)!.params).toEqual({ mileage: 40900 })); // debounced: 40100 may go first
  expect(screen.getByText(t('charge:total', { amount: money(135000) }))).toBeTruthy();
  fireEvent.click(screen.getByText(t('charge:late:day', { quantity: 1, amount: money(110000) }))); // waived
  expect(screen.getByText(t('charge:total', { amount: money(25000) }))).toBeTruthy();

  const outline = document.querySelector('[style*="crosshair"]') as HTMLElement;
  vi.spyOn(outline, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 260, height: 473 } as DOMRect);
  fireEvent.click(outline, { clientX: 130, clientY: 100 });
  fireEvent.change(await screen.findByPlaceholderText('...'), { target: { value: 'Rear bumper' } });
  fireEvent.change(screen.getByPlaceholderText('TND'), { target: { value: '60' } });
  expect(screen.getByText(t('charge:total', { amount: money(85000) }))).toBeTruthy();
  fireEvent.click(screen.getByText(t('charge:from_deposit', { amount: money(85000) })));

  await click(t('handover:return:save'));
  await confirmMissingPhotos();
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/contracts/2'));
  const { at, ...sentFields } = fields(sent('POST contract/2/return')[0].data);
  expect(sentFields).toEqual({
    mileage: '40900', 'damages[0][x]': '500', 'damages[0][y]': '211', 'damages[0][note]': 'Rear bumper', 'damages[0][amount]': '60000',
    'waived[0]': 'late', charges_from_deposit: '1', dirty: '0',
  });
});

test('return: a car back dirty, the wash charged at the agency\'s usual price or another', async () => {
  signIn(manager);
  serve({
    ...common, 'GET contract/2': out, 'POST contract/2/return': { ...out, status: 3 }, 'GET agency/pricing': pricing,
    'GET contract/2/charges': { charges: [], deposit_available: 300000 },
  });
  page(2, 2);
  await type(t('handover:mileage'), '40900');
  fireEvent.click(await screen.findByText(t('handover:dirty')));
  await waitFor(() => expect(screen.getByDisplayValue('20')).toBeTruthy()); // the usual wash
  await type(t('handover:washing'), '30');
  expect(screen.getByText(t('charge:washing', { amount: money(30000) }))).toBeTruthy();
  expect(screen.getByText(t('charge:total', { amount: money(30000) }))).toBeTruthy();

  await click(t('handover:return:save'));
  await confirmMissingPhotos();
  await waitFor(() => expect(sent('POST contract/2/return')).toHaveLength(1));
  expect(fields(sent('POST contract/2/return')[0].data)).toMatchObject({ dirty: '1', washing: '30000' });
});

test('pickup: damage left from earlier rentals is on the outline and listed, without what it cost then', async () => {
  signIn(manager);
  const dent = { id: 7, stage: 2 as const, x: 800, y: 600, note: 'Dented rear door', amount: 250000, contract_id: 9, repaired_at: null, created_at: now - 86400 };
  serve({ ...common, 'GET contract/1': { ...reserved, car_damages: [ dent ] }, 'GET client/1': ahmed });
  page(1, 1);
  expect(await screen.findByText(t('inspection:damages:open'))).toBeTruthy();
  expect(screen.getByText('Dented rear door')).toBeTruthy();
  expect(screen.queryByText(money(250000))).toBeNull(); // the last client's charge
});

test('pickup entered after the fact: a car already out when the agency joined goes out at its real time', async () => {
  signIn(manager);
  const startsAt = now - 12 * 24 * 3600;
  const already = { ...reserved, starts_at: startsAt, ends_at: now + 3 * 24 * 3600 };
  serve({ ...common, 'GET contract/1': already, 'GET client/1': ahmed, 'POST contract/1/pickup': { ...already, status: 2 } });
  page(1, 1);
  const when = await screen.findByLabelText(t('handover:at:pickup'));
  expect(screen.getByText(t('handover:at:hint'))).toBeTruthy();
  fireEvent.change(when, { target: { value: toDateTimeInput(new Date(startsAt * 1000)) } });

  await click(t('handover:pickup:save'));
  await confirmMissingPhotos();
  await waitFor(() => expect(sent('POST contract/1/pickup')).toHaveLength(1));
  expect(Math.abs(Number(fields(sent('POST contract/1/pickup')[0].data).at) - startsAt)).toBeLessThan(60); // to the minute
});

test('a pickup booked for today asks no time: it happens now', async () => {
  signIn(manager);
  serve({ ...common, 'GET contract/1': reserved, 'GET client/1': ahmed });
  page(1, 1);
  expect(await screen.findByDisplayValue('24500')).toBeTruthy();
  expect(screen.queryByText(t('handover:at:hint'))).toBeNull();
});
