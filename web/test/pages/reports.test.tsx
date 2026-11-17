import { expect, test } from 'vitest';
import { fireEvent, waitFor } from '@testing-library/react';
import { money, renderPage, reply, screen, sent, serve, signIn, t } from './harness';
import { at, clio, common, manager, owner, polo } from './fixtures';
import { Report } from '../../src/api/agency';
import { formatDate, plate } from '../../src/support/utils';
import ReportsPage from '../../pages/reports';

const today = new Date();
const tab = (key: string) => screen.findByText(t(key), { selector: '.MuiChip-label' }); // the sidebar has "Clients" too
const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
const summary = (car: typeof clio) => ({ id: car.id, licence_plate: car.licence_plate, manufacturer: car.manufacturer, model_name: car.model_name });
const leila = { id: 2, first_name: 'Leila', last_name: 'Ben Salah', phone: '+21655667700' };

const report: Report = {
  month: thisMonth, since: 0, revenue: 6000000, other_income: 0, car_costs: 900000, instalments: 1200000, overhead: 1500000, payroll: 1800000,
  employer_charges: 0, commissions: 60000, expenses: 5460000, net: 540000, utilization_rate: 0.62,
  previous: { revenue: 5000000, net: 600000, utilization_rate: 0.5 },
  kpis: { average_daily_rate: 95000, contracts_started: 21, contracts_cancelled: 2, average_days: 3.1, late_returns: 1, late_hours: 5, overdue_now: 1 },
  payments_received: 5800000, payments_by_method: [ { method: 1, amount: 5000000 }, { method: 3, amount: 800000 } ],
  expenses_by_category: [ { category: 20, amount: 1200000 }, { category: 1, amount: 150000 } ],
  overhead_by_branch: [ { branch: { id: 3, name: 'Airport' }, amount: 300000 } ], overhead_per_car: 500000,
  payroll_by_employee: [ { employee: { id: 1, first_name: 'Karim', last_name: 'Jaziri' }, amount: 900000 } ],
  commissions_by_broker: [ { broker: 'Hotel Riu', contracts: 2, amount: 60000 } ], fines_paid_by_agency: 0,
  months: [ { month: '2026-01', revenue: 4000000, expenses: 3000000 }, { month: thisMonth, revenue: 6000000, expenses: 5460000 } ],
  utilization: [ { car: clio, days_rented: 19, rate: 0.63, revenue: 1710000, idle_days: 11, maintenance_days: 0, cost_per_km: 120 } ],
  owed_rent: 100000, owed_contracts: [ { id: 2, client: leila, car: summary(polo), owed: 100000, days_late: 1 } ],
  owed_fines: 60000, unpaid_fines: [ { id: 8, amount: 60000, committed_at: at(-1), licence_plate: polo.licence_plate, client: leila } ],
  deposits_held: 300000, upcoming: { count: 4, revenue: 1100000 },
  clients: [
    { client: { ...leila, flag: null }, revenue: 330000, contracts: 1, outstanding: 100000, badge: 'watch' },
    { client: { id: 1, first_name: 'Ahmed', last_name: 'Trabelsi', phone: '+21622123456', flag: null }, revenue: 1400000, contracts: 4, outstanding: 0, badge: 'good' },
  ],
  fleet: [ { car: summary(clio), total_cost: 54350000, earned: 4200000, payback: 0.08, history_since: null, fleet_deadline: at(400), months_left: 13, expected_sale_price: 38000000 } ],
  sold_cars: [], renewal: [ { car: summary(clio), total_cost: 54350000, earned: 4200000, payback: 0.08, history_since: null, fleet_deadline: at(400), months_left: 13, expected_sale_price: 38000000 } ],
  capital_next_12_months: 0, export_url: 'https://api.example/report.csv',
};

test('the month: figures against last month, where the money went, the year', async () => {
  signIn(owner);
  serve({ ...common, 'GET report': report, 'GET expense': [ { id: 4, category: 1, amount: 150000, spent_at: at(-2), mileage: null, garage: null, note: null, method: 1, car_id: 1, car: clio } ] });
  renderPage(ReportsPage, '/reports');

  expect((await screen.findAllByText(money(6000000))).length).toBeGreaterThan(0);
  expect(screen.getByText('+20 %')).toBeTruthy(); // revenue since last month
  expect(screen.getByText('-10 %')).toBeTruthy(); // net
  expect(screen.getByText('62 %')).toBeTruthy();
  expect(screen.getByText(t('report:late_returns:value', { count: 1, hours: 5 }))).toBeTruthy();
  expect(screen.getByText(t('report:broker', { name: 'Hotel Riu', count: 2 }))).toBeTruthy();
  expect(screen.getByText('Karim Jaziri').parentElement!.querySelector('a')!.getAttribute('href')).toBe('/payroll/1');
  expect(screen.getByText(t('report:export')).closest('a')!.getAttribute('href')).toBe('https://api.example/report.csv');
  expect(sent('GET report')[0].params).toEqual({ year: today.getFullYear(), month: today.getMonth() + 1 });
  const from = new Date(today.getFullYear(), today.getMonth(), 1).getTime() / 1000;
  expect(sent('GET expense')[0].params).toEqual({ from, to: new Date(today.getFullYear(), today.getMonth() + 1, 1).getTime() / 1000, perPage: 100 });
  expect(await screen.findByText(formatDate(at(-2)) + ' · ' + plate(clio.licence_plate))).toBeTruthy();

  fireEvent.click(screen.getByText('01')); // January, on the year's chart
  await waitFor(() => expect(sent('GET report').at(-1)!.params).toEqual({ year: 2026, month: 1 }));
});

test('the fleet: days rented, payback and renewal per car', async () => {
  signIn(owner);
  serve({ ...common, 'GET report': report, 'GET expense': [] });
  renderPage(ReportsPage, '/reports');
  fireEvent.click(await tab('report:tab:fleet'));
  expect(await screen.findByText(t('report:fleet:line', { earned: money(4200000), cost: money(54350000) }))).toBeTruthy();
  expect(screen.getByText('8 %')).toBeTruthy();
  expect(screen.getByText([ t('report:days:rented', { days: 19, rate: 63 }), t('report:days:idle', { days: 11 }), t('report:cost_per_km', { amount: money(120) }) ].join(' · '))).toBeTruthy();
  expect(screen.getByText([ t('today:leaves_on', { date: formatDate(at(400)) }), t('report:expected', { amount: money(38000000) }) ].join(' · '))).toBeTruthy();
});

test('clients, and only those who owe', async () => {
  signIn(owner);
  serve({ ...common, 'GET report': report, 'GET expense': [] });
  renderPage(ReportsPage, '/reports');
  fireEvent.click(await tab('report:tab:clients'));
  expect(await screen.findByText('Ahmed Trabelsi')).toBeTruthy();
  fireEvent.click(screen.getByText(t('report:clients:owing')));
  await waitFor(() => expect(screen.queryByText('Ahmed Trabelsi')).toBeNull());
  expect(screen.getByText('Leila Ben Salah').closest('a')!.getAttribute('href')).toBe('/clients/2');
});

test('who owes what right now', async () => {
  signIn(owner);
  serve({ ...common, 'GET report': report, 'GET expense': [] });
  renderPage(ReportsPage, '/reports');
  fireEvent.click(await tab('report:tab:owed'));
  expect(await screen.findByText(t('report:deposits_held'))).toBeTruthy();
  const rows = screen.getAllByText('Leila Ben Salah').map(name => name.closest('a')!.getAttribute('href'));
  expect(rows).toEqual([ '/contracts/2', '/fines/8' ]);
});

test('a manager is told reports are the owner\'s', async () => {
  signIn(manager);
  serve({ ...common, 'GET report': reply(403), 'GET expense': [] });
  renderPage(ReportsPage, '/reports');
  expect(await screen.findByText(t('report:forbidden'))).toBeTruthy();
});
