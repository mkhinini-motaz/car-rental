import { expect, test } from 'vitest';
import { fireEvent, waitFor } from '@testing-library/react';
import { click, invalid, money, renderPage, router, screen, sent, serve, signIn, t, type, unhandled } from './harness';
import { ahmed, at, client, common, contract, leila, manager, owner } from './fixtures';
import { ClientStats } from '../../src/classes/Client';
import ClientsPage from '../../pages/clients';
import NewClientPage from '../../pages/clients/new';
import EditClientPage from '../../pages/clients/[id]/edit';
import ClientPage from '../../pages/clients/[id]';

const stats: ClientStats = {
  contracts_count: 4, rentals_before: 0, first_rental_at: at(-300), last_rental_at: at(-20), revenue: 1400000, average_value: 350000, average_days: 3.5,
  paid: 1300000, outstanding: 100000, fines_unpaid: 0, damage_charged: 0, repair_costs: 0, deposits_kept: 0, late_returns: 2, late_hours: 7,
  cancellations: 0, no_shows: 0, net: 1250000, badge: 'watch',
};

test('clients: a table to open, searched by name or phone', async () => {
  signIn(owner);
  serve({ ...common, 'GET client': [ ahmed, { ...leila, flag: 1 } ] });
  renderPage(ClientsPage, '/clients');

  expect(await screen.findByText('Ahmed Trabelsi')).toBeTruthy();
  expect(screen.getByText('22 123 456')).toBeTruthy();
  expect(screen.getByText(t('client:flag:1'))).toBeTruthy(); // Leila is blacklisted
  expect(screen.getByText('Leila Ben Salah').closest('a')!.getAttribute('href')).toBe('/clients/2'); // from the keyboard
  fireEvent.click(screen.getByText(t('client:flag:1'))); // anywhere on the row with the mouse
  expect(router.push).toHaveBeenCalledWith('/clients/2');
  expect(sent('GET client')[0].params).toEqual({ search: '', perPage: 50 });

  fireEvent.change(screen.getByPlaceholderText(t('common:search')), { target: { value: '2212' } });
  await waitFor(() => expect(sent('GET client').at(-1)!.params).toEqual({ search: '2212', perPage: 50 }));
  expect(unhandled).toEqual([]);
});

test('a new client: name and phone required, then everything as the API wants it', async () => {
  signIn(owner);
  serve({ ...common, 'POST client': { ...ahmed, id: 9 } });
  renderPage(NewClientPage, '/clients/new');
  await type(t('form:phone:label'), '+216 12');
  await click(t('common:save'));
  expect((await screen.findAllByText(t('validation:required'))).length).toBe(2);
  expect(screen.getByText(t('validation:phone:invalid'))).toBeTruthy();

  await type(t('form:first_name:label'), ' Ahmed ');
  await type(t('form:last_name:label'), 'Trabelsi');
  await type(t('form:phone:label'), '+216 22 123 456');
  fireEvent.click(screen.getByText(t('common:gender:1')));
  await type(t('form:birth_date:label'), '1990-07-04');
  await type(t('form:id_number:label'), '09876543');
  await type(t('form:driver_licence_expiry_date:label'), '2032-10-10');
  await type(t('client:notes'), 'Pays cash');
  await type(t('client:rentals_before'), '12');
  await click(t('common:save'));

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/clients/9'));
  expect(sent('POST client')[0].data).toEqual({
    first_name: 'Ahmed', last_name: 'Trabelsi', phone: '+21622123456', gender: 1, birth_date: '04/07/1990', id_number: '09876543',
    driver_licence_number: null, driver_licence_delivery_date: null, driver_licence_expiry_date: '10/10/2032', flag: null, notes: 'Pays cash',
    rentals_before: 12,
  });
});

test('a phone used by another client is shown on the field', async () => {
  signIn(owner);
  serve({ ...common, 'POST client': invalid({ phone: [ 'validation.unique: taken' ] }) });
  renderPage(NewClientPage, '/clients/new');
  await type(t('form:first_name:label'), 'Ahmed');
  await type(t('form:last_name:label'), 'Trabelsi');
  await type(t('form:phone:label'), '+21622123456');
  await click(t('common:save'));
  expect(await screen.findByText(t('validation:phone:used'))).toBeTruthy();
});

test('editing a client from a handover goes back to the handover', async () => {
  signIn(manager);
  const back = '/contracts/1/handover?stage=1';
  serve({ ...common, 'GET client/1': ahmed, 'PUT client/1': ahmed });
  renderPage(EditClientPage, '/clients/[id]/edit', '/clients/1/edit?back=' + encodeURIComponent(back));
  expect(await screen.findByDisplayValue('+216 22 123 456')).toBeTruthy();
  expect(screen.getByDisplayValue('1990-07-04')).toBeTruthy();
  fireEvent.click(screen.getByText(t('client:flag:1'))); // blacklisted: didn't pay
  await click(t('common:save'));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith(back));
  expect(sent('PUT client/1')[0].data).toMatchObject({ phone: '+21622123456', flag: 1, birth_date: '04/07/1990' });
});

test('a client page: papers, warnings, what they brought in and their rentals', async () => {
  signIn(owner);
  const flagged = client({
    stats, eligibility: [ { code: 'age', min: 21, value: 20 } ],
    warnings: [ { id: 5, first_name: 'Ali', last_name: 'Trabelsi', flag: 1, notes: 'Left without paying', matched_on: [ 'id_number' ] } ],
    contracts: [ contract({ id: 12, status: 4, starts_at: at(-23), ends_at: at(-20) }) ],
  });
  serve({ ...common, 'GET client/1': flagged });
  renderPage(ClientPage, '/clients/[id]', '/clients/1');

  expect(await screen.findByText(t('client:flag:match', { name: 'Ali Trabelsi', fields: t('client:matched:id_number') }))).toBeTruthy();
  expect(screen.getByText('Left without paying')).toBeTruthy();
  expect(screen.getByText(t('client:eligibility:age', { min: 21, value: 20 }))).toBeTruthy();
  expect(screen.getByText(t('client:badge:watch'))).toBeTruthy();
  expect(screen.getByText(money(1250000))).toBeTruthy(); // the net, the owner's
  expect(screen.getByText(t('contract:status:4'))).toBeTruthy();
  expect(screen.getByText(t('document:private'))).toBeTruthy();
  expect(screen.getByText(t('common:edit')).closest('a')!.getAttribute('href')).toBe('/clients/1/edit');
  expect(unhandled).toEqual([]);
});

test('a manager does not see what a client nets the agency', async () => {
  signIn(manager);
  serve({ ...common, 'GET client/1': client({ stats }) });
  renderPage(ClientPage, '/clients/[id]', '/clients/1');
  expect(await screen.findByText(t('client:stats:revenue'))).toBeTruthy();
  expect(screen.queryByText(t('client:stats:net'))).toBeNull();
});

test('a regular client from before the app: their rentals on paper, and known, not new', async () => {
  signIn(owner);
  const none = { ...stats, contracts_count: 0, first_rental_at: null, last_rental_at: null, revenue: 0, average_value: 0, average_days: 0, paid: 0, outstanding: 0, late_returns: 0, late_hours: 0, net: 0 };
  serve({ ...common, 'GET client/1': client({ stats: { ...none, rentals_before: 12, badge: 'good' }, rentals_before: 12 }) });
  renderPage(ClientPage, '/clients/[id]', '/clients/1');

  expect(await screen.findByText(t('client:stats:before'))).toBeTruthy();
  expect(screen.getByText('12')).toBeTruthy();
  expect(screen.getByText(t('client:badge:good'))).toBeTruthy();
  expect(screen.getByText(t('client:stats:rentals', { count: 12 }), { exact: false })).toBeTruthy();
  expect(unhandled).toEqual([]);
});
