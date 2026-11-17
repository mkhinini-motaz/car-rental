/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App, { queryClient } from '../src/App';

// No API in tests: `refresh()` decides between the login screen and the home screen.
const mockRefresh = jest.fn();
jest.mock('../src/api/auth', () => ({ refresh: () => mockRefresh() }));
jest.mock('../src/api/contract', () => ({ index: () => Promise.resolve([]) }));
jest.mock('../src/api/agency', () => {
  const { useQuery } = require('@tanstack/react-query');
  const show = () => Promise.resolve({ id: 1, name: "M'saken rent a car", phone: null, address: null, logo_url: null, expiry_warning_days: 7, pickup_time: '10:00', return_time: '10:00' });
  return {
    show,
    useAgency: () => useQuery({ queryKey: ['agency.show'], queryFn: show }),
    dashboard: () => Promise.resolve({ pickups: [], returns: [], cars_available: 3, cars_total: 8, cars_out: 5, overdue: 0, expiring_cars: [], maintenance_due: [], to_clean: [] }),
  };
});

let tree: ReactTestRenderer.ReactTestRenderer;

async function render() {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  return tree;
}

// Unmount so nothing renders after Jest tears the environment down; cached queries
// hold 5-minute GC timers that keep Jest from exiting.
afterEach(async () => {
  await ReactTestRenderer.act(async () => tree.unmount());
  queryClient.clear();
});

const hasText = (tree: ReactTestRenderer.ReactTestRenderer, text: string) =>
  tree.root.findAll(node => node.props.children === text).length > 0;

test('shows the login screen when logged out', async () => {
  mockRefresh.mockResolvedValue(null);
  const tree = await render();
  expect(hasText(tree, 'Connecti')).toBe(true);
});

test('shows the Today tab when logged in', async () => {
  mockRefresh.mockResolvedValue({ id: 1, first_name: 'Test', last_name: 'User', access_token: 'token' });
  const tree = await render();
  // The dashboard and agency queries resolve; TanStack Query notifies on a timer.
  for (let tick = 0; tick < 3; tick++) {
    await ReactTestRenderer.act(() => new Promise(resolve => setTimeout(resolve, 10)));
  }
  expect(hasText(tree, '3/8')).toBe(true); // cars at the agency
  expect(hasText(tree, 'Lyoum')).toBe(true); // the tab, in the default language
});
