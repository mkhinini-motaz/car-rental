// What the API answers, typed by the app's own interfaces so a changed field fails `npm run typecheck`.
// Dates are relative to today, like the API's seed data.
import Agency from '../../src/classes/Agency';
import Car, { CarMoney } from '../../src/classes/Car';
import Client from '../../src/classes/Client';
import Contract from '../../src/classes/Contract';
import Employee from '../../src/classes/Employee';
import User from '../../src/classes/User';
import { Dashboard, Pricing } from '../../src/api/agency';
import { todayBounds } from '../../src/support/day';

export const DAY = 24 * 60 * 60;
export const now = Math.floor(Date.now() / 1000);
// `hour` o'clock, `days` from today.
export const at = (days: number, hour = 10) => todayBounds()[0] + days * DAY + hour * 3600;

export const owner: User = {
  id: 1, first_name: 'Sami', last_name: 'Mansour', phone: '+21623456109', role: 1, branch_id: null, invited: false, created_at: at(-400), updated_at: at(-400),
};
export const manager: User = { ...owner, id: 2, first_name: 'Hela', last_name: 'Gharbi', phone: '+21650111222', role: 2 };

export const agency: Agency = {
  id: 1, name: "M'saken Rent", phone: '+21673000111', address: 'Avenue Habib Bourguiba, M\'saken', logo_url: null,
  takes_deposit: true, default_deposit: 300000, default_deposit_method: 1, tax_id: '1234567A', contract_terms: null,
  pickup_time: '10:00', return_time: '10:00', expiry_warning_days: 7, oil_warning_km: 1000, oil_warning_days: 14,
  fleet_max_years: 3, employer_charges_rate: 0, min_driver_age: 21, min_licence_years: 2, vat_rate: 1900, fiscal_stamp: 1000,
  theme: null, theme_mode: 1,
};

export const car = (fields: Partial<Car> = {}): Car => ({
  id: 1, daily_price: 90000, licence_plate: '215 TU 4521', serial_number: 'VF1RJA00012345678', manufacturer: 'Renault', model_name: 'Clio',
  model_year: 2024, fiscal_horse_power: 5, number_of_cylinders: 4, transmission_type: 1, fuel_type: 2, type: 1,
  first_circulation_date: '15/03/2024', circulation_tax_ends_at: at(200), insurance_ends_at: at(120), technical_control_ends_at: at(300),
  colour: '#f5f5f5', status: 1, mileage: 24500, photo_url: null, oil_change_every_km: 10000, oil_change_every_months: 12,
  branch_id: null, sold_at: null, oil_change: null, contracts: [], blocks: [], created_at: at(-500), updated_at: at(-5),
  ...fields,
});

export const clio = car();
export const polo = car({ id: 2, licence_plate: '221 TU 873', manufacturer: 'Volkswagen', model_name: 'Polo', model_year: 2023, daily_price: 110000, colour: '#1f1f1f' });
export const i10 = car({ id: 3, licence_plate: '198 TU 6040', manufacturer: 'Hyundai', model_name: 'i10', model_year: 2022, daily_price: 70000, status: 2 });

export const client = (fields: Partial<Client> = {}): Client => ({
  id: 1, first_name: 'Ahmed', last_name: 'Trabelsi', phone: '+21622123456', gender: 1, birth_date: '04/07/1990', id_number: '09876543',
  driver_licence_number: '12/345678', driver_licence_delivery_date: '10/10/2012', driver_licence_expiry_date: '10/10/2032',
  flag: null, notes: null, rentals_before: 0, agency_id: 1, created_at: at(-90), updated_at: at(-90),
  ...fields,
});

export const ahmed = client();
export const leila = client({ id: 2, first_name: 'Leila', last_name: 'Ben Salah', phone: '+21655667700', gender: 2 });

export const contract = (fields: Partial<Contract> = {}): Contract => ({
  id: 1, status: 1, daily_price: 90000, extras: [], rent_price: 270000, extras_price: 0, charges: [], charges_price: 0, total_price: 270000, paid: 0,
  starts_at: at(0), ends_at: at(3), client_id: ahmed.id, car_id: clio.id, note: null, source: null, broker: null, commission: 0,
  signature: null, signed_at: null, invoice_number: null, picked_up_at: null, pickup_mileage: null, returned_at: null, return_mileage: null,
  deposit: 0, deposit_method: null, deposit_kept: 0, deposit_kept_reason: null, deposit_returned: null, closed_at: null,
  pickup_location: null, return_location: null, second_driver_id: null, pickup_user_id: null, return_user_id: null, cleaned_at: null, car: clio, client: ahmed,
  ...fields,
});

// Ahmed takes the Clio this morning; Leila brings the Polo back this evening, 100 TND still to pay.
export const reserved = contract();
export const out = contract({
  id: 2, status: 2, car_id: polo.id, car: polo, client_id: leila.id, client: leila, daily_price: 110000, rent_price: 330000, total_price: 330000, paid: 230000,
  starts_at: at(-3), ends_at: at(0, 18), picked_up_at: at(-3), pickup_mileage: 40210, deposit: 300000, deposit_method: 1,
});

export const money: CarMoney = {
  history_since: null, earned: 4200000, earned_before: 0, other_income: 0, purchase_price: 52000000, purchase_fees: 800000, interest: 0,
  costs: { insurance: 900000, technical_visit: 0, tax: 250000, maintenance: 400000, other: 0, fines: 0, commissions: 0 },
  running_total: 1550000, total_cost: 54350000, payback: 0.08, monthly_earned: 1400000, result: -50150000, financing: null,
  fleet_deadline: at(400), months_left: 13, cost_per_km: 120, this_month: { days_rented: 18, rate: 0.6, idle_days: 12, maintenance_days: 0 },
};

export const dashboard = (fields: Partial<Dashboard> = {}): Dashboard => ({
  pickups: [ reserved ], returns: [ out ], cars_available: 1, cars_total: 3, cars_out: 1, overdue: 0,
  expiring_cars: [], maintenance_due: [], to_clean: [],
  ...fields,
});

export const employee = (fields: Partial<Employee> = {}): Employee => ({
  id: 1, first_name: 'Karim', last_name: 'Jaziri', phone: '+21698111222', role_label: 'Washer', monthly_salary: 900000, hired_at: at(-300),
  active: true, user_id: null, paid_this_month: 0, due_this_month: 900000,
  ...fields,
});

export const pricing: Pricing = {
  seasons: [], discounts: [], extras: [ { name: 'Baby seat', price: 10000, per: 'day' } ], second_driver_price: 0,
  locations: [ { name: 'Enfidha airport', fee: 40000 } ], charge_extra_km: false, km_per_day: 300, extra_km_price: 0,
  late_grace_hours: 2, late_per: 'day', late_hour_price: 0, washing_price: 20000,
};

// Everything a signed-in page asks for on every render: the agency (sidebar, defaults).
export const common = { 'GET agency': agency };
