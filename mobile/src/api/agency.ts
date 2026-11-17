import { useQuery } from '@tanstack/react-query';
import client, { multipartConfig, toFormData } from './client';
import Agency from '../classes/Agency';
import { RecurringBill } from '../classes/Branch';
import Car, { Financing } from '../classes/Car';
import { Badge } from '../classes/Client';
import Employee from '../classes/Employee';
import Contract, { Extra } from '../classes/Contract';
import { PhotoFile } from '../support/photo';
import { QueryContext } from './query';

export function show(): Promise<Agency> {
  return client.get('agency').then(response => response.data.data);
}

export function update(data: Partial<Omit<Agency, 'id' | 'logo_url'>>): Promise<Agency> {
  return client.put('agency', data).then(response => response.data.data);
}

// The user's agency and its settings, shared by every screen that needs them.
export function useAgency() {
  return useQuery({ queryKey: ['agency.show'], queryFn: show });
}

export function uploadLogo(logo: PhotoFile): Promise<Agency> {
  return client.post('agency/logo', toFormData({ logo }), multipartConfig).then(response => response.data.data);
}

// The agency's movements over a range (a day or a week): going out and coming back, handled
// or not; with today in the range, late pickups and overdue returns too.
export interface Dashboard {
  pickups: Contract[], // booked to start in the range (reserved), or handed over in it
  returns: Contract[], // due back in the range (out), or returned in it
  to_clean: Contract[], // right now: back from their last rental, not ticked cleaned (with `car`)
  cars_available: number,
  cars_total: number,
  cars_out: number, // right now
  overdue: number, // right now
  expiring_cars: Car[], // papers expiring within the agency's warning days, or expired
  maintenance_due: Car[], // oil change due, with `oil_change`
  // The owner only: money to pay soon, one tap away (nothing is paid by itself).
  instalments_due?: ({ car: Car } & Financing)[], // within a week
  bills_due?: RecurringBill[], // within a week
  salaries_due?: { employee: Employee, due: number }[], // from the 25th
  fleet_deadlines?: { car: Car, deadline: number }[], // within six months of leaving the fleet
}

export interface Pricing {
  seasons: { name: string, from: string, to: string, percent: number }[], // from/to 'dd/mm', every year
  discounts: { min_days: number, percent: number }[],
  extras: Extra[],
  second_driver_price: number, // per day, millimes; 0 (default) = free
  locations: { name: string, fee: number }[], // frequent delivery places, fee per trip; 0 = free
  charge_extra_km: boolean, // off by default: Tunisian agencies don't charge kilometres
  km_per_day: number, // allowance when on
  extra_km_price: number, // millimes per km over it
  late_grace_hours: number,
  late_per: 'none'|'hour'|'day', // day: the rental's daily price per started day
  late_hour_price: number,
  washing_price: number, // millimes, suggested when a car comes back dirty (20 TND by default)
}

export function pricing(): Promise<Pricing> {
  return client.get('agency/pricing').then(response => response.data.data);
}

export function updatePricing(data: Pricing): Promise<Pricing> {
  return client.put('agency/pricing', data).then(response => response.data.data);
}

type Named = { id: number, first_name: string, last_name: string|null };
type CarSummary = { id: number, licence_plate: string, manufacturer: string, model_name: string };
export interface FleetCar {
  car: CarSummary,
  total_cost: number,
  earned: number,
  payback: number|null, // null for a car added with a past (ranked last)
  history_since: number|null,
  fleet_deadline: number|null,
  months_left: number|null,
  expected_sale_price: number|null,
}

// The month's numbers (API: App\Support\MonthlyReport), millimes.
// net = revenue + other income − car costs − instalments − overhead − payroll − employer charges − commissions.
export interface Report {
  month: string, // 'YYYY-MM'
  since: number, // nothing is recorded before: the agency joined, or its oldest rental entered from the notebook
  revenue: number, // rent over the days rented in the month, extras, return charges
  other_income: number,
  car_costs: number, // running costs and fines borne, not instalments
  instalments: number,
  overhead: number,
  payroll: number,
  employer_charges: number,
  commissions: number, // brokers' cut on the rentals starting in the month
  expenses: number, // all of the costs above
  net: number,
  utilization_rate: number, // days rented / car-days in the fleet
  previous: { revenue: number|null, net: number|null, utilization_rate: number|null }, // last month, for the ± deltas; null before `since`
  kpis: { average_daily_rate: number, contracts_started: number, contracts_cancelled: number, average_days: number, late_returns: number, late_hours: number, overdue_now: number },
  payments_received: number,
  payments_by_method: { method: number, amount: number }[],
  expenses_by_category: { category: number, amount: number }[],
  overhead_by_branch: { branch: { id: number, name: string }|null, amount: number }[],
  overhead_per_car: number,
  payroll_by_employee: { employee: Named, amount: number }[],
  commissions_by_broker: { broker: string|null, contracts: number, amount: number }[], // owed for the month's rentals
  fines_paid_by_agency: number,
  months: { month: string, revenue: number|null, expenses: number|null }[], // the year ending with this month; null before `since`
  utilization: { car: Car, days_rented: number, rate: number, revenue: number, idle_days: number, maintenance_days: number, cost_per_km: number|null }[],
  // Right now, whatever the month.
  owed_rent: number,
  owed_contracts: { id: number, client: Named & { phone: string }, car: CarSummary, owed: number, days_late: number }[],
  owed_fines: number,
  unpaid_fines: { id: number, amount: number, committed_at: number, licence_plate: string, client: Named|null }[],
  deposits_held: number,
  upcoming: { count: number, revenue: number }, // the next 30 days
  clients: { client: Named & { phone: string, flag: number|null }, revenue: number, contracts: number, outstanding: number, badge: Badge }[],
  fleet: FleetCar[], // worst payback first
  sold_cars: (FleetCar & { sold_at: number, sale_price: number, result: number })[],
  renewal: FleetCar[], // by fleet deadline
  capital_next_12_months: number, // expected sale prices of cars leaving within a year
  export_url: string, // CSV, valid for an hour
}

// Owner only (403 for managers). queryKey: ['report', { year, month }]
export function report({ queryKey }: QueryContext): Promise<Report> {
  const [_key, params] = queryKey;

  return client.get('report', { params }).then(response => response.data.data);
}

// queryKey: ['dashboard', { starts_at, ends_at }], day bounds on this phone (at most 31 days).
export function dashboard({ queryKey }: QueryContext): Promise<Dashboard> {
  const [_key, params] = queryKey;

  return client.get('dashboard', { params }).then(response => response.data.data);
}
