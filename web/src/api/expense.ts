import client from './client';
import Expense from '../classes/Expense';
import { QueryContext } from './query';

export type ExpenseInput = Omit<Expense, 'id' | 'car' | 'branch' | 'employee'>;

// queryKey: ['expense.index', { car_id?, from?, to?, group?: 'car'|'agency' }]
export function index({ queryKey }: QueryContext): Promise<Expense[]> {
  const [_key, params = {}] = queryKey;

  return client.get('expense', { params: { ...params, perPage: 100 } }).then(response => response.data.data);
}

export function store(data: ExpenseInput): Promise<Expense> {
  return client.post('expense', data).then(response => response.data.data);
}

export function destroy(id: number): Promise<void> {
  return client.delete('expense/' + id).then(() => {});
}
