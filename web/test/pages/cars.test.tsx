import { expect, test } from 'vitest';
import { fireEvent, waitFor, within } from '@testing-library/react';
import { click, invalid, money, renderPage, router, screen, sent, serve, signIn, t, type, unhandled } from './harness';
import { at, car, clio, common, contract, i10, leila, manager, money as carMoney, now, out, owner, polo } from './fixtures';
import { formatDate } from '../../src/support/utils';
import CarsPage from '../../pages/cars';
import NewCarPage from '../../pages/cars/new';
import EditCarPage from '../../pages/cars/[id]/edit';
import CarPage from '../../pages/cars/[id]';
import SoldCarsPage from '../../pages/cars/sold';
import CarPurchasePage from '../../pages/cars/[id]/purchase';

const dialog = () => screen.findByRole('dialog');
const confirmDialog = async () => fireEvent.click(within(await screen.findByRole('dialog', { name: /./ })).getByText(t('common:confirm')));
const photo = new File([ 'jpeg' ], 'clio.png', { type: 'image/png' });

test('the fleet: each car with where it is now', async () => {
  signIn(owner);
  const back = { ...polo, contracts: [ { ...out, ends_at: now + 3600 } ] };
  const late = car({ id: 4, licence_plate: '140 TU 2222', contracts: [ { ...out, id: 9, ends_at: now - 3600 } ] });
  serve({ ...common, 'GET car': [ clio, back, i10, late ] });
  renderPage(CarsPage, '/cars');

  expect(await screen.findByText(clio.licence_plate)).toBeTruthy();
  expect(screen.getByText(t('car:status:1'))).toBeTruthy();
  expect(screen.getByText(t('car:state:back_today'))).toBeTruthy();
  expect(screen.getByText(t('car:status:2'))).toBeTruthy(); // the i10
  expect(screen.getByText(t('car:state:overdue'))).toBeTruthy();
  expect(screen.getByText(t('car:daily_price', { price: money(110000) }))).toBeTruthy(); // the Polo's
  expect(screen.getByText(clio.licence_plate).closest('a')!.getAttribute('href')).toBe('/cars/1');
  expect(screen.getByText(t('car:new')).closest('a')!.getAttribute('href')).toBe('/cars/new');
  expect(sent('GET car')[0].params).toEqual({ perPage: 100 });
  expect(unhandled).toEqual([]);
});

test('a manager sees the fleet but cannot add a car; an empty fleet says so', async () => {
  signIn(manager);
  serve({ ...common, 'GET car': [] });
  renderPage(CarsPage, '/cars');
  expect(await screen.findByText(t('car:none'))).toBeTruthy();
  expect(screen.queryByText(t('car:new'))).toBeNull();
});

test('a new car: every field of the carte grise, then its photo', async () => {
  signIn(owner);
  serve({ ...common, 'GET branch': [], 'POST car': { ...clio, id: 7 }, 'POST car/7/photo': { ...clio, id: 7 } });
  renderPage(NewCarPage, '/cars/new');
  await click(t('common:save'));
  expect((await screen.findAllByText(t('validation:required'))).length).toBeGreaterThan(10);
  expect(sent('POST car')).toEqual([]);

  const fields: [string, string][] = [
    [ 'car:manufacturer', ' Renault ' ], [ 'car:model_name', 'Clio' ], [ 'car:model_year', '2024' ], [ 'car:licence_plate', '215 TU 4521' ],
    [ 'car:serial_number', 'VF1RJA00012345678' ], [ 'contract:daily_price', '87,5' ], [ 'car:fiscal_horse_power', '5' ],
    [ 'car:number_of_cylinders', '4' ], [ 'car:mileage', '24500' ], [ 'car:first_circulation_date', '2024-03-15' ],
    [ 'car:insurance', '2027-01-31' ], [ 'car:circulation_tax', '2027-04-05' ], [ 'car:technical_control', '2028-03-15' ],
  ];
  for (const [ label, value ] of fields) {
    await type(t(label), value);
  }
  for (const choice of [ 'car:type:1', 'car:transmission_type:2', 'car:fuel_type:2' ]) {
    fireEvent.click(screen.getByText(t(choice)));
  }
  fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [ photo ] } });
  await click(t('common:save'));

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/cars/7'));
  expect(sent('POST car')[0].data).toEqual({
    manufacturer: 'Renault', model_name: 'Clio', model_year: 2024, licence_plate: '215 TU 4521', serial_number: 'VF1RJA00012345678',
    colour: null, daily_price: 87500, status: 1, type: 1, transmission_type: 2, fuel_type: 2, fiscal_horse_power: 5, number_of_cylinders: 4,
    mileage: 24500, oil_change_every_km: 10000, oil_change_every_months: 12, first_circulation_date: '15/03/2024',
    insurance_ends_at: new Date(2027, 0, 31).getTime() / 1000, circulation_tax_ends_at: new Date(2027, 3, 5).getTime() / 1000,
    technical_control_ends_at: new Date(2028, 2, 15).getTime() / 1000, branch_id: null,
  });
  expect((sent('POST car/7/photo')[0].data as FormData).get('photo')).toBeInstanceOf(File);
});

test('editing a car: its values in the form; a plate already used is shown on the field', async () => {
  signIn(owner);
  serve({ ...common, 'GET branch': [ { id: 3, name: 'Airport', address: null, monthly_rent: 0 } ], 'GET car/1': clio, 'PUT car/1': invalid({ licence_plate: [ 'validation.unique: taken' ] }) });
  renderPage(EditCarPage, '/cars/[id]/edit', '/cars/1/edit');
  const price = await screen.findByDisplayValue('90');
  expect(screen.getByDisplayValue(clio.licence_plate)).toBeTruthy();
  expect(screen.getByDisplayValue('2024-03-15')).toBeTruthy();
  fireEvent.change(price, { target: { value: '95' } });
  fireEvent.click(screen.getByText('Airport'));
  await click(t('common:save'));
  expect(await screen.findByText(t('validation:taken'))).toBeTruthy();
  expect(sent('PUT car/1')[0].data).toMatchObject({ daily_price: 95000, branch_id: 3, first_circulation_date: '15/03/2024' });

  serve({ 'PUT car/1': { ...clio, daily_price: 95000 } });
  await click(t('common:save'));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/cars/1'));
});

test('a car page for the owner: papers, money and rentals', async () => {
  signIn(owner);
  const withAll = {
    ...clio, money: carMoney, purchase_price: 52000000, insurance_ends_at: now - 3600,
    documents: [ { id: 9, type: 2, url: 'https://files.example/insurance.jpg', created_at: at(-10) } ],
    contracts: [ contract({ id: 12, status: 4, client: leila, starts_at: at(-20), ends_at: at(-17) }) ],
    expenses: [ { id: 4, category: 1, amount: 150000, spent_at: at(-30), mileage: 20000, garage: 'Garage Sahel', note: null, method: 1 as const, car_id: 1 } ],
  };
  serve({ ...common, 'GET car/1': withAll });
  renderPage(CarPage, '/cars/[id]', '/cars/1');

  expect(await screen.findByText('Renault Clio')).toBeTruthy(); // the heading
  expect(screen.getByText(money(52000000))).toBeTruthy(); // purchase price
  expect(screen.getByText('8 %')).toBeTruthy(); // paid back so far
  expect(screen.getByText(t('document:until', { date: formatDate(now - 3600) }))).toBeTruthy();
  expect(screen.getByAltText(t('document:type:2'))).toBeTruthy();
  expect(screen.getByText('Leila Ben Salah').closest('a')!.getAttribute('href')).toBe('/contracts/12');
  expect(screen.getByText(formatDate(at(-30)) + ' · 20000 km · Garage Sahel')).toBeTruthy(); // the oil change
  expect(screen.getByText(t('common:edit')).closest('a')!.getAttribute('href')).toBe('/cars/1/edit');
  fireEvent.click(screen.getByText(t('car:purchase')));
  expect(router.push).toHaveBeenCalledWith('/cars/1/purchase');
  expect(unhandled).toEqual([]);
});

test('a car added with a past: its figures say where they start, the unknown oil change and the missing inspection show', async () => {
  signIn(owner);
  const added = at(-30);
  serve({ ...common, 'GET car/1': {
    ...clio, created_at: added, money: { ...carMoney, history_since: added, payback: null },
    oil_change: { last_at: null, last_mileage: null, due_mileage: 10000, due_at: at(-400), is_due: true },
    contracts: [], damages: [],
  } });
  renderPage(CarPage, '/cars/[id]', '/cars/1');

  expect(await screen.findByText(t('car:money:history_since', { date: formatDate(added) }))).toBeTruthy();
  expect(screen.queryByText(t('car:money:payback:percent'))).toBeNull();
  expect(screen.getByText(t('car:oil_change:unknown'))).toBeTruthy();
  expect(screen.getByText(t('damage:no_inspection'))).toBeTruthy();
  expect(unhandled).toEqual([]);
});

test('a manager\'s car page has no money and no edit', async () => {
  signIn(manager);
  serve({ ...common, 'GET car/1': { ...clio, money: carMoney } });
  renderPage(CarPage, '/cars/[id]', '/cars/1');
  expect(await screen.findByText(t('expense:add'))).toBeTruthy();
  for (const key of [ 'common:edit', 'car:purchase', 'income:add', 'car:sell', 'car:money:cost' ]) {
    expect(screen.queryByText(t(key))).toBeNull();
  }
});

test('a cost on a car: an oil change with its odometer', async () => {
  signIn(owner);
  serve({ ...common, 'GET car/1': clio, 'POST expense': {} });
  renderPage(CarPage, '/cars/[id]', '/cars/1');
  await click(t('expense:add'));
  const form = within(await dialog());
  fireEvent.click(form.getByText(t('common:save')));
  expect(await screen.findByText(t('expense:invalid'))).toBeTruthy();

  fireEvent.change(form.getByLabelText(t('payment:amount')), { target: { value: '120' } });
  fireEvent.change(form.getByLabelText(t('handover:mileage')), { target: { value: '25000' } });
  fireEvent.change(form.getByLabelText(t('expense:garage')), { target: { value: 'Garage Sahel' } });
  fireEvent.click(form.getByText(t('common:save')));
  await waitFor(() => expect(sent('POST expense')).toHaveLength(1));
  expect(sent('POST expense')[0].data).toMatchObject({
    car_id: 1, contract_id: null, branch_id: null, employee_id: null, category: 1, amount: 120000, mileage: 25000, garage: 'Garage Sahel', note: null, method: 1,
  });
});

test('selling a car: checked, confirmed, then sent', async () => {
  signIn(owner);
  serve({ ...common, 'GET car/1': clio, 'POST car/1/sale': { ...clio, sold_at: now } });
  renderPage(CarPage, '/cars/[id]', '/cars/1');
  await click(t('car:sell'));
  const form = within(await dialog());
  fireEvent.change(form.getByLabelText(t('car:sale:price:dinars')), { target: { value: '38000' } });
  fireEvent.click(form.getAllByText(t('car:sell')).at(-1)!);
  expect(await screen.findByText(t('car:sale:invalid'))).toBeTruthy(); // no buyer

  fireEvent.change(form.getByLabelText(t('car:sale:buyer')), { target: { value: 'Mourad' } });
  fireEvent.click(form.getAllByText(t('car:sell')).at(-1)!);
  fireEvent.click(await screen.findByText(t('common:confirm')));
  await waitFor(() => expect(sent('POST car/1/sale')).toHaveLength(1));
  expect(sent('POST car/1/sale')[0].data).toMatchObject({ sale_price: 38000000, buyer_name: 'Mourad', buyer_phone: null, sale_method: 3 });
});

test('a sold car: its result, and the sale can be undone', async () => {
  signIn(owner);
  serve({ ...common, 'GET car/1': { ...clio, sold_at: at(-5), sale_price: 38000000, money: carMoney }, 'DELETE car/1/sale': clio });
  renderPage(CarPage, '/cars/[id]', '/cars/1');
  expect(await screen.findByText(t('car:sold:on', { date: formatDate(at(-5)) }))).toBeTruthy();
  expect(screen.getByText(money(carMoney.result))).toBeTruthy();
  expect(screen.queryByText(t('common:edit'))).toBeNull();
  await click(t('car:sale:undo'));
  fireEvent.click(await screen.findByText(t('common:confirm')));
  await waitFor(() => expect(sent('DELETE car/1/sale')).toHaveLength(1));
});

test('other income on a car', async () => {
  signIn(owner);
  serve({ ...common, 'GET car/1': clio, 'POST income': {} });
  renderPage(CarPage, '/cars/[id]', '/cars/1');
  await click(t('income:add'));
  const form = within(await dialog());
  fireEvent.change(form.getByLabelText(t('payment:amount')), { target: { value: '1500' } });
  fireEvent.change(form.getByLabelText(t('contract:note')), { target: { value: 'STAR, rear bumper' } });
  fireEvent.click(form.getByText(t('common:save')));
  await waitFor(() => expect(sent('POST income')).toHaveLength(1));
  expect(sent('POST income')[0].data).toMatchObject({ car_id: 1, category: 1, amount: 1500000, method: 1, note: 'STAR, rear bumper' });
});

test('a paper\'s photo: added, opened, deleted', async () => {
  signIn(owner);
  serve({
    ...common, 'GET car/1': { ...clio, documents: [ { id: 9, type: 2, url: 'https://files.example/insurance.jpg', created_at: at(-10) } ] },
    'POST car/1/document': {}, 'DELETE document/9': {},
  });
  renderPage(CarPage, '/cars/[id]', '/cars/1');
  const insurance = await screen.findByLabelText(t('document:type:2'));
  fireEvent.change(insurance.querySelector('input')!, { target: { files: [ photo ] } });
  await waitFor(() => expect(sent('POST car/1/document')).toHaveLength(1));
  const sentForm = sent('POST car/1/document')[0].data as FormData;
  expect(sentForm.get('type')).toBe('2');
  expect(sentForm.get('photo')).toBeInstanceOf(File);

  fireEvent.click(screen.getByAltText(t('document:type:2')));
  fireEvent.click(within(await dialog()).getByText(t('document:delete')));
  await confirmDialog();
  await waitFor(() => expect(sent('DELETE document/9')).toHaveLength(1));
});

test('sold cars, with what each fetched', async () => {
  signIn(owner);
  serve({ ...common, 'GET car': [ { ...clio, sold_at: at(-40), sale_price: 38000000 } ] });
  renderPage(SoldCarsPage, '/cars/sold');
  expect(await screen.findByText(money(38000000))).toBeTruthy();
  expect(screen.getByText(clio.licence_plate).closest('a')!.getAttribute('href')).toBe('/cars/1');
  expect(sent('GET car')[0].params).toEqual({ sold: 1, perPage: 100 });
});

test('the purchase: price, fees, a credit, and the expected sale price', async () => {
  signIn(owner);
  serve({ ...common, 'GET car/1': { ...clio, purchase_price: 52000000, supplier: 'Artes' }, 'PUT car/1/purchase': clio });
  renderPage(CarPurchasePage, '/cars/[id]/purchase', '/cars/1/purchase');
  expect(await screen.findByDisplayValue('52000')).toBeTruthy();
  expect(screen.getByDisplayValue('Artes')).toBeTruthy();

  await type(t('car:financing:instalment:dinars'), '1200');
  await click(t('common:save'));
  expect(await screen.findByText(t('car:purchase:invalid'))).toBeTruthy(); // months missing

  await type(t('car:financing:months'), '36');
  await type(t('car:advance'), '10000');
  await type(t('car:lender'), 'BIAT');
  await type(t('car:financing:paid_before'), '20'); // bought before the app, on paper
  await type(t('car:earned_before:dinars'), '15000');
  await type(t('car:expected_sale_price:dinars'), '38000');
  await click(t('common:save'));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/cars/1'));
  expect(sent('PUT car/1/purchase')[0].data).toEqual({
    purchase_price: 52000000, purchase_fees: 0, advance: 10000000, instalment_amount: 1200000, instalment_months: 36, instalments_paid_before: 20,
    expected_sale_price: 38000000, earned_before: 15000000, supplier: 'Artes', lender: 'BIAT', bought_at: null, first_instalment_at: null,
  });
});

test('the damage history: a repaired one, and one marked repaired with its cost', async () => {
  signIn(manager);
  const damage = (id: number, fields: object) => ({ id, stage: 2 as const, x: 100, y: 100, amount: null, contract_id: 12, created_at: at(-10), note: '', repaired_at: null, ...fields });
  serve({
    ...common,
    'GET car/1': { ...clio, contracts: [ contract({ id: 12, status: 4, client: leila }) ], damages: [ damage(5, { note: 'Broken mirror' }), damage(4, { note: 'Scratch', stage: 1, repaired_at: at(-5) }) ] },
    'POST car/1/damage/5/repair': damage(5, { repaired_at: now }),
  });
  renderPage(CarPage, '/cars/[id]', '/cars/1');
  expect(await screen.findByText(t('damage:repaired:on', { date: formatDate(at(-5)) }))).toBeTruthy();
  expect(screen.getByText(t('inspection:damages:return') + ' · Leila Ben Salah · ' + formatDate(at(-10)))).toBeTruthy();

  fireEvent.click(screen.getByText('Broken mirror'));
  await type(t('damage:repair:cost'), '85');
  await type(t('expense:garage'), 'Garage Sahel');
  await click(t('damage:repair'));
  await waitFor(() => expect(sent('POST car/1/damage/5/repair')).toHaveLength(1));
  expect(sent('POST car/1/damage/5/repair')[0].data).toMatchObject({ amount: 85000, garage: 'Garage Sahel' });
  expect(unhandled).toEqual([]);
});

test('damage already on a car: marked on its outline outside a handover', async () => {
  signIn(manager);
  const onCar = { id: 7, stage: null, x: 820, y: 900, amount: null, contract_id: null, created_at: at(-10), note: 'Rear bumper scratch', repaired_at: null };
  serve({ ...common, 'GET car/1': { ...clio, damages: [ onCar ] }, 'POST car/1/damage': [] });
  renderPage(CarPage, '/cars/[id]', '/cars/1');
  expect(await screen.findByText(t('damage:on_car') + ' · ' + formatDate(at(-10)))).toBeTruthy();

  await click(t('damage:mark'));
  await click(t('common:save'));
  expect(await screen.findByText(t('damage:mark:none'))).toBeTruthy();
  fireEvent.keyDown(await screen.findByLabelText(t('inspection:damages:keys')), { key: 'Enter' }); // the middle
  fireEvent.change(screen.getByLabelText('1. ' + t('contract:note')), { target: { value: 'Dent, driver door' } });
  await click(t('common:save'));
  await waitFor(() => expect(sent('POST car/1/damage')).toHaveLength(1));
  expect(sent('POST car/1/damage')[0].data).toEqual({ damages: [ { x: 500, y: 500, note: 'Dent, driver door' } ] });
  expect(unhandled).toEqual([]);
});

test('a rental from the notebook: entered in one go on the car, then opened', async () => {
  signIn(manager);
  serve({ ...common, 'GET car/1': clio, 'GET client': [ leila ], 'POST contract/past': contract({ id: 30, status: 4 }) });
  renderPage(CarPage, '/cars/[id]', '/cars/1');

  await click(t('contract:past:add'));
  await click(t('contract:past:save'));
  expect(await screen.findByText(t('client:required'))).toBeTruthy();
  fireEvent.click(screen.getByText(t('client:choose')));
  fireEvent.click(await screen.findByText('Leila Ben Salah'));
  await type(t('contract:past:paid'), '100');
  await click(t('contract:past:save'));

  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/contracts/30'));
  const data = sent('POST contract/past')[0].data;
  expect(data).toMatchObject({ car_id: 1, client_id: leila.id, daily_price: clio.daily_price, paid: 100000, method: 1, pickup_mileage: null, return_mileage: null, note: null });
  expect(data.ends_at - data.starts_at).toBe(3 * 24 * 3600);
  expect(unhandled).toEqual([]);
});
