import React from 'react';
import { expect, test } from 'vitest';
import { fireEvent, waitFor, within } from '@testing-library/react';
import { click, invalid, OFFLINE, renderPage, reply, router, screen, sent, serve, signIn, t, type, unhandled } from './harness';
import { agency, common, manager, owner } from './fixtures';
import { translate } from '../../src/i18n';
import LoginPage from '../../pages/login';
import SignupPage from '../../pages/signup';
import CarsPage from '../../pages/cars';

// A staff page with nothing of its own, to watch the guard and the layout around it.
const Inside = () => <p>inside</p>;


test('a signed-out visit goes to login and comes back after', async () => {
  serve(common);
  renderPage(Inside, '/cars/[id]', '/cars/3?tab=money');
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login?next=' + encodeURIComponent('/cars/3?tab=money')));
  expect(screen.queryByText('inside')).toBeNull();
  expect(sent('POST refresh')).toEqual([]); // no token saved: nothing to restore
});

test('Today sends a signed-out visitor to plain /login', async () => {
  renderPage(Inside, '/today');
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
});

test('logging in stores the token and goes on to the page asked for', async () => {
  serve({ ...common, 'POST login': { ...owner, access_token: 'fresh' } });
  renderPage(LoginPage, '/login', '/login?next=%2Fcars');
  await type(t('form:phone:label'), '+216 23 456 109');
  await type(t('form:password:label'), 'azerty12');
  await click(t('common:login'));

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/cars'));
  expect(sent('POST login')[0].data).toEqual({ phone: '+21623456109', password: 'azerty12' });
  expect(localStorage.getItem('user_access_token')).toBe('fresh');
});

test('after login, `next` never leads to another site', async () => {
  serve({ 'POST login': { ...owner, access_token: 'fresh' } });
  renderPage(LoginPage, '/login', '/login?next=' + encodeURIComponent('//evil.example'));
  await type(t('form:phone:label'), '+21623456109');
  await click(t('common:login'));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/today'));
});

test('a wrong password and an unreachable API say different things', async () => {
  serve({ 'POST login': reply(401) });
  renderPage(LoginPage, '/login');
  await click(t('common:login'));
  expect(await screen.findByText(t('login:error'))).toBeTruthy();
  expect(localStorage.getItem('user_access_token')).toBeNull();

  serve({ 'POST login': OFFLINE });
  await click(t('common:login'));
  expect(await screen.findByText(t('network:error'))).toBeTruthy();
});

test('forgot password: a code by SMS, then a new password logs you in', async () => {
  serve({ 'POST otp/request': reply(200), 'POST password/reset': { ...owner, access_token: 'reset' } });
  renderPage(LoginPage, '/login');
  await type(t('form:phone:label'), '+216 12');
  await click(t('common:forgot-password?'));
  expect(await screen.findByText(t('validation:phone:invalid'))).toBeTruthy();

  await type(t('form:phone:label'), '+216 23 456 109');
  await click(t('common:forgot-password?'));
  await click(t('form:otp:request'));
  expect(await screen.findByText(t('otp:sent'))).toBeTruthy();
  expect(sent('POST otp/request')[0].data).toEqual({ phone: '+21623456109', lang: 'en' });

  await type(t('form:otp:label'), '123');
  await click(t('common:confirm'));
  expect(await screen.findByText(t('otp:validation:wrong'))).toBeTruthy();

  await type(t('form:otp:label'), '123 456');
  await type(t('settings:password:new'), 'nouveau-pass');
  await type(t('form:password_confirmation:label'), 'nouveau-pass');
  await click(t('common:confirm'));
  await waitFor(() => expect(localStorage.getItem('user_access_token')).toBe('reset'));
  expect(sent('POST password/reset')[0].data).toEqual({ phone: '+21623456109', otp: '123456', password: 'nouveau-pass', password_confirmation: 'nouveau-pass' });
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/today'));
});

test('forgot password: a wrong code from the API', async () => {
  serve({ 'POST password/reset': invalid({ otp: [ 'otp:validation:wrong' ] }) });
  renderPage(LoginPage, '/login');
  await type(t('form:phone:label'), '+21623456109');
  await click(t('common:forgot-password?'));
  await type(t('form:otp:label'), '654321');
  await type(t('settings:password:new'), 'nouveau-pass');
  await type(t('form:password_confirmation:label'), 'autre-pass');
  await click(t('common:confirm'));
  expect(await screen.findByText(t('validation:password:confirmation'))).toBeTruthy();

  await type(t('form:password_confirmation:label'), 'nouveau-pass');
  await click(t('common:confirm'));
  expect(await screen.findByText(t('otp:validation:wrong'))).toBeTruthy();
  expect(localStorage.getItem('user_access_token')).toBeNull();
});

test('sign-up: the agency and its owner, a code, then a password', async () => {
  serve({ 'POST signup/code': reply(200), 'POST signup': { ...owner, access_token: 'new-agency' } });
  renderPage(SignupPage, '/signup');
  await type(t('signup:agency_name'), '   '); // the browser checks the field is filled in, not with what
  await type(t('form:first_name:label'), 'Sami');
  await type(t('form:last_name:label'), 'Mansour');
  await click(t('signup:send_code'));
  expect(await screen.findByText(t('validation:required'))).toBeTruthy();

  await type(t('signup:agency_name'), '  Sahel Cars ');
  await type(t('form:first_name:label'), 'Sami');
  await type(t('form:last_name:label'), 'Mansour');
  await type(t('form:phone:label'), '+216 23 456 109');
  await click(t('signup:send_code'));
  await screen.findByText(t('signup:code_hint', { phone: '⁦+216 23 456 109⁩' }));
  expect(sent('POST signup/code')[0].data).toEqual({ phone: '+21623456109', lang: 'en' });

  await type(t('form:otp:label'), '111222');
  await type(t('settings:password:new'), 'motdepasse');
  await type(t('form:password_confirmation:label'), 'motdepasse');
  await click(t('signup:create'));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/today'));
  expect(sent('POST signup')[0].data).toEqual({
    agency_name: 'Sahel Cars', first_name: 'Sami', last_name: 'Mansour', phone: '+21623456109', otp: '111222', password: 'motdepasse', password_confirmation: 'motdepasse',
  });
  expect(localStorage.getItem('user_access_token')).toBe('new-agency');
});

test('sign-up: a phone that already has an account', async () => {
  serve({ 'POST signup/code': invalid({ phone: [ 'validation.unique' ] }) });
  renderPage(SignupPage, '/signup');
  await type(t('signup:agency_name'), 'Sahel Cars');
  await type(t('form:first_name:label'), 'Sami');
  await type(t('form:last_name:label'), 'Mansour');
  await type(t('form:phone:label'), '+21623456109');
  await click(t('signup:send_code'));
  expect(await screen.findByText(t('signup:phone:taken'))).toBeTruthy();
});

test('a saved session comes back with a fresh token, inside the layout', async () => {
  signIn(owner);
  serve(common);
  renderPage(Inside, '/today');
  expect(await screen.findByText('inside')).toBeTruthy();
  expect(localStorage.getItem('user_access_token')).toBe('fresh');
  expect((await screen.findAllByText(agency.name)).length).toBeGreaterThan(0); // the sidebar
  expect(screen.getAllByText(t('common:cash_book')).length).toBeGreaterThan(0); // owner-only entry
  expect(unhandled).toEqual([]);
});

test('a manager does not see the owner\'s money pages', async () => {
  signIn(manager);
  serve(common);
  renderPage(Inside, '/today');
  await screen.findByText('inside');
  expect(screen.getAllByText(t('common:fines')).length).toBeGreaterThan(0);
  for (const label of [ 'common:cash_book', 'common:reports', 'payroll:label', 'bill:label', 'car:sold:label' ]) {
    expect(screen.queryByText(t(label))).toBeNull();
  }
});

test('a signed-in user on /login goes on to Today', async () => {
  signIn(owner);
  serve(common);
  renderPage(LoginPage, '/login');
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/today'));
});

test('a token rejected mid-session signs out and returns to login', async () => {
  signIn(owner);
  serve({ ...common, 'GET car': reply(401) });
  renderPage(CarsPage, '/cars');
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login?next=%2Fcars'));
  expect(localStorage.getItem('user_access_token')).toBeNull();
});

test('logging out asks first, then revokes the token', async () => {
  signIn(owner);
  serve({ ...common, 'POST logout': reply(200) });
  renderPage(Inside, '/today');
  await screen.findByText('inside');
  fireEvent.click(screen.getAllByTitle(t('common:logout'))[0]);
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: t('common:cancel') }));
  expect(sent('POST logout')).toEqual([]);

  fireEvent.click(screen.getAllByTitle(t('common:logout'))[0]);
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: t('common:confirm') }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
  expect(sent('POST logout')).toHaveLength(1);
  expect(localStorage.getItem('user_access_token')).toBeNull();
});

test('Arabic turns the page right to left', async () => {
  localStorage.setItem('lang', 'ar');
  renderPage(LoginPage, '/login');
  expect(await screen.findByRole('heading', { name: translate('common:login', 'ar') })).toBeTruthy();
  expect(document.documentElement.dir).toBe('rtl');
  expect(document.documentElement.lang).toBe('ar');
});
