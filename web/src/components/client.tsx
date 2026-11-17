import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, List, ListItemButton, ListItemText, Stack, TextField, Typography,
} from '@mui/material';
import Search from '@mui/icons-material/Search';
import PersonSearch from '@mui/icons-material/PersonSearch';
import RemoveCircleOutline from '@mui/icons-material/RemoveCircleOutlined';
import Flag from '@mui/icons-material/Flag';
import AccountBoxOutlined from '@mui/icons-material/AccountBoxOutlined';
import { ClientInput, index, show, store } from '../api/clients';
import Client, { BADGE_TONES, clientName, FLAGS } from '../classes/Client';
import { PHONE_REGEX } from '../constants';
import { useIsOwner, useLang, useT } from '../store/Store';
import { serverFieldErrors } from '../support/alert';
import { arrow, debounce, formatDate, formatLocalPhoneNumber, parseDmy, toDmy, toMaskedPhone } from '../support/utils';
import { useFeedback } from './Feedback';
import { Badge, Choice, DateInput, EntityLink, Info, Section, useMoney } from './common';

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

export const clientToForm = (client: Client): ClientFormValue => ({
  first_name: client.first_name,
  last_name: client.last_name,
  phone: toMaskedPhone(client.phone),
  gender: client.gender,
  birth_date: parseDmy(client.birth_date),
  id_number: client.id_number ?? '',
  driver_licence_number: client.driver_licence_number ?? '',
  driver_licence_delivery_date: parseDmy(client.driver_licence_delivery_date),
  driver_licence_expiry_date: parseDmy(client.driver_licence_expiry_date),
  flag: client.flag ?? 0,
  notes: client.notes ?? '',
  rentals_before: client.rentals_before ? String(client.rentals_before) : '',
});

export const formToClientInput = (value: ClientFormValue): ClientInput => ({
  first_name: value.first_name.trim(),
  last_name: value.last_name.trim(),
  phone: value.phone.replaceAll(' ', ''),
  gender: value.gender,
  birth_date: toDmy(value.birth_date),
  id_number: value.id_number.trim() || null,
  driver_licence_number: value.driver_licence_number.trim() || null,
  driver_licence_delivery_date: toDmy(value.driver_licence_delivery_date),
  driver_licence_expiry_date: toDmy(value.driver_licence_expiry_date),
  flag: (value.flag || null) as Client['flag'],
  notes: value.notes.trim() || null,
  rentals_before: parseInt(value.rentals_before, 10) || 0,
});

// Name and phone are required; only the phone can be taken by someone else.
export function clientFormErrors(value: ClientFormValue): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of [ 'first_name', 'last_name' ] as const) {
    if (! value[field].trim()) {
      errors[field] = 'validation:required';
    }
  }
  if (! PHONE_REGEX.test(value.phone)) {
    errors.phone = 'validation:phone:invalid';
  }
  return errors;
}
export const clientServerErrors = (error: unknown) => serverFieldErrors(error, 'validation:phone:used');

// Name and phone are enough to book; the rest is filled in at pickup.
export function ClientFields({ value, onChange, errors, withDetails = true }: { value: ClientFormValue, onChange: (value: ClientFormValue) => void, errors: Record<string, string>, withDetails?: boolean }) {
  const t = useT();
  const set = <K extends keyof ClientFormValue>(field: K) => (fieldValue: ClientFormValue[K]) => onChange({ ...value, [field]: fieldValue });
  const text = (field: 'first_name'|'last_name'|'phone'|'id_number'|'driver_licence_number'|'notes'|'rentals_before', label: string, extra: object = {}) =>
    <TextField label={t(label)} value={value[field]} onChange={event => set(field)(event.target.value)} error={!! errors[field]} helperText={errors[field] && t(errors[field])} {...extra} />;
  const today = new Date();

  return (
    <Stack sx={{ gap: 2.5 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
        {text('first_name', 'form:first_name:label', { required: true })}
        {text('last_name', 'form:last_name:label', { required: true })}
      </Stack>
      {text('phone', 'form:phone:label', { required: true, type: 'tel' })}
      {withDetails && <>
        <Choice label='form:gender:label' value={value.gender} onChange={set('gender')} options={[ { label: 'common:gender:1', value: 1 as const }, { label: 'common:gender:2', value: 2 as const } ]} />
        <DateInput label='form:birth_date:label' value={value.birth_date} onChange={set('birth_date')} max={today} />
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
          {text('id_number', 'form:id_number:label', { slotProps: { htmlInput: { inputMode: 'numeric' } } })}
          {text('driver_licence_number', 'form:driver_licence_number:label')}
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
          <DateInput label='form:driver_licence_delivery_date:label' value={value.driver_licence_delivery_date} onChange={set('driver_licence_delivery_date')} max={today} />
          <DateInput label='form:driver_licence_expiry_date:label' value={value.driver_licence_expiry_date} onChange={set('driver_licence_expiry_date')} />
        </Stack>
        {/* Blacklist: staff are warned when this person (or their ID or licence) is picked again. */}
        <Choice label='client:flag' value={value.flag} onChange={set('flag')} options={[ 0, ...FLAGS ].map(flag => ({ label: 'client:flag:' + flag, value: flag }))} />
        {text('notes', 'client:notes', { multiline: true, minRows: 2 })}
        {/* A regular client from before the app: known, not new. */}
        {text('rentals_before', 'client:rentals_before', { slotProps: { htmlInput: { inputMode: 'numeric' } } })}
      </>}
    </Stack>
  );
}

// What staff must know before renting to this person: blacklisted (flagged themselves, or the same
// phone, ID card or licence as a flagged client: people change numbers), and with `withBadge`, how
// reliable they have been (badge, balance, late returns), and the agency's rules they break (age,
// licence). Nothing for a clean new client.
export function ClientWarning({ clientId, withBadge = true }: { clientId?: number|null, withBadge?: boolean }) {
  const t = useT();
  const money = useMoney();
  const { data } = useQuery({ queryKey: ['client.show', { id: clientId }], queryFn: show, enabled: !! clientId });
  const stats = data?.stats;
  const showsBadge = withBadge && stats && stats.badge !== 'new';
  const issues = data?.eligibility ?? [];
  if (! data?.warnings?.length && ! showsBadge && ! issues.length) {
    return null;
  }

  return (
    <Stack sx={{ gap: 1 }}>
      {showsBadge && <Stack direction='row' sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Badge label={'client:badge:' + stats.badge} tone={BADGE_TONES[stats.badge]} />
        <Typography variant='body2' color='text.secondary'>{[
          t('client:stats:rentals', { count: stats.contracts_count + stats.rentals_before }), // with those on paper
          stats.outstanding ? t('client:stats:owes', { amount: money(stats.outstanding) }) : null,
          stats.late_returns ? t('client:stats:late', { count: stats.late_returns }) : null,
          stats.fines_unpaid ? t('client:stats:fines', { amount: money(stats.fines_unpaid) }) : null,
        ].filter(Boolean).join(' · ')}</Typography>
      </Stack>}
      {!! issues.length && <Alert severity='warning'>
        {issues.map(issue => <Box key={issue.code} sx={{ fontWeight: 600 }}>{t('client:eligibility:' + issue.code, issue)}</Box>)}
      </Alert>}
      {!! data?.warnings?.length && <Alert severity='error' icon={<Flag />}>
        {data.warnings.map(warning =>
          <Box key={warning.id}>
            <Typography component='span' sx={{ fontWeight: 700 }}>{t('client:flag:' + warning.flag)}</Typography>
            {! warning.matched_on.includes('self') && <Typography component='span'>
              {' · '}<EntityLink href={'/clients/' + warning.id}>{t('client:flag:match', { name: warning.first_name + ' ' + warning.last_name, fields: warning.matched_on.map(field => t('client:matched:' + field)).join(', ') })}</EntityLink>
            </Typography>}
            {warning.notes && <Typography variant='body2'>{warning.notes}</Typography>}
          </Box>
        )}
      </Alert>}
    </Stack>
  );
}

// What a client brought in and how they behave, since they were added (earlier rentals aren't in
// the app); the net is the owner's.
export function ClientStatsCard({ data }: { data: Client }) {
  const t = useT();
  const { isRtl } = useLang();
  const money = useMoney();
  const isOwner = useIsOwner();
  const stats = data.stats;
  if (! stats) {
    return null;
  }
  if (! stats.contracts_count) {
    return <Section>
      <Typography color='text.secondary'>{t('client:stats:none', { date: formatDate(data.created_at) })}</Typography>
      {stats.rentals_before > 0 && <Info label='client:stats:before' value={stats.rentals_before} />}
    </Section>;
  }
  return (
    <Section title='client:stats'>
      <Typography variant='body2' color='text.secondary'>{t('client:stats:counted_since', { date: formatDate(data.created_at) })}</Typography>
      <Info label='client:stats:contracts' value={stats.contracts_count} />
      {stats.rentals_before > 0 && <Info label='client:stats:before' value={stats.rentals_before} />}
      {stats.first_rental_at && <Info label='client:stats:since' value={formatDate(stats.first_rental_at) + arrow(isRtl) + formatDate(stats.last_rental_at!)} />}
      <Info label='client:stats:revenue' value={money(stats.revenue)} tone='ok' />
      <Info label='client:stats:average' value={money(stats.average_value) + ' · ' + stats.average_days + ' j'} />
      <Info label='client:stats:outstanding' value={money(stats.outstanding)} tone={stats.outstanding ? 'danger' : undefined} />
      {stats.fines_unpaid > 0 && <Info label='client:stats:fines_unpaid' value={money(stats.fines_unpaid)} tone='danger' />}
      {stats.damage_charged > 0 && <Info label='client:stats:damage' value={money(stats.damage_charged)} />}
      {stats.repair_costs > 0 && <Info label='client:stats:repairs' value={money(stats.repair_costs)} tone='warn' />}
      {stats.deposits_kept > 0 && <Info label='client:stats:deposits_kept' value={money(stats.deposits_kept)} />}
      <Info label='client:stats:late_returns' value={stats.late_returns ? stats.late_returns + ' · ' + stats.late_hours + ' h' : '0'} tone={stats.late_returns ? 'warn' : undefined} />
      {(stats.cancellations > 0 || stats.no_shows > 0) && <Info label='client:stats:cancellations' value={stats.cancellations + ' · ' + stats.no_shows} />}
      {isOwner && <Info label='client:stats:net' value={money(stats.net)} tone={stats.net < 0 ? 'danger' : 'ok'} bold />}
    </Section>
  );
}

export function ClientDetails({ data }: { data: Client }) {
  const t = useT();
  const row = (label: string, value: string|null) =>
    <Stack direction='row' sx={{ gap: 1, flexWrap: 'wrap' }}>
      <Typography sx={{ fontWeight: 600, minWidth: 200 }}>{t(label)}</Typography>
      <Typography>{value || '—'}</Typography>
    </Stack>;

  return (
    <Section>
      <ClientWarning clientId={data.id} />
      <Stack direction='row' sx={{ gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontWeight: 600, minWidth: 200 }}>{t('form:phone:label')}</Typography>
        <a dir='ltr' href={'tel:' + data.phone}>{formatLocalPhoneNumber(data.phone)}</a>
      </Stack>
      {row('form:gender:label', data.gender ? t('common:gender:' + data.gender) : null)}
      {row('form:birth_date:label', data.birth_date)}
      {row('form:id_number:label', data.id_number)}
      {row('form:driver_licence_number:label', data.driver_licence_number)}
      {row('form:driver_licence_delivery_date:label', data.driver_licence_delivery_date)}
      {row('form:driver_licence_expiry_date:label', data.driver_licence_expiry_date)}
      {data.notes && row('client:notes', data.notes)}
    </Section>
  );
}

export function ClientLine({ data }: { data: Client }) {
  const t = useT();
  return (
    <ListItemText
      primary={<Stack direction='row' sx={{ gap: 1, alignItems: 'center' }}>
        <span>{clientName(data)}</span>
        {data.flag && <Typography variant='body2' color='error' sx={{ fontWeight: 700 }}>{t('client:flag:' + data.flag)}</Typography>}
      </Stack>}
      secondary={<span dir='ltr'>{formatLocalPhoneNumber(data.phone)}</span>}
    />
  );
}

interface ClientPickerProps {
  value: Client|null,
  onChange: (client: Client) => void,
  onClear?: () => void, // shows a remove button (optional pickers, like the second driver)
  label?: string,
  error?: boolean,
}

// Pick an existing client by name or phone, or create one on the spot with just a name and phone.
export function ClientPicker({ value, onChange, onClear, label = 'client:label', error = false }: ClientPickerProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const { requestError } = useFeedback();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [search, setSearch] = useState('');
  const [newClient, setNewClient] = useState<ClientFormValue>(emptyClientForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const debouncedSetSearch = useMemo(() => debounce(setSearch, 400), []);
  const { data } = useQuery({ queryKey: ['client.index', { search }], queryFn: index, enabled: isOpen });

  const close = () => {
    setIsOpen(false);
    setIsCreating(false);
    setSearchValue('');
    setSearch('');
    setNewClient(emptyClientForm);
    setErrors({});
  };
  const select = (client: Client) => {
    onChange(client);
    close();
  };

  const create = useMutation({
    mutationFn: () => store(formToClientInput(newClient)),
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ['client.index'] });
      select(client);
    },
    onError: (requestFailure) => {
      const fieldErrors = clientServerErrors(requestFailure);
      setErrors(fieldErrors);
      if (! Object.keys(fieldErrors).length) {
        requestError(requestFailure);
      }
    },
  });
  const onCreate = () => {
    const fieldErrors = clientFormErrors(newClient);
    setErrors(fieldErrors);
    if (! Object.keys(fieldErrors).length) {
      create.mutate();
    }
  };

  return (
    <Box>
      <Typography variant='subtitle2' color={error ? 'error' : 'text.secondary'} sx={{ mb: 0.75 }}>{t(label)}</Typography>
      {value ?
        <Stack direction='row' sx={{ alignItems: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <ListItemButton onClick={() => setIsOpen(true)} sx={{ borderRadius: 2 }}><ClientLine data={value} /></ListItemButton>
          <IconButton color='primary' component={Link} href={'/clients/' + value.id} aria-label={clientName(value)}><AccountBoxOutlined /></IconButton>
          {onClear && <IconButton aria-label={t('common:remove')} onClick={onClear}><RemoveCircleOutline /></IconButton>}
        </Stack> :
        <Button variant='outlined' color={error ? 'error' : 'primary'} startIcon={<PersonSearch />} onClick={() => setIsOpen(true)}>{t('client:choose')}</Button>
      }

      <Dialog open={isOpen} onClose={close} fullWidth maxWidth='sm'>
        <DialogTitle>{t(isCreating ? 'client:new' : label)}</DialogTitle>
        <DialogContent sx={{ minHeight: 360 }}>
          {isCreating ?
            <Box sx={{ pt: 1 }}><ClientFields value={newClient} onChange={setNewClient} errors={errors} withDetails={false} /></Box> :
            <>
              <TextField
                autoFocus
                placeholder={t('common:search')}
                value={searchValue}
                onChange={event => {
                  setSearchValue(event.target.value);
                  debouncedSetSearch(event.target.value);
                }}
                sx={{ mt: 1 }}
                slotProps={{ input: { startAdornment: <InputAdornment position='start'><Search /></InputAdornment> } }}
              />
              <List>
                {data?.map(client => <ListItemButton key={client.id} onClick={() => select(client)}><ClientLine data={client} /></ListItemButton>)}
                {data?.length === 0 && <Typography color='text.secondary' sx={{ textAlign: 'center', py: 3 }}>{t('common:no_data')}</Typography>}
              </List>
            </>
          }
        </DialogContent>
        <DialogActions>
          <Button onClick={close}>{t('common:cancel')}</Button>
          {isCreating ?
            <Button variant='contained' onClick={onCreate} loading={create.isPending}>{t('common:save')}</Button> :
            <Button variant='outlined' onClick={() => setIsCreating(true)}>{t('client:new')}</Button>
          }
        </DialogActions>
      </Dialog>
    </Box>
  );
}
