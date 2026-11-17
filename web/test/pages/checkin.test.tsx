import { expect, test, vi } from 'vitest';
import { fireEvent, waitFor, within } from '@testing-library/react';
import { click, invalid, renderPage, reply, router, screen, sent, serve, t, type } from './harness';
import { at } from './fixtures';
import { formatDateTime } from '../../src/support/utils';
import CheckInPage from '../../pages/checkin';

const path = 'checkin/1?expires=1790000000&signature=abc';
const route = (method: string) => method + ' ' + path;
const open = (link = '/api/' + path) => renderPage(CheckInPage, '/checkin', '/checkin?link=' + encodeURIComponent(link));
const checkin = {
  agency: { name: "M'saken Rent", phone: '+216 73 000 111', logo_url: null },
  car: { manufacturer: 'Renault', model_name: 'Clio' }, starts_at: at(1), ends_at: at(4), pickup_location: null,
  client: { first_name: 'Ahmed', last_name: 'Trabelsi', phone: '+21622123456', birth_date: '04/07/1990', id_number: null, driver_licence_number: null, driver_licence_delivery_date: null, driver_licence_expiry_date: null },
  second_driver: null, documents: [ 11 ], signature: null, signed_at: null,
  contract_urls: { fr: 'http://api.test/api/pdf/contract/1?lang=fr&signature=x', ar: 'http://api.test/api/pdf/contract/1?lang=ar&signature=y' },
};

test('the client fills in their papers before pickup, no sign-in', async () => {
  serve({ [route('GET')]: checkin, [route('POST')]: {} });
  open();
  expect(await screen.findByText(t('checkin:booking', { car: 'Renault Clio', start: formatDateTime(at(1)), end: formatDateTime(at(4)) }))).toBeTruthy();
  expect(screen.getByDisplayValue('Ahmed')).toBeTruthy();
  expect(screen.getByDisplayValue('1990-07-04')).toBeTruthy();
  expect(screen.getByText(t('checkin:id_photo:again'))).toBeTruthy(); // the agency has the ID card already
  expect(screen.queryByText(t('common:cars'))).toBeNull(); // no staff sidebar
  expect(router.replace).not.toHaveBeenCalled();

  await type(t('checkin:id_number'), '09876543');
  await type(t('form:driver_licence_number:label'), '12/345678');
  fireEvent.change(document.querySelectorAll('input[type=file]')[1], { target: { files: [ new File([ 'jpg' ], 'licence.jpg', { type: 'image/jpeg' }) ] } });
  fireEvent.click(screen.getByText(t('checkin:second_driver')));
  await waitFor(() => expect(screen.getAllByLabelText(t('checkin:id_number'))).toHaveLength(2));
  await click(t('checkin:send'));
  expect(await screen.findByText(t('validation:phone:invalid'))).toBeTruthy(); // the second driver's

  const [ , driverFirst ] = screen.getAllByLabelText((label) => label.replace(/\s*\*$/, '') === t('form:first_name:label'));
  const [ , driverLast ] = screen.getAllByLabelText((label) => label.replace(/\s*\*$/, '') === t('form:last_name:label'));
  fireEvent.change(driverFirst, { target: { value: 'Leila' } });
  fireEvent.change(driverLast, { target: { value: 'Ben Salah' } });
  await type(t('form:phone:label'), '+216 55 667 700');
  await click(t('checkin:send'));

  expect(await screen.findByText(t('checkin:done', { agency: "M'saken Rent" }))).toBeTruthy();
  const form = Object.fromEntries([ ...(sent(route('POST'))[0].data as FormData).entries() ].map(([ key, value ]) => [ key, typeof value === 'string' ? value : 'file' ]));
  expect(form).toEqual({
    'client[first_name]': 'Ahmed', 'client[last_name]': 'Trabelsi', 'client[birth_date]': '04/07/1990', 'client[id_number]': '09876543',
    'client[driver_licence_number]': '12/345678',
    'second_driver[first_name]': 'Leila', 'second_driver[last_name]': 'Ben Salah', 'second_driver[phone]': '+21655667700',
    licence_photo: 'file',
  });
  expect(sent('POST refresh')).toEqual([]);
});

test('the client reads the contract, then signs it', async () => {
  serve({ [route('GET')]: checkin, [route('POST')]: {} });
  open();
  expect((await screen.findByText(t('checkin:sign:read'))).closest('a')!.getAttribute('href')).toBe(checkin.contract_urls.fr);
  await click(t('signature:sign'));
  const dialog = within(await screen.findByRole('dialog'));
  const pad = dialog.getByText(t('checkin:sign:pad')).parentElement!.querySelector('svg')!;
  vi.spyOn(pad, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 600, height: 200 } as DOMRect);
  fireEvent.pointerDown(pad, { clientX: 10, clientY: 20 });
  fireEvent.pointerMove(pad, { clientX: 100, clientY: 50 });
  fireEvent.pointerUp(pad);
  fireEvent.click(dialog.getByText(t('common:save')));
  await click(t('checkin:send'));

  expect(await screen.findByText(t('checkin:done:signed', { agency: "M'saken Rent" }))).toBeTruthy();
  expect((sent(route('POST'))[0].data as FormData).get('contract_signature')).toBe('M10 20 L100 50');
});

test('a contract signed already says when, and is only sent again if signed again', async () => {
  serve({ [route('GET')]: { ...checkin, signature: 'M1 1 L5 5', signed_at: at(-1) }, [route('POST')]: {} });
  open();
  expect(await screen.findByText(t('checkin:signed', { date: formatDateTime(at(-1)) }))).toBeTruthy();
  expect(screen.getByText(t('signature:again'))).toBeTruthy();
  await click(t('checkin:send'));
  expect(await screen.findByText(t('checkin:done', { agency: "M'saken Rent" }))).toBeTruthy();
  expect((sent(route('POST'))[0].data as FormData).has('contract_signature')).toBe(false);
});

test('the API\'s field errors show on the field', async () => {
  serve({ [route('GET')]: checkin, [route('POST')]: invalid({ 'client.driver_licence_number': [ 'The driver licence number format is invalid.' ] }) });
  open();
  await type(t('form:driver_licence_number:label'), '???');
  await click(t('checkin:send'));
  expect(await screen.findByText(t('validation:invalid'))).toBeTruthy();
});

test('a bad, used or missing link says so', async () => {
  serve({ [route('GET')]: reply(410) });
  const { unmount } = open();
  expect(await screen.findByText(t('checkin:closed'))).toBeTruthy();
  unmount();

  serve({ [route('GET')]: reply(403) });
  const second = open();
  expect(await screen.findByText(t('checkin:invalid'))).toBeTruthy();
  second.unmount();

  renderPage(CheckInPage, '/checkin');
  expect(await screen.findByText(t('checkin:invalid'))).toBeTruthy();
});
