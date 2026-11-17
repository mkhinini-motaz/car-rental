import Contract, { STATUS_OUT } from "./Contract";
import { Tone } from "../constants";
import { formatDate } from "../support/utils";
import Expense from "./Expense";
import Income from "./Income";
import CarBlock from "./CarBlock";
import DocumentPhoto from "./Document";
import { ContractDamage } from "./Inspection";

export default interface Car {
  id: number,
  daily_price: number,
  licence_plate: string,
  serial_number: string,
  manufacturer: string,
  model_name: string,
  model_year: number,
  fiscal_horse_power: number,
  number_of_cylinders: number,
  transmission_type: 1|2,
  fuel_type: 1|2,
  type: 1|2,
  first_circulation_date: string,
  circulation_tax_ends_at: number,
  insurance_ends_at: number,
  technical_control_ends_at: number,
  colour: string|null, // a swatch (#rrggbb) or the name of a colour the palette doesn't have
  status: 1|2|3|4,
  mileage: number|null, // last odometer reading, km
  photo_url: string|null,
  oil_change_every_km: number,
  oil_change_every_months: number,
  branch_id: number|null, // its home branch
  sold_at: number|null, // sold: out of the fleet, history kept
  // The owner only (absent for managers): what it cost, its credit, its sale.
  purchase_price?: number|null, // millimes
  bought_at?: number|null,
  purchase_fees?: number,
  supplier?: string|null,
  advance?: number|null,
  instalment_amount?: number|null,
  instalment_months?: number|null,
  first_instalment_at?: number|null,
  instalments_paid_before?: number, // on paper, before the car came into the app
  earned_before?: number|null, // millimes: what it brought in before the app, after its running costs
  lender?: string|null,
  expected_sale_price?: number|null,
  sale_price?: number|null,
  buyer_name?: string|null,
  buyer_phone?: string|null,
  sale_method?: number|null,
  money?: CarMoney, // the car's page, owner only
  incomes?: Income[],
  // On the car's page only (millimes): earned from rentals that happened, spent, and the difference.
  revenue?: number,
  expenses_total?: number,
  profit?: number,
  oil_change?: OilChange|null, // null when the first registration isn't known either
  expenses?: Expense[],
  documents?: DocumentPhoto[], // the papers (the car's page)
  damages?: ContractDamage[], // the car's page: every damage marked at its handovers, newest first
  contracts?: Contract[], // the fleet list: the rental out now, if any
  blocks?: CarBlock[], // the planning, and the fleet list: a block covering now
  availability_in_period?: [number, number][]
  overdue_since?: number|null, // in the search: the end date of a rental not back yet
  created_at: number,
  updated_at: number,
}

export const TRANSMISSION_TYPE_MANUAL = 1;
export const TRANSMISSION_TYPE_AUTO = 2;

export const FUEL_TYPE_GAS = 1;
export const FUEL_TYPE_PETROL = 2;

export const TYPE_COMPACT = 1;
export const TYPE_SEDAN = 2;

export interface OilChange {
  last_at: number|null, // null: none recorded, due counted from the first registration (unknown for a car with a past)
  last_mileage: number|null,
  due_mileage: number|null,
  due_at: number,
  is_due: boolean,
}

// Only available cars are offered when booking. Sold is set by the sale, not the car form.
export const STATUS_AVAILABLE = 1;
export const STATUS_MAINTENANCE = 2;
export const STATUS_OUT_OF_SERVICE = 3;
export const STATUS_SOLD = 4;

export interface Financing {
  paid: number, // instalments paid (one expense each, plus those paid before the app)
  months: number,
  amount: number, // per instalment
  remaining: number,
  next_due_at: number|null,
  ends_at: number,
  lender: string|null,
}

// What the car cost, earned and returned over its life (API: App\Support\CarMoney), millimes.
export interface CarMoney {
  history_since: number|null, // the car was added with a past: the figures only count from then
  earned: number, // earned_before included
  earned_before: number,
  other_income: number,
  purchase_price: number|null,
  purchase_fees: number,
  interest: number, // advance + instalments − price
  costs: { insurance: number, technical_visit: number, tax: number, maintenance: number, other: number, fines: number, commissions: number },
  running_total: number,
  total_cost: number,
  payback: number|null, // earned / total cost; null until the price is known, or with history_since
  monthly_earned: number,
  result: number, // earned + other income + sale price − total cost
  financing: Financing|null,
  fleet_deadline: number|null, // first registration + the agency's years
  months_left: number|null,
  cost_per_km: number|null,
  this_month: { days_rented: number, rate: number, idle_days: number, maintenance_days: number },
}


// Where the car is now, for the badge on the fleet list: from its status, the rental out and
// a block covering now (both loaded with the list).
export function carState(car: Car, now: number, todayEnd: number): { label: string, params?: object, tone: Tone } {
  const out = car.contracts?.find(contract => contract.status === STATUS_OUT);
  if (out) {
    return out.ends_at < now ? { label: 'car:state:overdue', tone: 'danger' } :
      out.ends_at < todayEnd ? { label: 'car:state:back_today', tone: 'info' } :
      { label: 'car:state:out', params: { date: formatDate(out.ends_at) }, tone: 'info' };
  }
  if (car.status !== STATUS_AVAILABLE) {
    return { label: 'car:status:' + car.status, tone: car.status === STATUS_MAINTENANCE ? 'warn' : 'danger' };
  }
  if (car.blocks?.length) {
    return { label: 'car:state:blocked', tone: 'warn' };
  }
  return { label: 'car:status:' + STATUS_AVAILABLE, tone: 'ok' };
}
