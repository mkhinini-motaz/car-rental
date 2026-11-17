import React, { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Button, Card, CardActionArea, CardContent, Checkbox, Chip, Grid, List, ListItemButton, ListItemText, Stack, Typography } from '@mui/material';
import { dashboard, useAgency } from '../src/api/agency';
import { invalidateContractQueries, markCleaned } from '../src/api/contract';
import { store as storeExpense } from '../src/api/expense';
import { staffName } from '../src/classes/Agency';
import { MONEY_QUERIES, payBill } from '../src/api/money';
import Employee, { employeeName } from '../src/classes/Employee';
import { CATEGORY_INSTALMENT } from '../src/classes/Expense';
import { COLORS, Tone } from '../src/constants';
import { useIsOwner, useT, useUser } from '../src/store/Store';
import { todayBounds } from '../src/support/day';
import { formatDate, formatDateTime, plate } from '../src/support/utils';
import { PAPERS } from '../src/components/car';
import { MovementRow, movementState } from '../src/components/contract';
import { Badge, Choice, Empty, Loading, Page, Section, useMoney } from '../src/components/common';
import { useFeedback } from '../src/components/Feedback';
import { PayHowDialog, SalaryDialog } from '../src/components/moneyDialogs';

// Day strip: [ first day from today, number of days ].
const RANGES = { yesterday: [ -1, 1 ], today: [ 0, 1 ], tomorrow: [ 1, 1 ], week: [ 0, 7 ] } as const;
type Range = keyof typeof RANGES;
const DAY = 24 * 60 * 60;

// Days are counted on the calendar, so a daylight-saving change doesn't shift them.
const rangeBounds = (range: Range): [number, number] => {
  const [ first, count ] = RANGES[range];
  const now = new Date();
  return [
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + first).getTime() / 1000,
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + first + count).getTime() / 1000,
  ];
};

function Stat({ label, value, tone, href, onClick }: { label: string, value: React.ReactNode, tone: Tone, href?: string, onClick?: () => void }) {
  const t = useT();
  const content = <CardContent>
    <Typography sx={{ fontSize: 28, fontWeight: 700, color: COLORS[tone] }}>{value}</Typography>
    <Typography color='text.secondary'>{t(label)}</Typography>
  </CardContent>;
  return <Card sx={{ height: '100%' }}>{href ? <CardActionArea component={Link} href={href} sx={{ height: '100%' }}>{content}</CardActionArea> : <CardActionArea onClick={onClick} sx={{ height: '100%' }}>{content}</CardActionArea>}</Card>;
}

function Row({ title, subtitle, meta, onClick, href }: { title: React.ReactNode, subtitle?: React.ReactNode, meta?: React.ReactNode, onClick?: () => void, href?: string }) {
  return (
    <ListItemButton divider {...(href ? { component: Link, href } : { onClick })}>
      <ListItemText primary={title} secondary={subtitle} slotProps={{ secondary: { component: 'div' } }} />
      <Box sx={{ ml: 2, flexShrink: 0, fontWeight: 700 }}>{meta}</Box>
    </ListItemButton>
  );
}

// The agency's day, as the notebook had it: which car goes out and which comes back, in time
// order, with the handover one click away; cars to check and money to pay. Tomorrow and the week
// are on the day strip.
export default function TodayPage() {
  const t = useT();
  const isOwner = useIsOwner();
  const money = useMoney();
  const queryClient = useQueryClient();
  const { requestError } = useFeedback();
  const [range, setRange] = useState<Range>('today');
  const [onlyMine, setOnlyMine] = useState(false); // the pickups, returns and cleaning given to me
  const me = useUser()?.id;
  const [paying, setPaying] = useState<{ title: string, action: (method: number) => Promise<unknown> }|null>(null);
  const [salary, setSalary] = useState<{ employee: Employee, due: number }|null>(null);
  const [ todayStart, todayEnd ] = todayBounds();
  const [ starts_at, ends_at ] = range === 'today' ? [ todayStart, todayEnd ] : rangeBounds(range);
  const today = useQuery({ queryKey: ['dashboard', { starts_at: todayStart, ends_at: todayEnd }], queryFn: dashboard });
  const selected = useQuery({ queryKey: ['dashboard', { starts_at, ends_at }], queryFn: dashboard });
  const { data: agency } = useAgency();
  const data = selected.data && (onlyMine ? {
    ...selected.data,
    pickups: selected.data.pickups.filter(contract => contract.pickup_user_id === me),
    returns: selected.data.returns.filter(contract => contract.return_user_id === me),
    to_clean: selected.data.to_clean.filter(contract => contract.return_user_id === me),
  } : selected.data);
  const now = Date.now() / 1000;
  const expiryLimit = now + (agency?.expiry_warning_days ?? 7) * DAY;
  // Paying is always a click and a confirmation: nothing is paid by itself.
  const clean = useMutation({
    mutationFn: (contractId: number) => markCleaned(contractId, true),
    onSuccess: () => invalidateContractQueries(queryClient),
    onError: requestError,
  });
  const pay = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: () => MONEY_QUERIES.forEach(key => queryClient.invalidateQueries({ queryKey: [key] })),
    onError: requestError,
  });
  const dueBackToday = today.data?.returns.filter(contract => movementState(contract, 'back', now).label !== 'movement:back' && contract.ends_at >= now).length ?? 0;

  const list = (title: string, direction: 'out'|'back') => {
    const contracts = (direction === 'out' ? data?.pickups : data?.returns) ?? [];
    return <>
      <Typography variant='h6' sx={{ mb: 1 }}>{t(title, { count: contracts.length })}</Typography>
      {contracts.length ?
        contracts.map(contract => <MovementRow key={contract.id} data={contract} direction={direction} showDate={range === 'week'} />) :
        <Typography color='text.secondary' sx={{ mb: 2 }}>{t(direction === 'out' ? 'movement:none:out' : 'movement:none:back')}</Typography>}
    </>;
  };
  const carTitle = (car: { licence_plate: string, manufacturer: string, model_name: string }) => <>{plate(car.licence_plate)} · {car.manufacturer} {car.model_name}</>;

  return (
    <Page titleText={agency?.name ?? t('common:today')}>
      {today.data && <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 3 }}><Stat label='today:available' value={today.data.cars_available + '/' + today.data.cars_total} tone='ok' href='/cars' /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Stat label='today:out' value={today.data.cars_out} tone='info' href='/rented' /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Stat label='today:due_back' value={dueBackToday} tone='primary' onClick={() => setRange('today')} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Stat label='today:overdue' value={today.data.overdue} tone={today.data.overdue ? 'danger' : 'muted'} href='/rented' /></Grid>
      </Grid>}
      {today.data?.cars_total === 0 && isOwner && // a new agency starts with its fleet
        <Card sx={{ mb: 2, p: 3, textAlign: 'center' }}>
          <Typography color='text.secondary' sx={{ mb: 2 }}>{t('today:first_car')}</Typography>
          <Button variant='contained' component={Link} href='/cars/new'>{t('car:new')}</Button>
        </Card>}

      <Stack direction='row' sx={{ mb: 2, gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Choice value={range} onChange={setRange} options={(Object.keys(RANGES) as Range[]).map(option => ({ label: 'today:range:' + option, value: option }))} />
        <Chip label={t('task:mine')} color={onlyMine ? 'primary' : 'default'} variant={onlyMine ? 'filled' : 'outlined'} aria-pressed={onlyMine} onClick={() => setOnlyMine(current => ! current)} />
      </Stack>

      {selected.isLoading ? <Loading /> : ! data ? <Empty text='common:error:happened' /> : <>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>{list('movement:going_out', 'out')}</Grid>
          <Grid size={{ xs: 12, md: 6 }}>{list('movement:coming_back', 'back')}</Grid>
        </Grid>

        {range !== 'today' && ! data.pickups.length && ! data.returns.length && <Empty text='movement:none' />}

        {range === 'today' && <Grid container spacing={2} sx={{ mt: 1 }}>
          {data.to_clean.length > 0 && <Grid size={{ xs: 12, md: 6 }}>
            <Section title='today:to_clean'>
              <List disablePadding>
                {data.to_clean.map(contract => <Row
                  key={'clean-' + contract.id}
                  href={'/contracts/' + contract.id}
                  title={contract.car ? carTitle(contract.car) : '—'}
                  subtitle={[ t('task:back_since', { date: formatDateTime(contract.returned_at!) }), staffName(agency?.staff?.find(user => user.id === contract.return_user_id)) ].filter(Boolean).join(' · ')}
                  meta={<Checkbox checked={false} disabled={clean.isPending} onClick={event => { event.preventDefault(); event.stopPropagation(); clean.mutate(contract.id); }} slotProps={{ input: { 'aria-label': t('task:cleaned') } }} />}
                />)}
              </List>
            </Section>
          </Grid>}
          {(data.maintenance_due.length > 0 || data.expiring_cars.length > 0) && <Grid size={{ xs: 12, md: 6 }}>
            <Section title='today:cars_to_check'>
              <List disablePadding>
                {data.maintenance_due.map(car => <Row
                  key={'oil-' + car.id}
                  href={'/cars/' + car.id}
                  title={carTitle(car)}
                  subtitle={t(car.oil_change?.last_at === null ? 'car:oil_change:unknown' : car.oil_change?.due_mileage == null ? 'car:oil_change:due_date' : 'car:oil_change:due', { km: car.oil_change?.due_mileage, date: formatDate(car.oil_change?.due_at ?? 0) })}
                  meta={<Badge label='dashboard:maintenance' tone='warn' />}
                />)}
                {data.expiring_cars.map(car => <Row
                  key={'papers-' + car.id}
                  href={'/cars/' + car.id}
                  title={carTitle(car)}
                  subtitle={PAPERS.filter(paper => car[paper] < expiryLimit).map(paper => <div key={paper}>{t('car:' + paper, { date: formatDate(car[paper]) })}</div>)}
                  meta={<Badge label='today:papers' tone={PAPERS.some(paper => car[paper] < now) ? 'danger' : 'warn'} />}
                />)}
              </List>
            </Section>
          </Grid>}

          {!! (data.instalments_due?.length || data.bills_due?.length || data.salaries_due?.length) && <Grid size={{ xs: 12, md: 6 }}>
            <Section title='today:to_pay'>
              <List disablePadding>
                {data.instalments_due?.map(due => <Row
                  key={'instalment-' + due.car.id}
                  title={t('today:instalment', { plate: plate(due.car.licence_plate) })}
                  subtitle={[ formatDate(due.next_due_at!), due.lender, (due.paid + 1) + ' / ' + due.months ].filter(Boolean).join(' · ')}
                  meta={money(due.amount)}
                  onClick={() => setPaying({ title: t('today:instalment', { plate: plate(due.car.licence_plate) }), action: method => storeExpense({
                    car_id: due.car.id, category: CATEGORY_INSTALMENT, amount: due.amount, spent_at: Math.floor(Date.now() / 1000), method: method as 1,
                    mileage: null, garage: null, note: due.lender,
                  }) })}
                />)}
                {data.bills_due?.map(bill => <Row
                  key={'bill-' + bill.id}
                  title={t('expense:category:' + bill.category)}
                  subtitle={[ formatDate(bill.next_due_at), bill.branch?.name, bill.note ].filter(Boolean).join(' · ')}
                  meta={money(bill.amount)}
                  onClick={() => setPaying({ title: t('expense:category:' + bill.category), action: method => payBill(bill.id, method) })}
                />)}
                {data.salaries_due?.map(({ employee, due }) => <Row
                  key={'salary-' + employee.id}
                  title={employeeName(employee)}
                  subtitle={t('today:salary_due')}
                  meta={money(due)}
                  onClick={() => setSalary({ employee, due })}
                />)}
              </List>
            </Section>
          </Grid>}

          {!! data.fleet_deadlines?.length && <Grid size={{ xs: 12, md: 6 }}>
            <Section title='today:leaving_fleet'>
              <List disablePadding>
                {data.fleet_deadlines.map(({ car, deadline }) => <Row
                  key={'deadline-' + car.id}
                  href={'/cars/' + car.id}
                  title={carTitle(car)}
                  subtitle={t('today:leaves_on', { date: formatDate(deadline) })}
                  meta={<Badge label={deadline < now ? 'today:deadline:passed' : 'today:deadline:months'} params={{ months: Math.max(0, Math.floor((deadline - now) / (30 * DAY))) }} tone={deadline < now ? 'danger' : 'warn'} />}
                />)}
              </List>
            </Section>
          </Grid>}
        </Grid>}
      </>}

      {paying && <PayHowDialog title={paying.title} onClose={() => setPaying(null)} onPay={method => { pay.mutate(() => paying.action(method)); setPaying(null); }} />}
      {salary && <SalaryDialog employee={salary.employee} type={1} amount={salary.due} onClose={() => setSalary(null)} />}
    </Page>
  );
}
