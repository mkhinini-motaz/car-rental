import client from './client';
import Fine from '../classes/Fine';
import { QueryContext } from './query';

export type FineInput = Pick<Fine, 'car_id' | 'committed_at' | 'amount' | 'reference' | 'note'>;

export function index(): Promise<Fine[]> {
  return client.get('fine', { params: { perPage: 100 } }).then(response => response.data.data);
}

export function show({ queryKey }: QueryContext): Promise<Fine> {
  const [_key, { id }] = queryKey;

  return client.get('fine/' + id).then(response => response.data.data);
}

// The API finds the rental active at `committed_at` and returns it with its client.
export function store(data: FineInput): Promise<Fine> {
  return client.post('fine', data).then(response => response.data.data);
}

// The client's side. `method` null: the client paid the authority directly. `paid_out_method`:
// how the agency paid when it bears the fine. A 422 `fine:deposit:unavailable` means the deposit
// is settled or too small.
export function settle(id: number, status: number, method: number|null, paidOutMethod?: number): Promise<Fine> {
  return client.put('fine/' + id, { status, method, paid_out_method: paidOutMethod }).then(response => response.data.data);
}

// The agency paid the authority (recette des finances).
export function payOut(id: number, method: number): Promise<Fine> {
  return client.post('fine/' + id + '/payout', { method }).then(response => response.data.data);
}

export function undoPayOut(id: number): Promise<Fine> {
  return client.delete('fine/' + id + '/payout').then(response => response.data.data);
}

// Who had the car, for a fine no rental in the app matches (a rental kept on paper); null clears it.
// A 422 `fine:client:contract` means the fine has its rental's client.
export function setClient(id: number, clientId: number|null): Promise<Fine> {
  return client.put('fine/' + id + '/client', { client_id: clientId }).then(response => response.data.data);
}

export function destroy(id: number): Promise<void> {
  return client.delete('fine/' + id).then(() => {});
}
