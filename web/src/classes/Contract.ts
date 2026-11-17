import Car from "./Car";
import Client from "./Client";
import Payment from "./Payment";
import { ContractDamage, ContractPhoto } from "./Inspection";
import Fine from "./Fine";
import Activity from "./Activity";

// Sold with the rental, priced once or per day; copied from the agency's list when added.
// `kind` marks the ones the app adds itself for the second driver and the delivery places.
export interface Extra {
  name: string,
  price: number, // millimes
  per: 'rental'|'day',
  kind?: 'driver'|'pickup'|'return'|null,
}

// Charged at return: kilometres over the allowance, lateness (hours or days), priced damage, the wash
// of a car brought back dirty.
export interface Charge {
  type: 'km'|'late'|'damage'|'washing',
  unit?: 'hour'|'day', // late only
  quantity: number,
  amount: number, // millimes
}

export default interface Contract {
  id: number,
  status: 1|2|3|4|5,
  daily_price: number,
  extras: Extra[],
  rent_price: number, // millimes
  extras_price: number,
  charges: Charge[],
  charges_price: number,
  total_price: number, // rent, extras and return charges, millimes
  paid?: number, // rent paid so far, millimes (lists and the contract page)
  starts_at: number,
  ends_at: number,
  client_id: number,
  car_id: number,
  note: string|null,
  source: number|null, // SOURCES: where the booking came from; null when not said
  broker: string|null, // the hotel, travel agency or courtier who brought it
  commission: number, // millimes, the broker's cut: a cost of the rental
  signature: string|null, // the client's, an SVG path in a 600 × 200 box
  signed_at: number|null,
  invoice_number: string|null, // given with the first invoice: 2026-0001
  picked_up_at: number|null,
  pickup_mileage: number|null,
  returned_at: number|null,
  return_mileage: number|null,
  deposit: number, // security deposit taken at pickup, millimes
  deposit_method: 1|2|3|4|null,
  deposit_kept: number, // kept at close, millimes
  deposit_kept_reason: string|null,
  deposit_available?: number, // still held: less fines and payments taken from it (the contract page)
  deposit_returned: number|null, // at close
  closed_at: number|null,
  pickup_location: string|null, // null: at the agency
  return_location: string|null,
  second_driver_id: number|null,
  pickup_user_id: number|null, // the staff member handing the car over
  return_user_id: number|null, // and the one taking it back, then cleaning it
  cleaned_at: number|null, // after the return; null: still to clean
  car?: Car,
  client?: Client,
  second_driver?: Client,
  activities?: Activity[], // newest first (the contract page)
  payments?: Payment[],
  photos?: ContractPhoto[],
  damages?: ContractDamage[],
  car_damages?: ContractDamage[], // reserved or out (the contract page): the car's damages from earlier rentals, not repaired
  fines?: Fine[],
  fines_from_deposit?: number, // fines paid out of the deposit, millimes
}

// reserved → out (car handed over) → returned → closed (settled); or cancelled.
export const STATUS_RESERVED = 1;
export const STATUS_OUT = 2;
export const STATUS_RETURNED = 3;
export const STATUS_CLOSED = 4;
export const STATUS_CANCELLED = 5;

// Where the booking came from (walk-in, phone, WhatsApp, Facebook/Instagram, website, broker).
export const SOURCE_BROKER = 6;
export const SOURCES = [ 1, 2, 3, 4, 5, SOURCE_BROKER ];

export const remainingRent = (contract: Contract) => contract.total_price - (contract.paid ?? 0);

export const extrasPrice = (extras: Extra[], days: number) =>
  Math.round(extras.reduce((sum, extra) => sum + (extra.per === 'day' ? extra.price * days : extra.price), 0));

// Replaces the extra the app added for `kind` (second driver, delivery or collection) with
// `extra`, or just removes it. Staff-picked extras stay.
export const withAutoExtra = (extras: Extra[], kind: NonNullable<Extra['kind']>, extra: Omit<Extra, 'kind'>|null): Extra[] =>
  [ ...extras.filter(item => item.kind !== kind), ...(extra ? [ { ...extra, kind } ] : []) ];
