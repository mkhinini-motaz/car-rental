import React from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Button, Card, CardActionArea, CardContent, CardMedia, Divider, IconButton, LinearProgress, Stack, Typography } from '@mui/material';
import DirectionsCarOutlined from '@mui/icons-material/DirectionsCarOutlined';
import DeleteOutline from '@mui/icons-material/DeleteOutlined';
import { destroy } from '../api/expense';
import { destroyIncome, MONEY_QUERIES } from '../api/money';
import Car, { carState, STATUS_AVAILABLE } from '../classes/Car';
import Expense, { MAINTENANCE_CATEGORIES } from '../classes/Expense';
import Income from '../classes/Income';
import { COLORS } from '../constants';
import { useIsOwner, useT } from '../store/Store';
import { todayBounds } from '../support/day';
import { formatDate, plate } from '../support/utils';
import { useFeedback } from './Feedback';
import { Badge, EntityLink, Info, OpenArea, Section, useMoney } from './common';

// Common car colours; swatches need no translation.
export const CAR_COLOURS = [
  '#f5f5f5', '#1f1f1f', '#9e9e9e', '#c0c0c0', '#b71c1c', '#1565c0',
  '#0d2c54', '#2e7d32', '#d7c4a3', '#6d4c41', '#ef6c00', '#fbc02d',
];

export const isSwatch = (colour: string|null) => !! colour && colour.startsWith('#');

export const PAPERS = [ 'insurance_ends_at', 'circulation_tax_ends_at', 'technical_control_ends_at' ] as const;

function Swatch({ colour }: { colour: string|null }) {
  const t = useT();
  if (! colour) {
    return null;
  }
  return isSwatch(colour) ?
    <Box role='img' aria-label={t('car:colour:' + colour.slice(1))} title={t('car:colour:' + colour.slice(1))} sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: colour, border: '1px solid', borderColor: 'text.disabled', flexShrink: 0 }} /> :
    <Typography variant='body2' sx={{ fontStyle: 'italic' }} color='text.secondary'>{colour}</Typography>;
}

// With `link`, the name opens the car's page (inside a contract card, a fine...).
export function CarName({ data, withPlate = false, link = false }: { data: Car, withPlate?: boolean, link?: boolean }) {
  const t = useT();
  const name = <Typography sx={{ fontWeight: 600 }}>{data.manufacturer} {data.model_name} {data.model_year}</Typography>;
  return (
    <Stack direction='row' sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <DirectionsCarOutlined fontSize='small' color='action' />
      {link ? <EntityLink href={'/cars/' + data.id}>{name}</EntityLink> : name}
      <Swatch colour={data.colour} />
      {withPlate && <Typography variant='body2' sx={{ fontVariantNumeric: 'tabular-nums', bgcolor: 'action.hover', px: 0.75, borderRadius: 1 }}>{plate(data.licence_plate)}</Typography>}
      {data.status !== STATUS_AVAILABLE && <Typography variant='body2' sx={{ fontWeight: 700 }} color='error'>{t('car:status:' + data.status)}</Typography>}
    </Stack>
  );
}

// Where the car is now: out (back when), overdue, blocked, in maintenance, sold, or free.
export function CarStateBadge({ data }: { data: Car }) {
  if (data.sold_at) {
    return <Badge label='car:sold:on' params={{ date: formatDate(data.sold_at) }} />;
  }
  const state = carState(data, Date.now() / 1000, todayBounds()[1]);
  return <Badge label={state.label} params={state.params as Record<string, any>} tone={state.tone} />;
}

// The fleet list's card: photo, plate, model, where it is now, its price.
export function CarCard({ data, href }: { data: Car, href: string }) {
  const t = useT();
  const money = useMoney();
  return (
    <Card sx={{ height: '100%' }}>
      <CardActionArea component={Link} href={href} sx={{ height: '100%', display: 'block' }}>
        {data.photo_url ?
          <CardMedia component='img' image={data.photo_url} alt='' loading='lazy' sx={{ height: 160, objectFit: 'cover' }} /> :
          <Box sx={{ height: 90, bgcolor: 'action.hover', display: 'grid', placeItems: 'center' }}><DirectionsCarOutlined color='disabled' fontSize='large' /></Box>}
        <CardContent>
          <Stack direction='row' sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
            <Typography variant='h6' sx={{ letterSpacing: 0.5 }}>{plate(data.licence_plate)}</Typography>
            <CarStateBadge data={data} />
          </Stack>
          <Stack direction='row' sx={{ gap: 1, alignItems: 'center' }}>
            <Typography color='text.secondary'>{data.manufacturer} {data.model_name} · {data.model_year}</Typography>
            <Swatch colour={data.colour} />
          </Stack>
          <Typography sx={{ fontWeight: 600, mt: 0.5 }}>{t('car:daily_price', { price: money(data.daily_price) })}</Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

// The car page's card: photo, where it is, price, odometer and the next oil change.
export function CarDetails({ data }: { data: Car }) {
  const t = useT();
  const money = useMoney();
  const oilChange = data.oil_change;
  // Due with none recorded: an old car's last one is unknown until it's entered.
  const isOilUnknown = !! oilChange && oilChange.last_at === null && oilChange.is_due;

  return (
    <Card>
      {data.photo_url && <CardMedia component='img' image={data.photo_url} alt='' sx={{ height: 200, objectFit: 'cover' }} />}
      <CardContent>
        <Stack direction='row' sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
          <Typography variant='h5' sx={{ letterSpacing: 0.5 }}>{plate(data.licence_plate)}</Typography>
          <CarStateBadge data={data} />
        </Stack>
        <Stack direction='row' sx={{ gap: 1, alignItems: 'center', mb: 1 }}>
          <Typography>{data.manufacturer} {data.model_name} · {data.model_year}</Typography>
          <Swatch colour={data.colour} />
        </Stack>
        <Info label='contract:daily_price' value={money(data.daily_price)} />
        {data.mileage !== null && <Info label='car:mileage' value={data.mileage.toLocaleString('fr-FR')} />}
        <Info label='car:fuel_type' value={t('car:fuel_type:' + data.fuel_type)} />
        <Info label='car:transmission_type' value={t('car:transmission_type:' + data.transmission_type)} />
        <Info label='car:first_circulation_date' value={data.first_circulation_date} />
        <Info
          label='car:oil_change'
          value={isOilUnknown ? t('car:oil_change:unknown') : oilChange ? (oilChange.due_mileage === null ? formatDate(oilChange.due_at) : oilChange.due_mileage + ' km · ' + formatDate(oilChange.due_at)) : '—'}
          tone={oilChange?.is_due ? 'danger' : undefined}
        />
      </CardContent>
    </Card>
  );
}

function useInvalidateMoney() {
  const queryClient = useQueryClient();
  return () => MONEY_QUERIES.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
}

export function useDeleteExpense() {
  const invalidate = useInvalidateMoney();
  const { confirm, requestError } = useFeedback();
  const { mutate } = useMutation({ mutationFn: destroy, onSuccess: invalidate, onError: requestError });
  return async (id: number) => await confirm('expense:delete:confirm') && mutate(id);
}

function useDeleteIncome() {
  const invalidate = useInvalidateMoney();
  const { confirm, requestError } = useFeedback();
  const { mutate } = useMutation({ mutationFn: destroyIncome, onSuccess: invalidate, onError: requestError });
  return async (id: number) => await confirm('income:delete:confirm') && mutate(id);
}

// One money line: what, the date and details, the amount, and a delete button for the owner.
function MoneyRow({ title, details, amount, colour, onDelete, href }: { title: string, details: string, amount: string, colour?: string, onDelete?: () => void, href?: string }) {
  const t = useT();
  const row = (
    <Stack direction='row' sx={{ alignItems: 'center', gap: 1.5, py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant='body2' sx={{ fontWeight: 600 }}>{title}</Typography>
        <Typography variant='caption' color='text.secondary' noWrap component='div'>{details}</Typography>
      </Box>
      <Typography variant='body2' sx={{ fontWeight: 700, whiteSpace: 'nowrap', color: colour }}>{amount}</Typography>
      {onDelete && <IconButton size='small' color='error' aria-label={t('common:delete')} onMouseDown={event => event.stopPropagation()} onClick={event => {
        event.stopPropagation();
        onDelete();
      }}><DeleteOutline fontSize='small' /></IconButton>}
    </Stack>
  );
  return href ? <OpenArea href={href}>{row}</OpenArea> : row;
}

// A car's expense opens the car, except on the car's own page (`opensCar` false).
export function ExpenseRow({ data, onDelete, opensCar = true }: { data: Expense, onDelete?: () => void, opensCar?: boolean }) {
  const t = useT();
  const money = useMoney();
  const details = [
    formatDate(data.spent_at), data.car && plate(data.car.licence_plate), data.branch?.name, data.employee?.first_name,
    data.mileage !== null && MAINTENANCE_CATEGORIES.includes(data.category) ? data.mileage + ' km' : null, data.garage, data.note,
  ].filter(Boolean).join(' · ');
  return <MoneyRow title={t('expense:category:' + data.category)} details={details} amount={money(data.amount)} onDelete={onDelete} href={opensCar && data.car_id ? '/cars/' + data.car_id : undefined} />;
}

// A share of 1 as a bar (payback, utilisation).
export function Bar({ ratio, colour = COLORS.primary }: { ratio: number, colour?: string }) {
  return <LinearProgress variant='determinate' value={Math.max(1, Math.min(100, ratio * 100))} sx={{ height: 8, borderRadius: 4, bgcolor: COLORS.line, '& .MuiLinearProgress-bar': { bgcolor: colour, borderRadius: 4 } }} />;
}

// The car's life in money, for the owner: what it cost (purchase, fees, interest, running costs),
// how much of that its rentals earned back, its credit, when it must leave the fleet, and this month.
export function CarMoneyCards({ data, onEditPurchase }: { data: Car, onEditPurchase: () => void }) {
  const t = useT();
  const money = useMoney();
  const report = data.money;
  if (! report) {
    return null;
  }
  const now = Date.now() / 1000;
  const financing = report.financing;
  const payback = report.payback;
  const deadlineTone = report.months_left === null ? undefined : report.months_left < 0 ? 'danger' as const : report.months_left < 6 ? 'warn' as const : undefined;

  return <>
    <Section title='car:money:cost'>
      {report.purchase_price === null ? <>
        <Typography color='text.secondary'>{t('car:money:no_price')}</Typography>
        <Box><Button variant='outlined' size='small' onClick={onEditPurchase}>{t('car:purchase')}</Button></Box>
      </> : <>
        <Info label='car:purchase_price' value={money(report.purchase_price)} />
        {report.purchase_fees > 0 && <Info label='car:purchase_fees' value={money(report.purchase_fees)} />}
        {report.interest > 0 && <Info label='car:money:interest' value={money(report.interest)} />}
      </>}
      {(Object.keys(report.costs) as (keyof typeof report.costs)[]).filter(group => report.costs[group] > 0).map(group =>
        <Info key={group} label={'car:money:cost:' + group} value={money(report.costs[group])} />
      )}
      <Divider />
      <Info label='car:money:total_cost' value={money(report.total_cost)} bold />
    </Section>

    <Section title='car:money:payback'>
      {!! report.history_since && <Typography variant='body2' sx={{ color: COLORS.warn }}>{t('car:money:history_since', { date: formatDate(report.history_since) })}</Typography>}
      <Info label='car:money:earned' value={money(report.earned)} tone='ok' />
      {report.earned_before > 0 && <Info label='car:money:earned_before' value={money(report.earned_before)} />}
      {report.other_income > 0 && <Info label='car:money:other_income' value={money(report.other_income)} tone='ok' />}
      {payback !== null && <>
        <Info label='car:money:total_cost' value={money(report.total_cost)} />
        <Bar ratio={payback} colour={payback >= 1 ? COLORS.ok : COLORS.info} />
        <Info label='car:money:payback:percent' value={Math.round(payback * 100) + ' %'} bold />
        {payback >= 1 && <Typography sx={{ color: COLORS.ok }}>{t('car:money:paid_off')}</Typography>}
        <Info label='car:money:monthly_earned' value={money(report.monthly_earned)} />
      </>}
      {data.sold_at && <>
        <Divider />
        <Info label='car:sale:price' value={money(data.sale_price ?? 0)} />
        <Info label='car:money:result' value={money(report.result)} tone={report.result < 0 ? 'danger' : 'ok'} bold />
      </>}
    </Section>

    {financing && <Section title='car:financing'>
      <Info label='car:financing:paid' value={financing.paid + ' / ' + financing.months} />
      <Info label='car:financing:instalment' value={money(financing.amount)} />
      <Info label='car:financing:remaining' value={money(financing.remaining)} bold />
      {financing.next_due_at && <Info label='car:financing:next' value={formatDate(financing.next_due_at)} tone={financing.next_due_at < now + 7 * 24 * 3600 ? 'warn' : undefined} />}
      <Info label='car:financing:ends' value={formatDate(financing.ends_at)} />
      {financing.lender && <Info label='car:lender' value={financing.lender} />}
    </Section>}

    <Section title='car:money:this_month'>
      <Info label='car:money:days_rented' value={report.this_month.days_rented} />
      <Info label='car:money:idle_days' value={report.this_month.idle_days} />
      <Info label='car:money:maintenance_days' value={report.this_month.maintenance_days} />
      {report.cost_per_km !== null && <Info label='car:money:cost_per_km' value={money(report.cost_per_km)} />}
      {report.fleet_deadline && ! data.sold_at && <>
        <Divider />
        <Info label='car:fleet_deadline' value={formatDate(report.fleet_deadline)} tone={deadlineTone} bold />
        <Typography variant='body2' color='text.secondary'>{t(report.months_left! < 0 ? 'car:fleet_deadline:passed' : 'car:fleet_deadline:months', { months: report.months_left })}</Typography>
        {data.expected_sale_price ? <Info label='car:expected_sale_price' value={money(data.expected_sale_price)} /> : null}
      </>}
    </Section>
  </>;
}

// The car's expenses and other income, newest first; the owner can remove them.
export function CarMoneyLists({ data }: { data: Car }) {
  const t = useT();
  const money = useMoney();
  const isOwner = useIsOwner();
  const deleteExpense = useDeleteExpense();
  const deleteIncome = useDeleteIncome();

  return <>
    <Section title='expense:label'>
      {data.expenses?.length ?
        data.expenses.map(expense => <ExpenseRow key={expense.id} data={expense} opensCar={false} onDelete={isOwner ? () => deleteExpense(expense.id) : undefined} />) :
        <Typography color='text.secondary'>{t('common:no_data')}</Typography>}
    </Section>
    {isOwner && !! data.incomes?.length && <Section title='income:label'>
      {data.incomes.map((income: Income) => <MoneyRow
        key={income.id}
        title={t('income:category:' + income.category)}
        details={[ formatDate(income.received_at), income.note ].filter(Boolean).join(' · ')}
        amount={money(income.amount)}
        colour={COLORS.ok}
        onDelete={() => deleteIncome(income.id)}
      />)}
    </Section>}
  </>;
}
