import Car, { STATUS_AVAILABLE, STATUS_MAINTENANCE, STATUS_OUT_OF_SERVICE } from '../../classes/Car';
import { CarInput } from '../../api/car';
import { millimesFromInput, priceInputFromMillimes } from '../../support/money';
import { PhotoFile } from '../../support/photo';
import {
  FORM_FIELD_TYPE_COLOR, FORM_FIELD_TYPE_DATE, FORM_FIELD_TYPE_PHOTO, FORM_FIELD_TYPE_RADIO, FORM_FIELD_TYPE_SUBMIT, FORM_FIELD_TYPE_TEXT,
} from '../../support/form';
import { parseDate, toDateString } from '../client/clientForm';

// Numbers are kept as typed; the API validates them.
export interface CarFormValue {
  photo: PhotoFile|null, // picked, uploaded after the car is saved
  manufacturer: string,
  model_name: string,
  model_year: string,
  licence_plate: string,
  serial_number: string,
  colour: string|null,
  daily_price: string, // dinars
  status: number,
  type: number|null,
  transmission_type: number|null,
  fuel_type: number|null,
  fiscal_horse_power: string,
  number_of_cylinders: string,
  mileage: string,
  oil_change_every_km: string,
  oil_change_every_months: string,
  first_circulation_date: Date|null,
  insurance_ends_at: Date|null,
  circulation_tax_ends_at: Date|null,
  technical_control_ends_at: Date|null,
  branch_id: number, // 0: none
}

export const emptyCarForm: CarFormValue = {
  photo: null, manufacturer: '', model_name: '', model_year: '', licence_plate: '', serial_number: '',
  colour: null, daily_price: '', status: STATUS_AVAILABLE, type: null, transmission_type: null, fuel_type: null,
  fiscal_horse_power: '', number_of_cylinders: '', mileage: '', oil_change_every_km: '10000', oil_change_every_months: '12', first_circulation_date: null,
  insurance_ends_at: null, circulation_tax_ends_at: null, technical_control_ends_at: null, branch_id: 0,
};

const fromTimestamp = (timestamp: number) => new Date(timestamp * 1000);
// Expiry dates are sent as the start of the chosen day.
const toTimestamp = (date: Date|null) => date ? Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 1000) : 0;
const toInt = (value: string) => Number.parseInt(value.trim(), 10);

export function carToForm(car: Car): CarFormValue {
  return {
    photo: null,
    manufacturer: car.manufacturer,
    model_name: car.model_name,
    model_year: String(car.model_year),
    licence_plate: car.licence_plate,
    serial_number: car.serial_number,
    colour: car.colour,
    daily_price: priceInputFromMillimes(car.daily_price),
    status: car.status,
    type: car.type,
    transmission_type: car.transmission_type,
    fuel_type: car.fuel_type,
    fiscal_horse_power: String(car.fiscal_horse_power),
    number_of_cylinders: String(car.number_of_cylinders),
    mileage: car.mileage === null ? '' : String(car.mileage),
    oil_change_every_km: String(car.oil_change_every_km),
    oil_change_every_months: String(car.oil_change_every_months),
    first_circulation_date: parseDate(car.first_circulation_date),
    insurance_ends_at: fromTimestamp(car.insurance_ends_at),
    circulation_tax_ends_at: fromTimestamp(car.circulation_tax_ends_at),
    technical_control_ends_at: fromTimestamp(car.technical_control_ends_at),
    branch_id: car.branch_id ?? 0,
  };
}

export function formToCarInput(value: CarFormValue): CarInput {
  return {
    manufacturer: value.manufacturer.trim(),
    model_name: value.model_name.trim(),
    model_year: toInt(value.model_year),
    licence_plate: value.licence_plate.trim(),
    serial_number: value.serial_number.trim(),
    colour: value.colour,
    daily_price: millimesFromInput(value.daily_price) ?? 0,
    status: value.status as CarInput['status'],
    type: value.type as CarInput['type'],
    transmission_type: value.transmission_type as CarInput['transmission_type'],
    fuel_type: value.fuel_type as CarInput['fuel_type'],
    fiscal_horse_power: toInt(value.fiscal_horse_power),
    number_of_cylinders: toInt(value.number_of_cylinders),
    mileage: value.mileage.trim() ? toInt(value.mileage) : null,
    oil_change_every_km: toInt(value.oil_change_every_km),
    oil_change_every_months: toInt(value.oil_change_every_months),
    first_circulation_date: toDateString(value.first_circulation_date) ?? '',
    insurance_ends_at: toTimestamp(value.insurance_ends_at),
    circulation_tax_ends_at: toTimestamp(value.circulation_tax_ends_at),
    technical_control_ends_at: toTimestamp(value.technical_control_ends_at),
    branch_id: value.branch_id || null,
  };
}

// The registration card (carte grise) has everything but the price, colour and status.
// `branches`: the agency's premises, for the car's home branch (none: the field is left out).
export function carFormFields(isLoading: boolean, photoUrl: string|null = null, branches: { id: number, name: string }[] = []) {
  const options = (prefix: string, values: number[]) => values.map(value => ({ label: prefix + value, value }));

  return [
    { name: 'photo', label: 'car:photo', type: FORM_FIELD_TYPE_PHOTO, required: false, currentUrl: photoUrl },
    { name: 'manufacturer', label: 'car:manufacturer', type: FORM_FIELD_TYPE_TEXT },
    { name: 'model_name', label: 'car:model_name', type: FORM_FIELD_TYPE_TEXT },
    { name: 'model_year', label: 'car:model_year', type: FORM_FIELD_TYPE_TEXT, keyboardType: 'number-pad' },
    { name: 'licence_plate', label: 'car:licence_plate', type: FORM_FIELD_TYPE_TEXT },
    { name: 'serial_number', label: 'car:serial_number', type: FORM_FIELD_TYPE_TEXT },
    { name: 'colour', label: 'car:colour', type: FORM_FIELD_TYPE_COLOR, required: false },
    { name: 'daily_price', label: 'contract:daily_price', type: FORM_FIELD_TYPE_TEXT, keyboardType: 'decimal-pad' },
    { name: 'status', label: 'car:status', type: FORM_FIELD_TYPE_RADIO, options: options('car:status:', [ STATUS_AVAILABLE, STATUS_MAINTENANCE, STATUS_OUT_OF_SERVICE ]) },
    { name: 'type', label: 'car:type', type: FORM_FIELD_TYPE_RADIO, options: options('car:type:', [ 1, 2 ]) },
    { name: 'transmission_type', label: 'car:transmission_type', type: FORM_FIELD_TYPE_RADIO, options: options('car:transmission_type:', [ 1, 2 ]) },
    { name: 'fuel_type', label: 'car:fuel_type', type: FORM_FIELD_TYPE_RADIO, options: options('car:fuel_type:', [ 1, 2 ]) },
    { name: 'fiscal_horse_power', label: 'car:fiscal_horse_power', type: FORM_FIELD_TYPE_TEXT, keyboardType: 'number-pad' },
    { name: 'number_of_cylinders', label: 'car:number_of_cylinders', type: FORM_FIELD_TYPE_TEXT, keyboardType: 'number-pad' },
    { name: 'mileage', label: 'car:mileage', type: FORM_FIELD_TYPE_TEXT, keyboardType: 'number-pad', required: false },
    { name: 'oil_change_every_km', label: 'car:oil_change_every_km', type: FORM_FIELD_TYPE_TEXT, keyboardType: 'number-pad' },
    { name: 'oil_change_every_months', label: 'car:oil_change_every_months', type: FORM_FIELD_TYPE_TEXT, keyboardType: 'number-pad' },
    { name: 'first_circulation_date', label: 'car:first_circulation_date', type: FORM_FIELD_TYPE_DATE, maxDate: new Date() },
    { name: 'insurance_ends_at', label: 'car:insurance', type: FORM_FIELD_TYPE_DATE },
    { name: 'circulation_tax_ends_at', label: 'car:circulation_tax', type: FORM_FIELD_TYPE_DATE },
    { name: 'technical_control_ends_at', label: 'car:technical_control', type: FORM_FIELD_TYPE_DATE },
    ...(branches.length ? [ { name: 'branch_id', label: 'car:branch', type: FORM_FIELD_TYPE_RADIO, required: false, options: [ { label: 'expense:branch:none', value: 0 }, ...branches.map(branch => ({ label: branch.name, value: branch.id })) ] } ] : []),
    { label: 'common:save', type: FORM_FIELD_TYPE_SUBMIT, isLoading },
  ];
}
