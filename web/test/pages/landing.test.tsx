import { expect, test } from 'vitest';
import { waitFor } from '@testing-library/react';
import { money, renderPage, router, screen, sent, signIn, t } from './harness';
import { owner } from './fixtures';
import HomePage from '../../pages';

const href = (text: string) => screen.getAllByText(text)[0].closest('a')!.getAttribute('href');

test('the home page is public: what the platform is, its prices, and the ways in', async () => {
  renderPage(HomePage, '/');
  expect(await screen.findByText(t('landing:hero:title'))).toBeTruthy();
  expect(href(t('landing:start'))).toBe('/signup');
  expect(href(t('landing:signin'))).toBe('/login');
  expect(screen.getByText(t('landing:plan:month', { price: money(35000) }))).toBeTruthy();
  expect(screen.getByText(t('landing:data:title'))).toBeTruthy();
  expect(screen.queryByText(t('common:cars'))).toBeNull(); // no staff sidebar
  expect(router.replace).not.toHaveBeenCalled(); // no sign-in asked
  expect(sent('POST refresh')).toEqual([]);
});

test('signed in, the home page leads to Today', async () => {
  signIn(owner);
  renderPage(HomePage, '/');
  await waitFor(() => expect(href(t('landing:open_app'))).toBe('/today'));
  expect(router.replace).not.toHaveBeenCalled();
});
