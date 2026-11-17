import { expect, test } from 'vitest';
import { fireEvent, waitFor, within } from '@testing-library/react';
import { click, money, renderPage, router, screen, sent, serve, signIn, t } from './harness';
import { at, clio, common, employee, manager, owner } from './fixtures';
import { CashBook } from '../../src/api/cashbook';
import { toDateInput } from '../../src/support/day';
import { formatDate } from '../../src/support/utils';
import CashBookPage from '../../pages/cashbook';
import BillsPage from '../../pages/bills';
import PayrollPage from '../../pages/payroll';
import EmployeePage from '../../pages/payroll/[id]';

const dialog = async () => within(await screen.findByRole('dialog'));
const confirm = async () => fireEvent.click((await dialog()).getByText(t('common:confirm')));
const branch = { id: 3, name: 'Airport', address: null, monthly_rent: 1200000 };

const cashbook: CashBook = {
  date: toDateInput(new Date()), since: 0, opening: 500000, closing: 670000, cash_in: 330000, cash_out: 160000,
  payments_by_method: [ { method: 1, amount: 230000 }, { method: 2, amount: 100000 } ],
  lines: [
    { kind: 'payment', at: at(0, 9), amount: 230000, label: 'Leila Ben Salah', contract_id: 2, user: { id: 2, first_name: 'Hela', last_name: 'Gharbi' } },
    { kind: 'expense', at: at(0, 11), amount: -150000, label: null, category: 1, car_id: 1, user: null },
    { kind: 'movement', at: at(0, 12), amount: -10000, label: 'Coffee', id: 3, type: 2, user: null },
  ],
};

test('the cash book: balances, payments by method, and each line opens what it came from', async () => {
  signIn(owner);
  serve({ ...common, 'GET cashbook': cashbook, 'GET user': [ owner, manager ], 'DELETE cash-movement/3': {} });
  renderPage(CashBookPage, '/cashbook');

  expect(await screen.findByText(money(670000))).toBeTruthy(); // the closing balance
  expect(sent('GET cashbook')[0].params).toEqual({ date: toDateInput(new Date()) });
  expect(screen.getByText('+' + money(230000))).toBeTruthy();
  expect(screen.getByText(t('cash:movement:2') + ' · Coffee')).toBeTruthy();

  fireEvent.click(screen.getByText(t('cash:payment') + ' · Leila Ben Salah'));
  expect(router.push).toHaveBeenCalledWith('/contracts/2');
  fireEvent.click(screen.getByText(t('expense:category:1')));
  expect(router.push).toHaveBeenCalledWith('/cars/1');
  fireEvent.click(screen.getByText(t('cash:movement:2') + ' · Coffee'));
  await confirm();
  await waitFor(() => expect(sent('DELETE cash-movement/3')).toHaveLength(1));

  fireEvent.click(document.querySelector('[data-testid=ChevronLeftIcon]')!.closest('button')!);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  await waitFor(() => expect(sent('GET cashbook').at(-1)!.params).toEqual({ date: toDateInput(yesterday) }));

  serve({ 'GET cashbook': { ...cashbook, opening: null, closing: null } });
  fireEvent.click(screen.getByText('Hela'));
  expect(await screen.findByText(t('cash:filtered'))).toBeTruthy();
  expect(sent('GET cashbook').at(-1)!.params).toEqual({ date: toDateInput(yesterday), user_id: 2 });
});

test('the day the agency joined, the cash book says it starts there', async () => {
  signIn(owner);
  const today = new Date();
  const since = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() / 1000;
  serve({ ...common, 'GET cashbook': { ...cashbook, since }, 'GET user': [ owner ] });
  renderPage(CashBookPage, '/cashbook');
  expect(await screen.findByText(t('cash:since', { date: formatDate(since) }))).toBeTruthy();
});

test('cash taken out of the till, and an agency cost paid from it', async () => {
  signIn(owner);
  serve({
    ...common, 'GET cashbook': cashbook, 'GET user': [ owner ], 'GET car': [ clio ], 'GET branch': [ branch ],
    'GET employee': [ employee() ], 'POST cash-movement': {}, 'POST expense': {},
  });
  renderPage(CashBookPage, '/cashbook');

  await click(t('cash:movement:add'));
  let form = await dialog();
  fireEvent.click(form.getByText(t('cash:movement:3')));
  fireEvent.change(form.getByLabelText(t('payment:amount')), { target: { value: '400' } });
  fireEvent.click(form.getByText(t('common:save')));
  await waitFor(() => expect(sent('POST cash-movement')).toHaveLength(1));
  expect(sent('POST cash-movement')[0].data).toEqual({ type: 3, amount: 400000, note: null });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

  await click(t('expense:add'));
  form = await dialog();
  fireEvent.click(await form.findByText(t('expense:agency')));
  fireEvent.click(form.getByText(t('expense:category:24'))); // phone credit, for an employee
  fireEvent.click(await form.findByText('Airport'));
  fireEvent.click(await form.findByText('Karim Jaziri'));
  fireEvent.change(form.getByLabelText(t('payment:amount')), { target: { value: '20' } });
  fireEvent.click(form.getByText(t('common:save')));
  await waitFor(() => expect(sent('POST expense')).toHaveLength(1));
  expect(sent('POST expense')[0].data).toMatchObject({ car_id: null, branch_id: 3, employee_id: 1, category: 24, amount: 20000, mileage: null, method: 1 });
});

test('recurring bills: listed, added, changed and removed', async () => {
  signIn(owner);
  const rent = { id: 5, category: 20, amount: 1200000, every_months: 1, next_due_at: at(3, 9), note: null, branch_id: 3, branch: { id: 3, name: 'Airport' } };
  serve({ ...common, 'GET recurring-bill': [ rent ], 'GET branch': [ branch ], 'POST recurring-bill': rent, 'PUT recurring-bill/5': rent, 'DELETE recurring-bill/5': {} });
  renderPage(BillsPage, '/bills');

  expect(await screen.findByText([ t('bill:next', { date: formatDate(at(3)) }), t('bill:every', { months: 1 }), 'Airport' ].join(' · '))).toBeTruthy();
  expect(screen.getByText(money(1200000))).toBeTruthy();

  await click(t('bill:add'));
  let form = await dialog();
  fireEvent.click(form.getByText(t('common:save')));
  expect(await screen.findByText(t('payment:amount:invalid'))).toBeTruthy();
  fireEvent.click(form.getByText(t('expense:category:21')));
  fireEvent.change(form.getByLabelText(t('payment:amount')), { target: { value: '90' } });
  fireEvent.click(form.getByText(t('bill:every:3')));
  fireEvent.change(form.getByLabelText(t('bill:next_label')), { target: { value: '2026-10-05' } });
  fireEvent.click(form.getByText(t('common:save')));
  await waitFor(() => expect(sent('POST recurring-bill')).toHaveLength(1));
  expect(sent('POST recurring-bill')[0].data).toEqual({
    category: 21, amount: 90000, every_months: 3, note: null, branch_id: null, next_due_at: new Date(2026, 9, 5, 9).getTime() / 1000,
  });

  fireEvent.click(await screen.findByText(t('expense:category:20')));
  form = await dialog();
  expect(form.getByDisplayValue('1200')).toBeTruthy();
  fireEvent.change(form.getByLabelText(t('payment:amount')), { target: { value: '1300' } });
  fireEvent.click(form.getByText(t('common:save')));
  await waitFor(() => expect(sent('PUT recurring-bill/5')).toHaveLength(1));
  expect(sent('PUT recurring-bill/5')[0].data).toMatchObject({ amount: 1300000, branch_id: 3 });

  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.click(screen.getByText(t('expense:category:20')));
  fireEvent.click((await dialog()).getByText(t('bill:delete')));
  fireEvent.click(await screen.findByText(t('common:confirm'))); // over the bill's dialog
  await waitFor(() => expect(sent('DELETE recurring-bill/5')).toHaveLength(1));
});

test('payroll: who is paid, who is still due, who left; a new employee', async () => {
  signIn(owner);
  serve({
    ...common, 'POST employee': employee(),
    'GET employee': [ employee(), employee({ id: 2, first_name: 'Rim', last_name: null, role_label: null, due_this_month: 0, paid_this_month: 800000 }), employee({ id: 3, first_name: 'Omar', role_label: 'Mechanic', active: false }) ],
  });
  renderPage(PayrollPage, '/payroll');

  expect(await screen.findByText('Washer · ' + money(900000))).toBeTruthy();
  expect(screen.getAllByText(t('payroll:due'))).toHaveLength(1); // Karim's salary is still due
  expect(screen.getByText(t('payroll:paid'))).toBeTruthy(); // Rim
  expect(screen.getByText(t('payroll:inactive'))).toBeTruthy(); // Omar
  expect(screen.getByText('Karim Jaziri').closest('a')!.getAttribute('href')).toBe('/payroll/1');

  await click(t('payroll:add'));
  const form = await dialog();
  fireEvent.change(form.getByLabelText(t('form:first_name:label'), { exact: false }), { target: { value: 'Nabil' } });
  fireEvent.change(form.getByLabelText(t('form:phone:label')), { target: { value: '+216 12' } });
  fireEvent.click(form.getByText(t('common:save')));
  expect(await screen.findByText(t('payroll:invalid'))).toBeTruthy();

  fireEvent.change(form.getByLabelText(t('form:phone:label')), { target: { value: '+216 ' } });
  fireEvent.change(form.getByLabelText(t('payroll:salary:dinars')), { target: { value: '750' } });
  fireEvent.click(form.getByText(t('common:save')));
  await waitFor(() => expect(sent('POST employee')).toHaveLength(1));
  expect(sent('POST employee')[0].data).toEqual({
    first_name: 'Nabil', last_name: null, phone: null, role_label: null, monthly_salary: 750000, hired_at: null, active: true, user_id: null,
  });
});

test('an employee: pay the salary due, give an advance, remove a payment, mark as left', async () => {
  signIn(owner);
  const karim = employee({
    due_this_month: 400000, paid_this_month: 500000, year_total: 8600000,
    payments: [ { id: 11, employee_id: 1, month: '2026-09', type: 2, amount: 500000, paid_at: at(-10), method: 1, note: null } ],
  });
  serve({ ...common, 'GET employee/1': karim, 'POST employee/1/payment': {}, 'DELETE employee/1/payment/11': {}, 'PUT employee/1': karim });
  renderPage(EmployeePage, '/payroll/[id]', '/payroll/1');

  expect(await screen.findByText(t('payroll:type:2', { month: '2026-09' }))).toBeTruthy();
  expect(screen.getByText(money(8600000))).toBeTruthy();

  await click(t('payroll:pay_salary'));
  let form = await dialog();
  expect(form.getByText(t('payroll:paying', { name: 'Karim Jaziri' }))).toBeTruthy();
  expect(form.getByDisplayValue('400')).toBeTruthy();
  fireEvent.click(form.getByText(t('payment:method:3')));
  fireEvent.click(form.getByText(t('common:save')));
  await waitFor(() => expect(sent('POST employee/1/payment')).toHaveLength(1));
  expect(sent('POST employee/1/payment')[0].data).toEqual({ type: 1, amount: 400000, method: 3, note: null });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

  await click(t('payroll:pay_advance'));
  form = await dialog();
  fireEvent.change(form.getByLabelText(t('payment:amount')), { target: { value: '100' } });
  fireEvent.click(form.getByText(t('common:save')));
  await waitFor(() => expect(sent('POST employee/1/payment')).toHaveLength(2));
  expect(sent('POST employee/1/payment')[1].data).toEqual({ type: 2, amount: 100000, method: 1, note: null });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

  fireEvent.click(document.querySelector('[data-testid=DeleteOutlinedIcon]')!.closest('button')!);
  await confirm();
  await waitFor(() => expect(sent('DELETE employee/1/payment/11')).toHaveLength(1));

  await click(t('common:edit'));
  form = await dialog();
  fireEvent.click(form.getByText(t('payroll:inactive')));
  fireEvent.click(form.getByText(t('common:save')));
  await waitFor(() => expect(sent('PUT employee/1')).toHaveLength(1));
  expect(sent('PUT employee/1')[0].data).toMatchObject({ first_name: 'Karim', phone: '+21698111222', active: false });
});
