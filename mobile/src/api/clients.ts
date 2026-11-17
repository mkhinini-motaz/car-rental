import client from './client';
import Client from '../classes/Client';
import { QueryContext } from './query';

export type ClientInput = Omit<Client, 'id' | 'agency_id' | 'contracts' | 'warnings' | 'stats' | 'created_at' | 'updated_at'>;

export function index({ queryKey }: QueryContext): Promise<Client[]> {
  const [_key, { search = undefined } = {}] = queryKey;

  return client.get('client', { params: { search, perPage: 50 } }).then(response => response.data.data);
}

export function show({ queryKey }: QueryContext): Promise<Client> {
  const [_key, { id }] = queryKey;

  return client.get('client/' + id).then(response => response.data.data);
}

export function store(data: ClientInput): Promise<Client> {
  return client.post('client', data).then(response => response.data.data);
}

export function update(id: number, data: ClientInput): Promise<Client> {
  return client.put('client/' + id, data).then(response => response.data.data);
}
