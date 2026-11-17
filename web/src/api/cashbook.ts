import client from './client';
import { QueryContext } from './query';

export interface CashLine {
  kind: 'payment'|'deposit_taken'|'deposit_returned'|'expense'|'fine'|'fine_payout'|'income'|'car_sale'|'salary'|'movement',
  at: number,
  amount: number, // millimes, negative when cash went out
  label: string|null, // the client's name, the note, or the fine's plate
  contract_id?: number,
  category?: number, // expense, income
  car_id?: number|null, // expense, income: tapping opens the car
  id?: number, type?: number, // movement; fine, income, car sale: id; salary: the employee's id and the payment type
  user: { id: number, first_name: string, last_name: string }|null,
}

export interface CashBook {
  date: string, // YYYY-MM-DD
  since: number, // the day the agency joined: the till is counted from then
  opening: number|null, // null when filtered by staff
  closing: number|null,
  cash_in: number,
  cash_out: number,
  payments_by_method: { method: number, amount: number }[], // every payment of the day, cash or not
  lines: CashLine[],
}

// Put in the till, taken by the owner, taken to the bank.
export const MOVEMENT_ADDED = 1;
export const MOVEMENT_WITHDRAWAL = 2;
export const MOVEMENT_BANK_DEPOSIT = 3;
export const MOVEMENT_TYPES = [ MOVEMENT_ADDED, MOVEMENT_WITHDRAWAL, MOVEMENT_BANK_DEPOSIT ];

// Owner only. queryKey: ['cashbook', { date, user_id }]
export function show({ queryKey }: QueryContext): Promise<CashBook> {
  const [_key, params] = queryKey;

  return client.get('cashbook', { params }).then(response => response.data.data);
}

export function storeMovement(data: { type: number, amount: number, note: string|null }): Promise<void> {
  return client.post('cash-movement', data).then(() => {});
}

export function destroyMovement(id: number): Promise<void> {
  return client.delete('cash-movement/' + id).then(() => {});
}
