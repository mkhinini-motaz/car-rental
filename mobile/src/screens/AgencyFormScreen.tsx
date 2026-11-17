import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { update, uploadLogo, useAgency } from '../api/agency';
import { METHODS } from '../classes/Payment';
import { useLang, useNetworkErrorAlert } from '../store/hooks';
import { alertMessage, alertRequestError } from '../support/alert';
import { FORM_FIELD_TYPE_PHONE, FORM_FIELD_TYPE_PHOTO, FORM_FIELD_TYPE_RADIO, FORM_FIELD_TYPE_SUBMIT, FORM_FIELD_TYPE_TEXT, serverFieldErrors } from '../support/form';
import { millimesFromInput, priceInputFromMillimes } from '../support/money';
import { PhotoFile } from '../support/photo';
import Form from '../components/Form/Form';
import FullScreenLoader from '../components/common/FullScreenLoader';
import Screen from '../components/ui/Screen';
import { toMaskedPhone } from '../components/client/clientForm';
import { ScreenProps } from '../navigation/types';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

interface AgencyFormValue {
  logo: PhotoFile|null,
  name: string,
  phone: string, // as typed: '+216 73 123 456'
  address: string,
  tax_id: string,
  pickup_time: string, // 'HH:MM'
  return_time: string,
  takes_deposit: 1|2, // yes / no
  default_deposit: string, // dinars as typed
  default_deposit_method: number,
  fleet_max_years: string,
  employer_charges: string, // percent as typed: '16.57'
  min_driver_age: string,
  min_licence_years: string,
  vat: string, // percent as typed: '19'
  fiscal_stamp: string, // dinars as typed
  contract_terms: string,
}

// The agency: its name, contacts and logo, tax ID, usual pickup and return times, deposit,
// how long cars stay in the fleet, who may rent, and the contract's terms.
export default function AgencyFormScreen({ navigation }: ScreenProps<'AgencyFormScreen'>): React.JSX.Element {
  const { selectedLang } = useLang();
  const queryClient = useQueryClient();
  const [value, setValue] = useState<AgencyFormValue|null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const { isLoading, error, data } = useAgency();
  useNetworkErrorAlert(error);
  useEffect(() => {
    if (data) {
      setValue({
        logo: null, name: data.name, phone: data.phone ? toMaskedPhone(data.phone) : '+216 ', address: data.address ?? '',
        tax_id: data.tax_id ?? '', pickup_time: data.pickup_time, return_time: data.return_time,
        takes_deposit: data.takes_deposit ? 1 : 2,
        default_deposit: data.default_deposit ? priceInputFromMillimes(data.default_deposit) : '',
        default_deposit_method: data.default_deposit_method,
        fleet_max_years: String(data.fleet_max_years),
        employer_charges: data.employer_charges_rate ? String(data.employer_charges_rate / 100) : '',
        min_driver_age: data.min_driver_age ? String(data.min_driver_age) : '',
        min_licence_years: data.min_licence_years ? String(data.min_licence_years) : '',
        vat: data.vat_rate ? String(data.vat_rate / 100) : '',
        fiscal_stamp: data.fiscal_stamp ? priceInputFromMillimes(data.fiscal_stamp) : '',
        contract_terms: data.contract_terms ?? '',
      });
    }
  }, [data]);

  const { mutate, isPending } = useMutation({
    mutationFn: async (form: AgencyFormValue) => {
      const phone = form.phone.replaceAll(' ', '');
      await update({
        name: form.name.trim(), phone: phone.length > 4 ? phone : null, address: form.address.trim() || null,
        tax_id: form.tax_id.trim() || null, pickup_time: form.pickup_time, return_time: form.return_time,
        takes_deposit: form.takes_deposit === 1,
        default_deposit: millimesFromInput(form.default_deposit) ?? 0,
        default_deposit_method: form.default_deposit_method as 1|2|3|4,
        fleet_max_years: Number(form.fleet_max_years),
        employer_charges_rate: Math.round(Number(form.employer_charges.trim().replace(',', '.') || 0) * 100),
        min_driver_age: Number(form.min_driver_age.trim() || 0),
        min_licence_years: Number(form.min_licence_years.trim() || 0),
        vat_rate: Math.round(Number(form.vat.trim().replace(',', '.') || 0) * 100),
        fiscal_stamp: millimesFromInput(form.fiscal_stamp) ?? 0,
        contract_terms: form.contract_terms.trim() || null,
      });
      if (form.logo) {
        await uploadLogo(form.logo);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency.show'] });
      alertMessage(selectedLang, 'agency:saved');
      navigation.goBack();
    },
    onError: (requestError) => {
      const errors = serverFieldErrors(requestError);
      setServerErrors(errors);
      if (! Object.keys(errors).length) {
        alertRequestError(selectedLang, requestError);
      }
    },
  });

  if (isLoading || ! value) {
    return <FullScreenLoader />;
  }

  const onSubmit = () => {
    const errors: Record<string, string> = {};
    for (const field of [ 'pickup_time', 'return_time' ] as const) {
      if (! TIME.test(value[field])) {
        errors[field] = 'validation:time';
      }
    }
    if (! /^\d+$/.test(value.fleet_max_years) || Number(value.fleet_max_years) < 1) {
      errors.fleet_max_years = 'validation:invalid';
    }
    for (const field of [ 'min_driver_age', 'min_licence_years' ] as const) {
      if (! /^\d{0,2}$/.test(value[field].trim())) {
        errors[field] = 'validation:invalid';
      }
    }
    if (value.vat.trim() && ! /^\d{1,2}([.,]\d{1,2})?$/.test(value.vat.trim())) {
      errors.vat = 'validation:invalid';
    }
    if (value.fiscal_stamp.trim() && millimesFromInput(value.fiscal_stamp) === null) {
      errors.fiscal_stamp = 'validation:invalid';
    }
    if (value.employer_charges.trim() && ! /^\d{1,2}([.,]\d{1,2})?$/.test(value.employer_charges.trim())) {
      errors.employer_charges = 'validation:invalid';
    }
    setServerErrors(errors);
    if (! Object.keys(errors).length) {
      mutate(value);
    }
  };

  return (
    <Screen white>
      <Form
        value={value}
        fields={[
          { name: 'logo', label: 'agency:logo', type: FORM_FIELD_TYPE_PHOTO, required: false, currentUrl: data?.logo_url },
          { name: 'name', label: 'agency:name', type: FORM_FIELD_TYPE_TEXT },
          { name: 'phone', label: 'form:phone:label', type: FORM_FIELD_TYPE_PHONE, required: false },
          { name: 'address', label: 'form:address:label', type: FORM_FIELD_TYPE_TEXT, required: false },
          { name: 'tax_id', label: 'agency:tax_id', type: FORM_FIELD_TYPE_TEXT, required: false },
          { name: 'pickup_time', label: 'agency:pickup_time', type: FORM_FIELD_TYPE_TEXT, keyboardType: 'numbers-and-punctuation' },
          { name: 'return_time', label: 'agency:return_time', type: FORM_FIELD_TYPE_TEXT, keyboardType: 'numbers-and-punctuation' },
          { name: 'takes_deposit', label: 'agency:takes_deposit', type: FORM_FIELD_TYPE_RADIO, options: [ { label: 'common:yes', value: 1 }, { label: 'common:no', value: 2 } ] },
          ...(value.takes_deposit === 1 ? [
            { name: 'default_deposit', label: 'agency:default_deposit', type: FORM_FIELD_TYPE_TEXT, required: false, keyboardType: 'decimal-pad' },
            { name: 'default_deposit_method', label: 'deposit:method', type: FORM_FIELD_TYPE_RADIO, options: METHODS.map(method => ({ label: 'payment:method:' + method, value: method })) },
          ] : []),
          { name: 'fleet_max_years', label: 'agency:fleet_max_years', type: FORM_FIELD_TYPE_TEXT, keyboardType: 'number-pad' },
          { name: 'employer_charges', label: 'agency:employer_charges', type: FORM_FIELD_TYPE_TEXT, keyboardType: 'decimal-pad', required: false },
          { name: 'min_driver_age', label: 'agency:min_driver_age', type: FORM_FIELD_TYPE_TEXT, keyboardType: 'number-pad', required: false },
          { name: 'min_licence_years', label: 'agency:min_licence_years', type: FORM_FIELD_TYPE_TEXT, keyboardType: 'number-pad', required: false },
          { name: 'vat', label: 'agency:vat_rate', type: FORM_FIELD_TYPE_TEXT, keyboardType: 'decimal-pad', required: false },
          { name: 'fiscal_stamp', label: 'agency:fiscal_stamp', type: FORM_FIELD_TYPE_TEXT, keyboardType: 'decimal-pad', required: false },
          { name: 'contract_terms', label: 'agency:contract_terms', type: FORM_FIELD_TYPE_TEXT, required: false, multiline: true },
          { label: 'common:save', type: FORM_FIELD_TYPE_SUBMIT, isLoading: isPending },
        ]}
        onChange={setValue}
        onSubmit={onSubmit}
        serverErrors={serverErrors}
      />
    </Screen>
  );
}
