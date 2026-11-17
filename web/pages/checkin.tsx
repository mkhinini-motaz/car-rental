import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, Card, CardContent, Checkbox, FormControlLabel, Stack, TextField, Typography } from '@mui/material';
import Description from '@mui/icons-material/Description';
import client, { multipartConfig, toFormData } from '../src/api/client';
import { PHONE_REGEX } from '../src/constants';
import { useLang, useT } from '../src/store/Store';
import { formatDateTime, parseDmy, toDmy, toMaskedPhone } from '../src/support/utils';
import { validationErrors } from '../src/support/alert';
import { pdfLang } from '../src/support/pdf';
import { DateInput, Loading, PhotoInput } from '../src/components/common';
import { SignatureField } from '../src/components/signature';
import { LangSelect } from '../src/layout/Layout';

interface Person {
  first_name: string, last_name: string, phone: string,
  birth_date: Date|null, id_number: string, driver_licence_number: string,
  driver_licence_delivery_date: Date|null, driver_licence_expiry_date: Date|null,
}

interface CheckIn {
  agency: { name: string, phone: string|null, logo_url: string|null },
  car: { manufacturer: string, model_name: string },
  starts_at: number, ends_at: number, pickup_location: string|null,
  client: Record<string, string|null>,
  second_driver: Record<string, string|null>|null,
  documents: number[],
  signature: string|null, signed_at: number|null,
  contract_urls: { fr: string, ar: string }, // the contract PDF, signed links
}

const emptyPerson: Person = {
  first_name: '', last_name: '', phone: '+216 ', birth_date: null, id_number: '', driver_licence_number: '',
  driver_licence_delivery_date: null, driver_licence_expiry_date: null,
};
const toPerson = (data: Record<string, string|null>): Person => ({
  first_name: data.first_name ?? '', last_name: data.last_name ?? '', phone: data.phone ? toMaskedPhone(data.phone) : '+216 ',
  birth_date: parseDmy(data.birth_date), id_number: data.id_number ?? '', driver_licence_number: data.driver_licence_number ?? '',
  driver_licence_delivery_date: parseDmy(data.driver_licence_delivery_date), driver_licence_expiry_date: parseDmy(data.driver_licence_expiry_date),
});
const toInput = (person: Person, withPhone: boolean) => ({
  first_name: person.first_name.trim(), last_name: person.last_name.trim(),
  ...(withPhone ? { phone: person.phone.replaceAll(' ', '') } : {}),
  birth_date: toDmy(person.birth_date), id_number: person.id_number.trim() || null, driver_licence_number: person.driver_licence_number.trim() || null,
  driver_licence_delivery_date: toDmy(person.driver_licence_delivery_date), driver_licence_expiry_date: toDmy(person.driver_licence_expiry_date),
});

// The errors of one person, by field: { 'client.id_number': ... } → { id_number: ... }.
const fieldsOf = (errors: Record<string, string>, prefix: string) =>
  Object.fromEntries(Object.entries(errors).filter(([ field ]) => field.startsWith(prefix)).map(([ field, message ]) => [ field.slice(prefix.length), message ]));

function PersonFields({ value, onChange, withPhone = false, errors }: { value: Person, onChange: (value: Person) => void, withPhone?: boolean, errors: Record<string, string> }) {
  const t = useT();
  const text = (field: 'first_name'|'last_name'|'phone'|'id_number'|'driver_licence_number', label: string, extra: object = {}) =>
    <TextField label={t(label)} value={value[field]} onChange={event => onChange({ ...value, [field]: event.target.value })} error={!! errors[field]} helperText={errors[field] && t(errors[field])} {...extra} />;
  const today = new Date();
  return (
    <Stack sx={{ gap: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
        {text('first_name', 'form:first_name:label', { required: true, fullWidth: true })}
        {text('last_name', 'form:last_name:label', { required: true, fullWidth: true })}
      </Stack>
      {withPhone && text('phone', 'form:phone:label', { required: true, type: 'tel' })}
      <DateInput label='form:birth_date:label' value={value.birth_date} onChange={date => onChange({ ...value, birth_date: date })} max={today} />
      {text('id_number', 'checkin:id_number')}
      {text('driver_licence_number', 'form:driver_licence_number:label')}
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
        <DateInput label='form:driver_licence_delivery_date:label' value={value.driver_licence_delivery_date} onChange={date => onChange({ ...value, driver_licence_delivery_date: date })} max={today} />
        <DateInput label='form:driver_licence_expiry_date:label' value={value.driver_licence_expiry_date} onChange={date => onChange({ ...value, driver_licence_expiry_date: date })} />
      </Stack>
    </Stack>
  );
}

// The client's own page, opened from the link staff send before the pickup (no sign-in): they fill
// in their ID and licence, and the second driver's, photograph them and may sign the contract after
// reading it, so the counter only checks.
export default function CheckInPage() {
  const t = useT();
  const { selectedLang } = useLang();
  const router = useRouter();
  const link = String(router.query.link ?? '').replace(/^\/?api\//, ''); // the API's signed path
  const [person, setPerson] = useState<Person>(emptyPerson);
  const [hasDriver, setHasDriver] = useState(false);
  const [driver, setDriver] = useState<Person>(emptyPerson);
  const [idPhoto, setIdPhoto] = useState<File|null>(null);
  const [licencePhoto, setLicencePhoto] = useState<File|null>(null);
  const [signature, setSignature] = useState<string|null>(null); // drawn now; null keeps the one given before
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { data, isLoading, error } = useQuery({
    queryKey: ['checkin', link],
    queryFn: () => client.get(link).then(response => response.data.data as CheckIn),
    enabled: !! link,
    retry: false,
  });
  useEffect(() => {
    if (data) {
      setPerson(toPerson(data.client));
      if (data.second_driver) {
        setHasDriver(true);
        setDriver(toPerson(data.second_driver));
      }
    }
  }, [data]);
  const save = useMutation({
    mutationFn: () => client.post(link, toFormData({
      client: toInput(person, false),
      ...(hasDriver ? { second_driver: toInput(driver, true) } : {}),
      id_photo: idPhoto,
      licence_photo: licencePhoto,
      contract_signature: signature,
    }), multipartConfig),
    // A 422 names the field: `client.id_number`, `second_driver.phone` (messages are keys like `driver:second:same`, or Laravel's text).
    onError: (requestError) => setErrors(Object.fromEntries(Object.entries(validationErrors(requestError)).map(([ field, [ message ] ]) =>
      [ field, /^[\w:]+$/.test(message) ? message : 'validation:invalid' ]))),
  });
  const onSubmit = () => {
    const fieldErrors: Record<string, string> = {};
    if (! person.first_name.trim() || ! person.last_name.trim()) {
      fieldErrors['client.first_name'] = 'validation:required';
    }
    if (hasDriver && ! PHONE_REGEX.test(driver.phone)) {
      fieldErrors['second_driver.phone'] = 'validation:phone:invalid';
    }
    setErrors(fieldErrors);
    if (! Object.keys(fieldErrors).length) {
      save.mutate();
    }
  };
  const status = (error as any)?.response?.status;

  const page = (children: React.ReactNode) => (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default', p: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 640 }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
          <Stack sx={{ gap: 2.5 }}>
            {children}
            <LangSelect />
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );

  if (! router.isReady) {
    return <Loading />;
  }
  if (! link || status === 403 || status === 404) {
    return page(<Alert severity='error'>{t('checkin:invalid')}</Alert>);
  }
  if (status === 410) {
    return page(<Alert severity='info'>{t('checkin:closed')}</Alert>);
  }
  if (isLoading || ! data) {
    return error ? page(<Alert severity='error'>{t('network:error')}</Alert>) : <Loading />;
  }
  if (save.isSuccess) {
    return page(<Alert severity='success'>{t(signature ? 'checkin:done:signed' : 'checkin:done', { agency: data.agency.name })}</Alert>);
  }

  return page(<>
    <Stack direction='row' sx={{ gap: 2, alignItems: 'center' }}>
      {data.agency.logo_url && <img src={data.agency.logo_url} alt='' style={{ height: 56, borderRadius: 8 }} />}
      <Box>
        <Typography variant='h5' component='p' sx={{ fontWeight: 700 }}>{data.agency.name}</Typography>
        {data.agency.phone && <Typography dir='ltr' color='text.secondary'>{data.agency.phone}</Typography>}
      </Box>
    </Stack>
    <Typography variant='h6' component='h1'>{t('checkin:title')}</Typography>
    <Typography>{t('checkin:booking', { car: data.car.manufacturer + ' ' + data.car.model_name, start: formatDateTime(data.starts_at), end: formatDateTime(data.ends_at) })}</Typography>
    <Typography color='text.secondary'>{t('checkin:hint')}</Typography>

    <PersonFields value={person} onChange={setPerson} errors={fieldsOf(errors, 'client.')} />
    <PhotoInput label={data.documents.includes(11) ? 'checkin:id_photo:again' : 'checkin:id_photo'} value={idPhoto} onChange={setIdPhoto} />
    <PhotoInput label={data.documents.includes(12) ? 'checkin:licence_photo:again' : 'checkin:licence_photo'} value={licencePhoto} onChange={setLicencePhoto} />

    <FormControlLabel control={<Checkbox checked={hasDriver} onChange={event => setHasDriver(event.target.checked)} />} label={t('checkin:second_driver')} />
    {hasDriver && <PersonFields value={driver} onChange={setDriver} withPhone errors={fieldsOf(errors, 'second_driver.')} />}

    <Stack sx={{ gap: 1, alignItems: 'flex-start' }}>
      <Typography variant='h6' component='h2'>{t('checkin:sign:title')}</Typography>
      <Typography color='text.secondary'>{t('checkin:sign:hint')}</Typography>
      <Button startIcon={<Description />} href={data.contract_urls[pdfLang(selectedLang)]} target='_blank' rel='noopener'>{t('checkin:sign:read')}</Button>
      {data.signed_at && ! signature && <Typography color='success'>{t('checkin:signed', { date: formatDateTime(data.signed_at) })}</Typography>}
    </Stack>
    <SignatureField value={signature ?? data.signature} onChange={setSignature} label='checkin:sign:label' hint='checkin:sign:pad' />

    {save.isError && ! Object.keys(errors).length && <Alert severity='error'>{t('network:error')}</Alert>}
    <Button variant='contained' size='large' onClick={onSubmit} loading={save.isPending}>{t('checkin:send')}</Button>
  </>);
}
