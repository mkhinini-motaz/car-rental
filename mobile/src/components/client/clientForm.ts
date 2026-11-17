import Client, { FLAGS } from '../../classes/Client';
import { ClientInput } from '../../api/clients';
import { formatDate } from '../../support/utils';
import {
  FORM_FIELD_TYPE_DATE, FORM_FIELD_TYPE_PHONE, FORM_FIELD_TYPE_RADIO, FORM_FIELD_TYPE_SUBMIT, FORM_FIELD_TYPE_TEXT, serverFieldErrors,
} from '../../support/form';

export interface ClientFormValue {
  first_name: string,
  last_name: string,
  phone: string, // as typed: '+216 22 123 456'
  gender: 1|2|null,
  birth_date: Date|null,
  id_number: string,
  driver_licence_number: string,
  driver_licence_delivery_date: Date|null,
  driver_licence_expiry_date: Date|null,
  flag: number, // 0: not flagged
  notes: string,
  rentals_before: string, // as typed; '' is none
}

export const emptyClientForm: ClientFormValue = {
  first_name: '', last_name: '', phone: '+216 ', gender: null, birth_date: null,
  id_number: '', driver_licence_number: '', driver_licence_delivery_date: null, driver_licence_expiry_date: null, flag: 0, notes: '', rentals_before: '',
};

// The API stores these dates as 'dd/mm/yyyy' strings.
export const parseDate = (value: string|null) => {
  if (! value) {
    return null;
  }
  const [day, month, year] = value.split('/').map(Number);
  return new Date(year, month - 1, day);
};
export const toDateString = (date: Date|null) => date ? formatDate(date.getTime() / 1000) : null;

export const toMaskedPhone = (phone: string) =>
  `${phone.slice(0, 4)} ${phone.slice(4, 6)} ${phone.slice(6, 9)} ${phone.slice(9)}`;

export function clientToForm(client: Client): ClientFormValue {
  return {
    first_name: client.first_name,
    last_name: client.last_name,
    phone: toMaskedPhone(client.phone),
    gender: client.gender,
    birth_date: parseDate(client.birth_date),
    id_number: client.id_number ?? '',
    driver_licence_number: client.driver_licence_number ?? '',
    driver_licence_delivery_date: parseDate(client.driver_licence_delivery_date),
    driver_licence_expiry_date: parseDate(client.driver_licence_expiry_date),
    flag: client.flag ?? 0,
    notes: client.notes ?? '',
    rentals_before: client.rentals_before ? String(client.rentals_before) : '',
  };
}

export function formToClientInput(value: ClientFormValue): ClientInput {
  return {
    first_name: value.first_name.trim(),
    last_name: value.last_name.trim(),
    phone: value.phone.replaceAll(' ', ''),
    gender: value.gender,
    birth_date: toDateString(value.birth_date),
    id_number: value.id_number.trim() || null,
    driver_licence_number: value.driver_licence_number.trim() || null,
    driver_licence_delivery_date: toDateString(value.driver_licence_delivery_date),
    driver_licence_expiry_date: toDateString(value.driver_licence_expiry_date),
    flag: (value.flag || null) as Client['flag'],
    notes: value.notes.trim() || null,
    rentals_before: parseInt(value.rentals_before, 10) || 0,
  };
}

// Maps a 422 from the API onto the form's fields; only the phone can be taken.
export const clientServerErrors = (error: any) => serverFieldErrors(error, 'validation:phone:used');

// Name and phone are enough to book; the rest is filled in at pickup.
export function clientFormFields(isLoading: boolean, withDetails = true) {
  const today = new Date();
  const details = [
    {
      name: 'gender', label: 'form:gender:label', type: FORM_FIELD_TYPE_RADIO, required: false,
      options: [ { label: 'common:gender:1', value: 1 }, { label: 'common:gender:2', value: 2 } ],
    },
    { name: 'birth_date', label: 'form:birth_date:label', type: FORM_FIELD_TYPE_DATE, required: false, maxDate: today },
    { name: 'id_number', label: 'form:id_number:label', type: FORM_FIELD_TYPE_TEXT, required: false, keyboardType: 'number-pad' },
    { name: 'driver_licence_number', label: 'form:driver_licence_number:label', type: FORM_FIELD_TYPE_TEXT, required: false },
    { name: 'driver_licence_delivery_date', label: 'form:driver_licence_delivery_date:label', type: FORM_FIELD_TYPE_DATE, required: false, maxDate: today },
    { name: 'driver_licence_expiry_date', label: 'form:driver_licence_expiry_date:label', type: FORM_FIELD_TYPE_DATE, required: false },
    // Blacklist: staff are warned when this person (or their ID or licence) is picked again.
    {
      name: 'flag', label: 'client:flag', type: FORM_FIELD_TYPE_RADIO, required: false,
      options: [ 0, ...FLAGS ].map(flag => ({ label: 'client:flag:' + flag, value: flag })),
    },
    { name: 'notes', label: 'client:notes', type: FORM_FIELD_TYPE_TEXT, required: false, multiline: true },
    // A regular client from before the app: known, not new.
    { name: 'rentals_before', label: 'client:rentals_before', type: FORM_FIELD_TYPE_TEXT, required: false, keyboardType: 'number-pad' },
  ];

  return [
    { name: 'first_name', label: 'form:first_name:label', type: FORM_FIELD_TYPE_TEXT },
    { name: 'last_name', label: 'form:last_name:label', type: FORM_FIELD_TYPE_TEXT },
    { name: 'phone', label: 'form:phone:label', type: FORM_FIELD_TYPE_PHONE },
    ...(withDetails ? details : []),
    { label: 'common:save', type: FORM_FIELD_TYPE_SUBMIT, isLoading },
  ];
}
