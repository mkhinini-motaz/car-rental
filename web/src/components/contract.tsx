import React, { useState } from 'react';
import Link from 'next/link';
import { Box, Button, Card, CardContent, Chip, IconButton, Stack, TextField, Typography } from '@mui/material';
import Add from '@mui/icons-material/Add';
import RemoveCircleOutline from '@mui/icons-material/RemoveCircleOutlined';
import Place from '@mui/icons-material/Place';
import PersonOutline from '@mui/icons-material/PersonOutlined';
import EngineeringOutlined from '@mui/icons-material/EngineeringOutlined';
import { Pricing, useAgency } from '../api/agency';
import { staffName } from '../classes/Agency';
import Contract, { Extra, remainingRent, SOURCE_BROKER, SOURCES, STATUS_OUT, STATUS_RESERVED } from '../classes/Contract';
import { STAGE_PICKUP, STAGE_RETURN } from '../classes/Inspection';
import { COLORS, Tone } from '../constants';
import { useT } from '../store/Store';
import { commissionFromInput, priceInputFromMillimes } from '../support/money';
import { diffInDays, formatDate, formatDateTime, formatLocalPhoneNumber, formatTime, plate } from '../support/utils';
import { CarName } from './car';
import { Badge, Choice, ClientLink, EntityLink, OpenArea, useMoney } from './common';

// The phone app's: reserved (in ink, as on a paper planning), out, returned (to settle), closed,
// cancelled. The planning bars use them too; none is the agency's brand colour, which may be any.
export const STATUS_TONES: Record<number, Tone> = { 1: 'ink', 2: 'info', 3: 'warn', 4: 'ok', 5: 'muted' };

export function ContractStatus({ status }: { status: number }) {
  return <Badge label={'contract:status:' + status} tone={STATUS_TONES[status]} />;
}

function Clickable({ href, children }: { href?: string, children: React.ReactNode }) {
  return (
    <Card sx={{ mb: 1.5 }}>
      {href ? <OpenArea href={href}><CardContent>{children}</CardContent></OpenArea> : <CardContent>{children}</CardContent>}
    </Card>
  );
}

// A contract summary: status, car, client, places, dates and price.
export function ContractCard({ data, href }: { data: Contract, href?: string }) {
  const t = useT();
  const money = useMoney();
  const days = diffInDays(data.starts_at, data.ends_at);

  return (
    <Clickable href={href}>
      <Stack sx={{ gap: 0.5 }}>
        <ContractStatus status={data.status} />
        {data.car && <CarName data={data.car} withPlate link />}
        {data.client && <Stack direction='row' sx={{ gap: 1, alignItems: 'center' }}><PersonOutline fontSize='small' color='action' /><ClientLink data={data.client} /></Stack>}
        {data.second_driver && <Typography>{t('driver:second')}: <ClientLink data={data.second_driver} /></Typography>}
        {data.pickup_location && <Typography>{t('location:pickup:value', { place: data.pickup_location })}</Typography>}
        {data.return_location && <Typography>{t('location:return:value', { place: data.return_location })}</Typography>}
        <Typography>{t('car:contract:starts_at', { date: formatDateTime(data.starts_at) })}</Typography>
        <Typography>{t('car:contract:ends_at', { date: formatDateTime(data.ends_at) })}</Typography>
        <Typography>{t('car:daily_price', { price: money(data.daily_price) })} · {t('client:days_rented', { days })} · <b>{money(data.total_price)}</b></Typography>
        {!! data.source && <Typography>{t('contract:source')}: {t('contract:source:' + data.source)}{data.broker ? ' · ' + data.broker : ''}{data.commission > 0 ? ' · ' + money(data.commission) : ''}</Typography>}
        {!! data.note && <Typography sx={{ fontStyle: 'italic' }}>{data.note}</Typography>}
      </Stack>
    </Clickable>
  );
}

interface ContractRowProps {
  data: Contract,
  timeLabel: string, // e.g. 'contract:ends_at:value', with ${date}
  time: number,
  location?: string|null, // where to hand the car over or collect it, when not at the agency
  isLate?: boolean,
}

// A contract in a to-do list: the car, the client and their phone, when, and the rent still owed.
export function ContractRow({ data, timeLabel, time, location, isLate = false }: ContractRowProps) {
  const t = useT();
  const money = useMoney();
  const remaining = data.paid === undefined ? 0 : remainingRent(data);

  return (
    <Clickable href={'/contracts/' + data.id}>
      <Stack sx={{ gap: 0.5 }}>
        {data.car && <CarName data={data.car} withPlate link />}
        {data.client && <Stack direction='row' sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <PersonOutline fontSize='small' color='action' />
          <ClientLink data={data.client} />
          <Typography dir='ltr' color='primary'>{formatLocalPhoneNumber(data.client.phone)}</Typography>
        </Stack>}
        <Typography color={isLate ? 'error' : undefined} sx={{ fontWeight: isLate ? 700 : 400 }}>{t(timeLabel, { date: formatDateTime(time) })}</Typography>
        {location && <Stack direction='row' sx={{ gap: 0.5, alignItems: 'center', color: 'warning.dark' }}>
          <Place fontSize='small' />
          <Typography sx={{ fontWeight: 600 }}>{location}</Typography>
        </Stack>}
        {remaining > 0 && <Typography color='error' sx={{ fontWeight: 700 }}>{t('payment:remaining:value', { amount: money(remaining) })}</Typography>}
      </Stack>
    </Clickable>
  );
}

// The extras sold with a rental: added from the agency's list (its price at that moment), removable.
export interface SourceValue {
  source: number|null,
  broker: string,
  commission: string, // dinars, or a percentage of the total: '10%'
}

export const emptySource: SourceValue = { source: null, broker: '', commission: '' };

export const sourceOf = (contract: Contract): SourceValue => ({
  source: contract.source,
  broker: contract.broker ?? '',
  commission: contract.commission ? priceInputFromMillimes(contract.commission) : '',
});

// The API's fields, or null when the broker's name or the commission can't be used.
export function sourceInput(value: SourceValue, total: number): { source: number|null, broker: string|null, commission: number }|null {
  if (value.source !== SOURCE_BROKER) {
    return { source: value.source, broker: null, commission: 0 };
  }
  const commission = commissionFromInput(value.commission, total);
  return value.broker.trim() && commission !== null ? { source: value.source, broker: value.broker.trim(), commission } : null;
}

// Where the booking came from; a broker (hotel, travel agency, courtier) is named with the
// commission they take, typed in dinars or as a share of the total.
export function SourceField({ value, onChange, error = false }: { value: SourceValue, onChange: (value: SourceValue) => void, error?: boolean }) {
  const t = useT();
  return (
    <Stack sx={{ gap: 2 }}>
      <Choice label='contract:source' value={value.source} onChange={source => onChange({ ...value, source })} options={SOURCES.map(source => ({ label: 'contract:source:' + source, value: source as number|null }))} />
      {value.source === SOURCE_BROKER && <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
        <TextField label={t('contract:broker')} value={value.broker} onChange={event => onChange({ ...value, broker: event.target.value })} error={error && ! value.broker.trim()} sx={{ flex: 1 }} />
        <TextField label={t('contract:commission')} value={value.commission} onChange={event => onChange({ ...value, commission: event.target.value })} error={error && !! value.broker.trim()} sx={{ flex: 1 }} />
      </Stack>}
    </Stack>
  );
}

export function ExtrasField({ value, onChange, catalogue, days }: { value: Extra[], onChange: (extras: Extra[]) => void, catalogue: Extra[], days: number }) {
  const t = useT();
  const money = useMoney();
  if (! catalogue.length && ! value.length) {
    return null;
  }

  return (
    <Box>
      <Typography variant='subtitle2' color='text.secondary' sx={{ mb: 0.75 }}>{t('extra:label')}</Typography>
      {value.map((extra, index) =>
        <Stack key={index} direction='row' sx={{ alignItems: 'center', gap: 1 }}>
          <Typography sx={{ flex: 1 }}>{extra.name}</Typography>
          <Typography>{t(extra.per === 'day' ? 'extra:per_day' : 'extra:per_rental', { price: money(extra.price), total: money(Math.round(extra.per === 'day' ? extra.price * days : extra.price)) })}</Typography>
          <IconButton size='small' color='error' aria-label={t('common:remove')} onClick={() => onChange(value.filter((_extra, itemIndex) => itemIndex !== index))}><RemoveCircleOutline fontSize='small' /></IconButton>
        </Stack>
      )}
      <Stack direction='row' sx={{ flexWrap: 'wrap', gap: 1, mt: 1 }}>
        {catalogue.map((extra, index) => <Chip key={index} icon={<Add />} label={extra.name} variant='outlined' color='primary' onClick={() => onChange([ ...value, extra ])} />)}
      </Stack>
    </Box>
  );
}

// Where the car is handed over or taken back: the agency, one of its delivery places (airport,
// hotel) with its fee, or any other address typed in.
export function LocationField({ label, value, onChange, locations }: { label: string, value: string|null, onChange: (location: string|null) => void, locations: Pricing['locations'] }) {
  const t = useT();
  const money = useMoney();
  const [isTyping, setIsTyping] = useState(false);
  const isListed = locations.some(location => location.name === value);
  const showsInput = isTyping || (value !== null && ! isListed);
  const chip = (text: string, isSelected: boolean, onClick: () => void, key: string) =>
    <Chip key={key} label={text} color={isSelected ? 'primary' : 'default'} variant={isSelected ? 'filled' : 'outlined'} aria-pressed={isSelected} onClick={onClick} />;

  return (
    <Box>
      <Typography variant='subtitle2' color='text.secondary' sx={{ mb: 0.75 }}>{t(label)}</Typography>
      <Stack direction='row' sx={{ flexWrap: 'wrap', gap: 1 }}>
        {chip(t('location:agency'), value === null && ! isTyping, () => { setIsTyping(false); onChange(null); }, 'agency')}
        {locations.map(location => chip(
          location.name + (location.fee ? ' · ' + money(location.fee) : ''),
          value === location.name,
          () => { setIsTyping(false); onChange(location.name); },
          location.name,
        ))}
        {chip(t('location:other'), showsInput, () => { setIsTyping(true); onChange(isListed ? '' : value ?? ''); }, 'other')}
      </Stack>
      {showsInput && <TextField
        sx={{ mt: 1.5 }}
        value={value ?? ''}
        onChange={event => onChange(event.target.value)}
        placeholder={t('location:address')}
        autoFocus={isTyping}
        slotProps={{ htmlInput: { maxLength: 100 } }}
      />}
    </Box>
  );
}

const HOUR = 60 * 60;

// Where a car is in its day: going out (booked, late, handed over) or coming back (due, overdue, back).
export function movementState(data: Contract, direction: 'out'|'back', now: number): { label: string, tone: Tone, isPending: boolean } {
  if (direction === 'out') {
    if (data.status !== STATUS_RESERVED) {
      return { label: 'movement:handed_over', tone: 'ok', isPending: false };
    }
    return data.starts_at < now ? { label: 'movement:late', tone: 'danger', isPending: true } :
      data.starts_at < now + HOUR ? { label: 'movement:due_now', tone: 'warn', isPending: true } :
      { label: 'movement:ready', tone: 'info', isPending: true };
  }
  if (data.status !== STATUS_OUT) {
    return { label: 'movement:back', tone: 'ok', isPending: false };
  }
  return data.ends_at < now ? { label: 'movement:overdue', tone: 'danger', isPending: true } :
    data.ends_at < now + HOUR ? { label: 'movement:due_now', tone: 'warn', isPending: true } :
    { label: 'movement:later', tone: 'info', isPending: true };
}

// A car going out or coming back: the time and plate large, the client and place, what is still
// owed, and the handover one click away.
export function MovementRow({ data, direction, showDate = false }: { data: Contract, direction: 'out'|'back', showDate?: boolean }) {
  const t = useT();
  const money = useMoney();
  const state = movementState(data, direction, Date.now() / 1000);
  const time = direction === 'out' ? (data.picked_up_at ?? data.starts_at) : (data.returned_at ?? data.ends_at);
  const location = direction === 'out' ? data.pickup_location : data.return_location;
  const owed = data.paid === undefined ? 0 : remainingRent(data);
  const car = data.car;
  const stage = direction === 'out' ? STAGE_PICKUP : STAGE_RETURN;
  const { data: agency } = useAgency();
  const assignee = agency?.staff?.find(user => user.id === (direction === 'out' ? data.pickup_user_id : data.return_user_id));

  return (
    <Card sx={{ mb: 1.5 }}>
      <OpenArea href={'/contracts/' + data.id}>
        <CardContent>
          <Stack direction='row' sx={{ gap: 2 }}>
            <Box sx={{ width: 64, textAlign: 'center', flexShrink: 0 }}>
              {showDate && <Typography variant='caption' color='text.secondary'>{formatDate(time).slice(0, 5)}</Typography>}
              <Typography sx={{ fontSize: 20, fontWeight: 700, color: state.tone === 'danger' ? COLORS.danger : undefined }}>{formatTime(time)}</Typography>
            </Box>
            <Stack sx={{ flex: 1, minWidth: 0, gap: 0.5 }}>
              <Stack direction='row' sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                {car && <EntityLink href={'/cars/' + car.id}><Typography sx={{ fontSize: 20, fontWeight: 700, letterSpacing: 0.5 }} noWrap>{plate(car.licence_plate)}</Typography></EntityLink>}
                <Badge label={state.label} tone={state.tone} />
              </Stack>
              {car && <Typography>{car.manufacturer} {car.model_name}</Typography>}
              {data.client && <Stack direction='row' sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <PersonOutline fontSize='small' color='action' />
                <ClientLink data={data.client} />
                <Typography dir='ltr' color='primary'>{formatLocalPhoneNumber(data.client.phone)}</Typography>
              </Stack>}
              {location && <Stack direction='row' sx={{ gap: 0.5, alignItems: 'center', color: COLORS.warn }}>
                <Place fontSize='small' />
                <Typography sx={{ fontWeight: 600 }}>{location}</Typography>
              </Stack>}
              {assignee && <Stack direction='row' sx={{ gap: 0.5, alignItems: 'center' }}>
                <EngineeringOutlined fontSize='small' color='action' />
                <Typography color='text.secondary'>{staffName(assignee)}</Typography>
              </Stack>}
              {owed > 0 && <Typography sx={{ fontWeight: 700, color: COLORS.danger }}>{t('payment:remaining:value', { amount: money(owed) })}</Typography>}
            </Stack>
          </Stack>
        </CardContent>
      </OpenArea>
      {state.isPending && <Box sx={{ pr: 2, pb: 2, pl: 11 }}>
        <Button size='small' variant='contained' component={Link} href={`/contracts/${data.id}/handover?stage=${stage}`}>{t(direction === 'out' ? 'handover:pickup' : 'handover:return')}</Button>
      </Box>}
    </Card>
  );
}
