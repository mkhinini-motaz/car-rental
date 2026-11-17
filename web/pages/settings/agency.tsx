import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, TextField } from '@mui/material';
import { update, uploadLogo, useAgency } from '../../src/api/agency';
import { METHODS } from '../../src/classes/Payment';
import { PHONE_REGEX } from '../../src/constants';
import { useT } from '../../src/store/Store';
import { serverFieldErrors } from '../../src/support/alert';
import { millimesFromInput, priceInputFromMillimes } from '../../src/support/money';
import { toMaskedPhone } from '../../src/support/utils';
import { useFeedback } from '../../src/components/Feedback';
import { Choice, Loading, PhotoInput } from '../../src/components/common';
import SimpleForm from '../../src/components/SimpleForm';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

interface AgencyFormValue {
  name: string,
  phone: string, // as typed: '+216 73 123 456'
  address: string,
  tax_id: string,
  pickup_time: string, // 'HH:MM'
  return_time: string,
  takes_deposit: boolean,
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
export default function AgencyPage() {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { notify, requestError } = useFeedback();
  const { data } = useAgency();
  const [value, setValue] = useState<AgencyFormValue|null>(null);
  const [logo, setLogo] = useState<File|null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (data) {
      setValue({
        name: data.name, phone: data.phone ? toMaskedPhone(data.phone) : '+216 ', address: data.address ?? '', tax_id: data.tax_id ?? '',
        pickup_time: data.pickup_time, return_time: data.return_time, takes_deposit: data.takes_deposit,
        default_deposit: data.default_deposit ? priceInputFromMillimes(data.default_deposit) : '', default_deposit_method: data.default_deposit_method,
        fleet_max_years: String(data.fleet_max_years), employer_charges: data.employer_charges_rate ? String(data.employer_charges_rate / 100) : '',
        min_driver_age: data.min_driver_age ? String(data.min_driver_age) : '', min_licence_years: data.min_licence_years ? String(data.min_licence_years) : '',
        vat: data.vat_rate ? String(data.vat_rate / 100) : '', fiscal_stamp: data.fiscal_stamp ? priceInputFromMillimes(data.fiscal_stamp) : '',
        contract_terms: data.contract_terms ?? '',
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async (form: AgencyFormValue) => {
      const phone = form.phone.replaceAll(' ', '');
      await update({
        name: form.name.trim(), phone: phone.length > 4 ? phone : null, address: form.address.trim() || null,
        tax_id: form.tax_id.trim() || null, pickup_time: form.pickup_time, return_time: form.return_time,
        takes_deposit: form.takes_deposit, default_deposit: millimesFromInput(form.default_deposit) ?? 0,
        default_deposit_method: form.default_deposit_method as 1|2|3|4, fleet_max_years: Number(form.fleet_max_years),
        employer_charges_rate: Math.round(Number(form.employer_charges.trim().replace(',', '.') || 0) * 100),
        min_driver_age: Number(form.min_driver_age.trim() || 0), min_licence_years: Number(form.min_licence_years.trim() || 0),
        vat_rate: Math.round(Number(form.vat.trim().replace(',', '.') || 0) * 100), fiscal_stamp: millimesFromInput(form.fiscal_stamp) ?? 0,
        contract_terms: form.contract_terms.trim() || null,
      });
      if (logo) {
        await uploadLogo(logo);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency.show'] });
      notify('agency:saved', 'success');
      router.push('/settings');
    },
    onError: (error) => {
      const fieldErrors = serverFieldErrors(error);
      setErrors(fieldErrors);
      if (! Object.keys(fieldErrors).length) {
        requestError(error);
      }
    },
  });

  if (! value) {
    return <Loading />;
  }
  const onSubmit = () => {
    const fieldErrors: Record<string, string> = {};
    const phone = value.phone.replaceAll(' ', '');
    if (! value.name.trim()) {
      fieldErrors.name = 'validation:required';
    }
    if (phone.length > 4 && ! PHONE_REGEX.test(phone)) {
      fieldErrors.phone = 'validation:phone:invalid';
    }
    for (const field of [ 'pickup_time', 'return_time' ] as const) {
      if (! TIME.test(value[field])) {
        fieldErrors[field] = 'validation:time';
      }
    }
    if (! /^\d+$/.test(value.fleet_max_years) || Number(value.fleet_max_years) < 1) {
      fieldErrors.fleet_max_years = 'validation:invalid';
    }
    for (const field of [ 'min_driver_age', 'min_licence_years' ] as const) {
      if (! /^\d{0,2}$/.test(value[field].trim())) {
        fieldErrors[field] = 'validation:invalid';
      }
    }
    if (value.vat.trim() && ! /^\d{1,2}([.,]\d{1,2})?$/.test(value.vat.trim())) {
      fieldErrors.vat = 'validation:invalid';
    }
    if (value.fiscal_stamp.trim() && millimesFromInput(value.fiscal_stamp) === null) {
      fieldErrors.fiscal_stamp = 'validation:invalid';
    }
    if (value.employer_charges.trim() && ! /^\d{1,2}([.,]\d{1,2})?$/.test(value.employer_charges.trim())) {
      fieldErrors.employer_charges = 'validation:invalid';
    }
    setErrors(fieldErrors);
    if (! Object.keys(fieldErrors).length) {
      save.mutate(value);
    }
  };
  const set = (name: keyof AgencyFormValue) => (fieldValue: any) => setValue(current => current && { ...current, [name]: fieldValue });
  const field = (name: keyof AgencyFormValue, label: string, extra: object = {}) =>
    <TextField label={t(label)} value={value[name]} onChange={event => set(name)(event.target.value)} error={!! errors[name]} helperText={errors[name] && t(errors[name])} {...extra} />;

  return (
    <SimpleForm title='agency:edit' onSubmit={onSubmit} isSaving={save.isPending}>
      <PhotoInput label='agency:logo' currentUrl={data?.logo_url} value={logo} onChange={setLogo} />
      {field('name', 'agency:name', { required: true })}
      {field('phone', 'form:phone:label', { type: 'tel' })}
      {field('address', 'form:address:label')}
      {field('tax_id', 'agency:tax_id')}
      <Stack direction='row' sx={{ gap: 2 }}>
        {field('pickup_time', 'agency:pickup_time', { type: 'time', slotProps: { inputLabel: { shrink: true } } })}
        {field('return_time', 'agency:return_time', { type: 'time', slotProps: { inputLabel: { shrink: true } } })}
      </Stack>
      <Choice label='agency:takes_deposit' value={value.takes_deposit} onChange={set('takes_deposit')} options={[ { label: 'common:yes', value: true }, { label: 'common:no', value: false } ]} />
      {value.takes_deposit && <>
        {field('default_deposit', 'agency:default_deposit', { slotProps: { htmlInput: { inputMode: 'decimal' } } })}
        <Choice label='deposit:method' value={value.default_deposit_method} onChange={set('default_deposit_method')} options={METHODS.map(method => ({ label: 'payment:method:' + method, value: method }))} />
      </>}
      {field('fleet_max_years', 'agency:fleet_max_years', { slotProps: { htmlInput: { inputMode: 'numeric' } } })}
      {field('employer_charges', 'agency:employer_charges', { slotProps: { htmlInput: { inputMode: 'decimal' } } })}
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
        {field('min_driver_age', 'agency:min_driver_age', { slotProps: { htmlInput: { inputMode: 'numeric' } } })}
        {field('min_licence_years', 'agency:min_licence_years', { slotProps: { htmlInput: { inputMode: 'numeric' } } })}
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
        {field('vat', 'agency:vat_rate', { slotProps: { htmlInput: { inputMode: 'decimal' } } })}
        {field('fiscal_stamp', 'agency:fiscal_stamp', { slotProps: { htmlInput: { inputMode: 'decimal' } } })}
      </Stack>
      {field('contract_terms', 'agency:contract_terms', { multiline: true, minRows: 4 })}
    </SimpleForm>
  );
}
