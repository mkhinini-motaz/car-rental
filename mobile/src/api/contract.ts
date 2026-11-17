import { QueryClient } from '@tanstack/react-query';
import client, { multipartConfig, toFormData } from './client';
import Contract, { Charge, Extra } from '../classes/Contract';
import Payment from '../classes/Payment';
import { PhotoFile } from '../support/photo';
import { QueryContext } from './query';

// Every matching contract, across all pages: the calendar needs the whole period.
export async function index({ queryKey }: QueryContext): Promise<Contract[]> {
  const [_key, { search = undefined, starts_at = undefined, ends_at = undefined, status = undefined, orderBy = undefined } = {}] = queryKey;

  const contracts: Contract[] = [];
  for (let page = 1, lastPage = 1; page <= lastPage; page++) {
    const response = await client.get('contract', { params: { search, starts_at, ends_at, status, orderBy, page, perPage: 100 } });
    contracts.push(...response.data.data);
    lastPage = response.data.lastPage;
  }
  return contracts;
}

export function show({ queryKey }: QueryContext): Promise<Contract> {
  const [_key, { id }] = queryKey;

  return client.get('contract/' + id).then(response => response.data.data);
}

export interface ReservationInput {
  client_id: number,
  second_driver_id?: number|null,
  pickup_location?: string|null,
  return_location?: string|null,
  extras?: Extra[], // on each contract
  note?: string,
  source?: number|null,
  broker?: string|null,
  commission?: number, // millimes, on each contract
  contracts: { car_id: number, starts_at: number, ends_at: number, daily_price?: number }[],
}

// One contract per slot, saved all or nothing. A 422 with `contract:overlap` means a car was booked meanwhile.
export function store(data: ReservationInput): Promise<Contract[]> {
  return client.post('contract', data).then(response => response.data.data);
}

// A rental kept on paper before the app, entered in one go: handed over at its start, back at its end,
// no papers asked. Paid in full (paid null: the whole price) it is closed; otherwise returned with the rest owed.
// A 422 `contract:overlap`: the car had another rental then.
export interface PastRentalInput {
  car_id: number,
  client_id: number,
  starts_at: number,
  ends_at: number, // over already
  daily_price: number,
  paid: number|null,
  method: number,
  pickup_mileage: number|null,
  return_mileage: number|null,
  note: string|null,
}

export function storePast(data: PastRentalInput): Promise<Contract> {
  return client.post('contract/past', data).then(response => response.data.data);
}

export function update(id: number, data: Partial<Pick<Contract, 'starts_at' | 'ends_at' | 'daily_price' | 'client_id' | 'second_driver_id' | 'pickup_location' | 'return_location' | 'note' | 'extras' | 'source' | 'broker' | 'commission' | 'pickup_user_id' | 'return_user_id'>>): Promise<Contract> {
  return client.put('contract/' + id, data).then(response => response.data.data);
}

// Only a reservation can be cancelled.
export function cancel(id: number): Promise<void> {
  return client.delete('contract/' + id).then(() => {});
}

export interface HandoverInput {
  at?: number, // when it happened: a handover saved without network is sent later with its real time
  mileage: number,
  deposit?: number, // pickup only, millimes
  deposit_method?: number,
  photos: { angle: number, file: PhotoFile }[],
  damages: { x: number, y: number, note: string|null, amount?: number|null }[], // amount: return only
  waived?: ('km'|'late')[], // return only: charges staff don't apply
  charges_from_deposit?: 0|1, // return only: pay the charges out of the deposit held
  dirty?: 0|1, // return only: 0 back clean (nothing to wash), 1 dirty (to clean)
  washing?: number|null, // return only, when dirty: what the client pays for the wash, millimes
  signature?: string, // pickup only: the client's, an SVG path (support/signature.ts)
}

// What returning now with this odometer reading would add (extra km, lateness), before saving.
// `at`: a return entered after the fact (lateness counted to then), now otherwise.
export function charges(id: number, mileage: number, at?: number): Promise<{ charges: Charge[], deposit_available: number }> {
  return client.get('contract/' + id + '/charges', { params: { mileage, at } }).then(response => response.data.data);
}

// Hands the car over. A 422 `client:incomplete` (key `client` or `second_driver`) means an ID or licence is missing.
// Photos over a weak signal: give up after a minute, the handover then waits in support/handoverQueue.
const handoverConfig = { ...multipartConfig, timeout: 60 * 1000 };

export function pickup(id: number, data: HandoverInput): Promise<Contract> {
  return client.post('contract/' + id + '/pickup', toFormData(data), handoverConfig).then(response => response.data.data);
}

export function takeBack(id: number, data: HandoverInput): Promise<Contract> {
  return client.post('contract/' + id + '/return', toFormData(data), handoverConfig).then(response => response.data.data);
}

// A 422 `contract:unpaid` means rent is still owed.
export function close(id: number, data: { deposit_kept: number, deposit_kept_reason: string|null }): Promise<Contract> {
  return client.post('contract/' + id + '/close', data).then(response => response.data.data);
}

// Ticks the car cleaned after its return, or unticks it (returned or closed contracts).
export function markCleaned(id: number, cleaned: boolean): Promise<Contract> {
  return client.post('contract/' + id + '/cleaned', { cleaned }).then(response => response.data.data);
}

// A week-long link to the contract, its invoice (numbered on the first ask) or a payment's receipt
// as PDF, in French or Arabic: to open, print, or send to the client.
export function pdfLink(id: number, kind: 'contract'|'invoice'|'receipt', lang: 'fr'|'ar', paymentId?: number): Promise<string> {
  return client.post('contract/' + id + '/pdf', { kind, lang, payment_id: paymentId }).then(response => response.data.data.url);
}

// The client's pre-arrival check-in page (carweb /checkin), valid until the rental ends.
export function checkinLink(id: number): Promise<string> {
  return client.post('contract/' + id + '/checkin-link').then(response => response.data.data.url);
}

// The client's signature (support/signature.ts), when not taken at pickup.
export function sign(id: number, signature: string): Promise<void> {
  return client.post('contract/' + id + '/signature', { signature }).then(() => {});
}

// `paid_at`: a payment entered after the fact (a rental from the notebook), now otherwise.
export function storePayment(id: number, data: Pick<Payment, 'amount' | 'method'> & { paid_at?: number }): Promise<Payment> {
  return client.post('contract/' + id + '/payment', data).then(response => response.data.data);
}

export function destroyPayment(id: number, paymentId: number): Promise<void> {
  return client.delete('contract/' + id + '/payment/' + paymentId).then(() => {});
}

// Refreshes everything that shows contracts: the calendar, the dashboard, rented cars, cars'
// availability, car and client pages.
export function invalidateContractQueries(queryClient: QueryClient) {
  for (const key of [ 'contract.index', 'contract.show', 'car.index', 'car.index.search', 'car.show', 'client.show', 'dashboard', 'report', 'fine.index', 'fine.show', 'planning', 'cashbook' ]) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}
