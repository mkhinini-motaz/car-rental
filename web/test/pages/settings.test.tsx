import { expect, test, vi } from 'vitest';
import { fireEvent, waitFor, within } from '@testing-library/react';
import { click, invalid, money, renderPage, reply, router, screen, sent, serve, signIn, t, type } from './harness';
import { agency, common, manager, owner, pricing } from './fixtures';
import SettingsPage from '../../pages/settings';
import ProfilePage from '../../pages/settings/profile';
import PasswordPage from '../../pages/settings/password';
import AgencyPage from '../../pages/settings/agency';
import RemindersPage from '../../pages/settings/reminders';
import PricingPage from '../../pages/settings/pricing';
import BranchesPage from '../../pages/settings/branches';
import StaffPage from '../../pages/settings/staff';
import ThemePage from '../../pages/settings/theme';

const dialog = async () => within(await screen.findByRole('dialog'));
const branch = { id: 3, name: 'Airport', address: 'Enfidha', monthly_rent: 1200000 };

test('settings: the owner\'s groups, a manager\'s account only', async () => {
  signIn(owner);
  serve(common);
  const { unmount } = renderPage(SettingsPage, '/settings');
  expect(await screen.findByText('Sami Mansour · 23 456 109')).toBeTruthy();
  for (const [ label, href ] of [ [ 'agency:edit', '/settings/agency' ], [ 'pricing:label', '/settings/pricing' ], [ 'staff:label', '/settings/staff' ], [ 'settings:reminders', '/settings/reminders' ] ]) {
    expect(screen.getByText(t(label)).closest('a')!.getAttribute('href')).toBe(href);
  }
  unmount();

  signIn(manager);
  renderPage(SettingsPage, '/settings');
  expect(await screen.findByText(t('settings:password'))).toBeTruthy();
  expect(screen.queryByText(t('agency:edit'))).toBeNull();
  expect(screen.queryByText(t('staff:label'))).toBeNull();
});

test('your name and phone: checked, a phone already used, then saved', async () => {
  signIn(manager);
  serve({ ...common, 'PUT me': invalid({ phone: [ 'validation.unique: taken' ] }) });
  renderPage(ProfilePage, '/settings/profile');
  expect(await screen.findByDisplayValue('+216 50 111 222')).toBeTruthy();
  await type(t('form:first_name:label'), ' ');
  await click(t('common:save'));
  expect(await screen.findByText(t('validation:required'))).toBeTruthy();

  await type(t('form:first_name:label'), 'Hela ');
  await type(t('form:phone:label'), '+216 50 111 333');
  await click(t('common:save'));
  expect(await screen.findByText(t('validation:phone:used'))).toBeTruthy();

  serve({ 'PUT me': { ...manager, phone: '+21650111333' } });
  await click(t('common:save'));
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/settings'));
  expect(sent('PUT me').at(-1)!.data).toEqual({ first_name: 'Hela', last_name: 'Gharbi', phone: '+21650111333' });
});

test('a new password needs the current one, and replaces the token', async () => {
  signIn(manager);
  serve({ ...common, 'PUT me': invalid({ current_password: [ 'user:password:wrong' ] }) });
  renderPage(PasswordPage, '/settings/password');
  await type(t('settings:password:new'), 'short');
  await click(t('common:save'));
  expect(await screen.findByText(t('validation:password:min8'))).toBeTruthy();
  expect(screen.getByText(t('validation:required'))).toBeTruthy();

  await type(t('settings:password:current'), 'azerty');
  await type(t('settings:password:new'), 'nouveau-pass');
  await type(t('form:password_confirmation:label'), 'nouveau-pass');
  await click(t('common:save'));
  expect(await screen.findByText(t('user:password:wrong'))).toBeTruthy();

  serve({ 'PUT me': { ...manager, access_token: 'after-password' } });
  await click(t('common:save'));
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/settings'));
  expect(localStorage.getItem('user_access_token')).toBe('after-password');
  expect(sent('PUT me').at(-1)!.data).toEqual({ current_password: 'azerty', password: 'nouveau-pass' });
});

test('the agency\'s details: times, deposit, rules and the logo', async () => {
  signIn(owner);
  serve({ ...common, 'PUT agency': agency, 'POST agency/logo': agency });
  renderPage(AgencyPage, '/settings/agency');
  expect(await screen.findByDisplayValue("M'saken Rent")).toBeTruthy();
  expect(screen.getByDisplayValue('+216 73 000 111')).toBeTruthy();
  expect(screen.getByDisplayValue('19')).toBeTruthy(); // VAT, from hundredths of a percent

  await type(t('agency:pickup_time'), '9h');
  await type(t('agency:vat_rate'), '7,5');
  await type(t('agency:employer_charges'), '16.57');
  await click(t('common:save'));
  expect(await screen.findByText(t('validation:time'))).toBeTruthy();

  await type(t('agency:pickup_time'), '09:30');
  fireEvent.click(screen.getByText(t('payment:method:3')));
  fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [ new File([ 'png' ], 'logo.png', { type: 'image/png' }) ] } });
  await click(t('common:save'));
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/settings'));
  expect(sent('PUT agency')[0].data).toEqual({
    name: "M'saken Rent", phone: '+21673000111', address: agency.address, tax_id: '1234567A', pickup_time: '09:30', return_time: '10:00',
    takes_deposit: true, default_deposit: 300000, default_deposit_method: 3, fleet_max_years: 3, employer_charges_rate: 1657,
    min_driver_age: 21, min_licence_years: 2, vat_rate: 750, fiscal_stamp: 1000, contract_terms: null,
  });
  expect((sent('POST agency/logo')[0].data as FormData).get('logo')).toBeInstanceOf(File);
  expect(await screen.findByText(t('agency:saved'))).toBeTruthy();
});

test('reminders: how early papers and oil changes are flagged', async () => {
  signIn(owner);
  serve({ ...common, 'PUT agency': agency });
  renderPage(RemindersPage, '/settings/reminders');
  await type(t('settings:oil_warning_km'), 'lots');
  await click(t('common:save'));
  expect(await screen.findByText(t('validation:invalid'))).toBeTruthy();
  await type(t('settings:oil_warning_km'), '1500');
  await type(t('settings:expiry_warning_days'), '10');
  await click(t('common:save'));
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/settings'));
  expect(sent('PUT agency')[0].data).toEqual({ expiry_warning_days: 10, oil_warning_km: 1500, oil_warning_days: 14 });
});

// Free prices (the second driver, extra km) load as '0' and must go back as 0, not be refused.
test('pricing: seasons, extras, places and late returns, as the API wants them', async () => {
  signIn(owner);
  serve({ ...common, 'GET agency/pricing': pricing, 'PUT agency/pricing': invalid({ 'seasons.0.from': [ 'invalid' ] }) });
  renderPage(PricingPage, '/settings/pricing');
  expect(await screen.findByDisplayValue('Baby seat')).toBeTruthy();
  expect(screen.getByDisplayValue('Enfidha airport')).toBeTruthy();

  await click(t('pricing:season:add'));
  fireEvent.change(screen.getAllByPlaceholderText(t('pricing:season:name'))[0], { target: { value: ' Summer ' } }); // extras have a "Name" too
  await click(t('pricing:discount:add'));
  fireEvent.change(screen.getByDisplayValue('Enfidha airport').closest('div.MuiStack-root')!.querySelectorAll('input')[1], { target: { value: '0' } }); // free now
  fireEvent.click(screen.getByText(t('pricing:late:hour')));
  await waitFor(() => expect(screen.getAllByPlaceholderText('TND')).toHaveLength(2)); // the extra's price, then the hour's
  fireEvent.change(screen.getAllByPlaceholderText('TND')[1], { target: { value: '8' } });
  fireEvent.change(screen.getByPlaceholderText('20'), { target: { value: '25' } }); // washing a car back dirty
  await click(t('common:save'));
  expect(await screen.findByText(t('pricing:invalid'))).toBeTruthy();
  expect(sent('PUT agency/pricing')[0].data).toEqual({
    seasons: [ { name: 'Summer', from: '01/07', to: '31/08', percent: 20 } ],
    discounts: [ { min_days: 7, percent: 10 } ],
    extras: [ { name: 'Baby seat', price: 10000, per: 'day' } ],
    locations: [ { name: 'Enfidha airport', fee: 0 } ],
    second_driver_price: 0, charge_extra_km: false, km_per_day: 300, extra_km_price: 0, late_grace_hours: 2, late_per: 'hour', late_hour_price: 8000,
    washing_price: 25000,
  });

  serve({ 'PUT agency/pricing': pricing });
  await click(t('common:save'));
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/settings'));
});

test('branches: added, renamed, removed', async () => {
  signIn(owner);
  serve({ ...common, 'GET branch': [ branch ], 'POST branch': branch, 'PUT branch/3': branch, 'DELETE branch/3': {} });
  renderPage(BranchesPage, '/settings/branches');
  expect(await screen.findByText(money(1200000))).toBeTruthy();

  await click(t('branch:add'));
  let form = await dialog();
  fireEvent.click(form.getByText(t('common:save')));
  expect(await screen.findByText(t('branch:invalid'))).toBeTruthy();
  fireEvent.change(form.getByLabelText(t('branch:name'), { exact: false }), { target: { value: 'Sousse' } });
  fireEvent.change(form.getByLabelText(t('branch:rent')), { target: { value: '900' } });
  fireEvent.click(form.getByText(t('common:save')));
  await waitFor(() => expect(sent('POST branch')).toHaveLength(1));
  expect(sent('POST branch')[0].data).toEqual({ name: 'Sousse', address: null, monthly_rent: 900000 });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

  fireEvent.click(screen.getByText('Airport'));
  form = await dialog();
  fireEvent.change(form.getByLabelText(t('branch:name'), { exact: false }), { target: { value: 'Enfidha airport' } });
  fireEvent.click(form.getByText(t('common:save')));
  await waitFor(() => expect(sent('PUT branch/3')).toHaveLength(1));
  expect(sent('PUT branch/3')[0].data).toEqual({ name: 'Enfidha airport', address: 'Enfidha', monthly_rent: 1200000 });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

  fireEvent.click(screen.getByText('Airport'));
  fireEvent.click((await dialog()).getByText(t('branch:delete')));
  fireEvent.click(await screen.findByText(t('common:confirm')));
  await waitFor(() => expect(sent('DELETE branch/3')).toHaveLength(1));
});

test('staff: a manager invited with a code, limited to a branch', async () => {
  signIn(owner);
  const invited = { ...manager, id: 5, first_name: 'Nour', last_name: 'Ayari', phone: '+21629000111', invited: true, branch_id: 3 };
  serve({ ...common, 'GET user': [ owner, { ...manager, disabled: true }, invited ], 'GET branch': [ branch ], 'POST user': reply(200, { data: invited, invite_code: '482913' }) /* the code beside `data` */ });
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
  renderPage(StaffPage, '/settings/staff');

  expect(await screen.findByText(t('staff:role:2') + ' · Airport')).toBeTruthy();
  expect(screen.getByText(t('staff:invited'))).toBeTruthy();
  expect(screen.getByText(t('staff:disabled'))).toBeTruthy();

  await click(t('staff:add'));
  const form = await dialog();
  fireEvent.change(form.getByLabelText(t('form:first_name:label'), { exact: false }), { target: { value: 'Nour' } });
  fireEvent.change(form.getByLabelText(t('form:last_name:label'), { exact: false }), { target: { value: 'Ayari' } });
  fireEvent.change(form.getByLabelText(t('form:phone:label'), { exact: false }), { target: { value: '+216 29 000 111' } });
  fireEvent.click(form.getByText('Airport'));
  fireEvent.click(form.getByText(t('common:save')));

  const code = within((await screen.findByText('482913')).closest('[role=dialog]') as HTMLElement);
  expect(sent('POST user')[0].data).toEqual({ first_name: 'Nour', last_name: 'Ayari', phone: '+21629000111', role: 2, branch_id: 3, lang: 'en' });
  fireEvent.click(code.getByText(t('common:share')));
  expect(await screen.findByText(t('common:copied'))).toBeTruthy();
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(t('staff:invite:share', { code: '482913' }));
});

test('staff: an account\'s history, a new code, and the owner can\'t demote themselves', async () => {
  signIn(owner);
  serve({
    ...common, 'GET user': [ owner, manager ], 'GET branch': [],
    'GET user/2/activity': [ { id: 1, action: 'updated', changes: { role: [ 1, 2 ] }, user: { id: 1, first_name: 'Sami', last_name: 'Mansour' }, created_at: 1780000000 } ],
    'POST user/2/invite': reply(200, { invite_code: '777111' }),
    'PUT user/1': invalid({ role: [ 'user:self' ] }),
  });
  renderPage(StaffPage, '/settings/staff');

  fireEvent.click(await screen.findByText('Hela Gharbi'));
  let form = await dialog();
  expect(await form.findByText(t('activity:field:role') + ' : ' + t('staff:role:1') + ' → ' + t('staff:role:2'))).toBeTruthy();
  fireEvent.click(form.getByText(t('staff:invite:send')));
  expect(await screen.findByText('777111')).toBeTruthy();
  expect(sent('POST user/2/invite')[0].data).toEqual({ lang: 'en' });
  fireEvent.click(screen.getByText(t('common:ok')));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

  fireEvent.click(screen.getByText('Sami Mansour', { selector: 'td button' })); // the sidebar names you too
  form = await dialog();
  expect(form.queryByText(t('staff:role'))).toBeNull(); // your own role isn't yours to change
  expect(form.queryByText(t('staff:invite:send'))).toBeNull();
  fireEvent.click(form.getByText(t('common:save')));
  expect(await screen.findByText(t('user:self'))).toBeTruthy();
});

test('theme: the owner picks the agency\'s palette and light or dark, applied at once', async () => {
  signIn(owner);
  serve({ ...common, 'PUT agency': { ...agency, theme: 'taxi' } });
  renderPage(ThemePage, '/settings/theme');

  const navy = (await screen.findByText(t('theme:palette:navy'))).closest('button')!;
  expect(navy.getAttribute('aria-pressed')).toBe('true'); // no theme yet: the default
  fireEvent.click(screen.getByText(t('theme:palette:taxi')));
  await waitFor(() => expect(sent('PUT agency')).toHaveLength(1));
  expect(sent('PUT agency')[0].data).toEqual({ theme: 'taxi' });
  await waitFor(() => expect(screen.getByText(t('theme:palette:taxi')).closest('button')!.getAttribute('aria-pressed')).toBe('true'));
  // The whole app takes the palette: MUI's variables on the page are the taxi's.
  expect(document.documentElement.outerHTML).toContain('#F7D22A');

  fireEvent.click(screen.getByText(t('theme:dark')));
  await waitFor(() => expect(sent('PUT agency')).toHaveLength(2));
  expect(sent('PUT agency')[1].data).toEqual({ theme_mode: 3 });
});
