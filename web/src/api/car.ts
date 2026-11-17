import client, { multipartConfig, toFormData } from './client';
import Car from '../classes/Car';
import CarBlock from '../classes/CarBlock';
import { ContractDamage } from '../classes/Inspection';
import { PhotoFile } from '../support/photo';
import { QueryContext } from './query';

export type CarInput = Pick<Car, 'daily_price' | 'licence_plate' | 'serial_number' | 'manufacturer' | 'model_name' | 'model_year' | 'fiscal_horse_power'
  | 'number_of_cylinders' | 'transmission_type' | 'fuel_type' | 'type' | 'first_circulation_date' | 'circulation_tax_ends_at' | 'insurance_ends_at'
  | 'technical_control_ends_at' | 'colour' | 'status' | 'mileage' | 'oil_change_every_km' | 'oil_change_every_months' | 'branch_id'>;

export interface Quote {
  daily_price: number, // millimes, rounded to the dinar
  base_price: number,
  seasons: string[],
  discount_percent: number,
}

export function index({ queryKey }: QueryContext): Promise<Car[]> {
  const [_key, { search = undefined, starts_at = undefined, ends_at = undefined } = {}] = queryKey;

  return client.get('car', { params: { search, starts_at, ends_at, perPage: 100 } })
    .then(response => response.data.data);
}

export function show({ queryKey }: QueryContext): Promise<Car> {
  const [_key, { id }] = queryKey;

  return client.get('car/' + id).then(response => response.data.data);
}

export function store(data: CarInput): Promise<Car> {
  return client.post('car', data).then(response => response.data.data);
}

export function update(id: number, data: CarInput): Promise<Car> {
  return client.put('car/' + id, data).then(response => response.data.data);
}

// The suggested daily price from the agency's pricing rules; staff can change it.
export function quote(id: number, starts_at: number, ends_at: number): Promise<Quote> {
  return client.get('car/' + id + '/quote', { params: { starts_at, ends_at } }).then(response => response.data.data);
}

// One photo per car; a new one replaces the old one.
export function uploadPhoto(id: number, photo: PhotoFile): Promise<Car> {
  return client.post('car/' + id + '/photo', toFormData({ photo }), multipartConfig).then(response => response.data.data);
}

// Every car with its contracts (client included) and blocks over at most two months.
// queryKey: ['planning', { starts_at, ends_at }]
export function planning({ queryKey }: QueryContext): Promise<Car[]> {
  const [_key, params] = queryKey;

  return client.get('planning', { params }).then(response => response.data.data);
}

// A 422 `contract:overlap` means a contract or another block is in the way.
export function storeBlock(carId: number, data: Omit<CarBlock, 'id' | 'car_id'>): Promise<CarBlock> {
  return client.post('car/' + carId + '/block', data).then(response => response.data.data);
}

export function destroyBlock(carId: number, blockId: number): Promise<void> {
  return client.delete('car/' + carId + '/block/' + blockId).then(() => {});
}

// Damage already on the car, marked outside a handover (a car that came into the app with its scratches):
// nobody is charged for it, and its next handovers show it until it is repaired.
export function storeDamages(carId: number, damages: { x: number, y: number, note: string|null }[]): Promise<ContractDamage[]> {
  return client.post('car/' + carId + '/damage', { damages }).then(response => response.data.data);
}

// The damage leaves the next handovers. With an amount, the repair is also the car's expense (a 404:
// already repaired).
export function repairDamage(carId: number, damageId: number, data: { repaired_at: number, amount: number|null, garage: string|null }): Promise<ContractDamage> {
  return client.post('car/' + carId + '/damage/' + damageId + '/repair', data).then(response => response.data.data);
}
