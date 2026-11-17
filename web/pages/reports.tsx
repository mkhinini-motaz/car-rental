import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Box, Button, Card, CardContent, Divider, Grid, IconButton, List, ListItemButton, ListItemText, Stack, Typography } from '@mui/material';
import Add from '@mui/icons-material/Add';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import FileDownload from '@mui/icons-material/FileDownload';
import { report, Report } from '../src/api/agency';
import { index as expenses } from '../src/api/expense';
import { BADGE_TONES } from '../src/classes/Client';
import { employeeName } from '../src/classes/Employee';
import { AGENCY_CATEGORIES } from '../src/classes/Expense';
import { COLORS, Tone } from '../src/constants';
import { useT } from '../src/store/Store';
import { formatDate, plate } from '../src/support/utils';
import { Bar, ExpenseRow, useDeleteExpense } from '../src/components/car';
import ExpenseDialog from '../src/components/ExpenseDialog';
import { Badge, bareButton, Choice, Empty, Info, Loading, Page, Section, useMoney } from '../src/components/common';

const TABS = [ 'month', 'fleet', 'clients', 'owed' ] as const;
type Tab = typeof TABS[number];
const monthLabel = (month: string) => month.slice(5) + '/' + month.slice(0, 4); // 'YYYY-MM' → 'MM/YYYY'
const percent = (ratio: number) => Math.round(ratio * 100) + ' %';
const CHART_HEIGHT = 140;

// A figure with its change since last month.
function Tile({ label, value, change, tone = 'primary' }: { label: string, value: string, change: number|null, tone?: Tone }) {
  const t = useT();
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography sx={{ fontSize: 22, fontWeight: 700, color: COLORS[tone] }}>{value}</Typography>
        <Typography color='text.secondary'>{t(label)}</Typography>
        {change !== null && <Typography variant='body2' sx={{ fontWeight: 600, color: change < 0 ? COLORS.danger : COLORS.ok }}>{(change > 0 ? '+' : '') + Math.round(change) + ' %'}</Typography>}
      </CardContent>
    </Card>
  );
}

// The year as twelve columns, revenue (green) beside costs (red); click one to open that month. A
// month before the agency joined has no data: a grey line, not a zero.
function YearChart({ months, selected, onSelect }: { months: Report['months'], selected: string, onSelect: (month: string) => void }) {
  const t = useT();
  const money = useMoney();
  const largest = Math.max(1, ...months.map(item => Math.max(item.revenue ?? 0, item.expenses ?? 0)));
  const column = (value: number, colour: string) => <div style={{ width: 12, height: Math.max(2, value / largest * CHART_HEIGHT), background: colour, borderRadius: 2 }} />;
  return (
    <Stack dir='ltr' direction='row' sx={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
      {months.map(item =>
        <Stack
          key={item.month}
          component='button'
          type='button'
          onClick={() => onSelect(item.month)}
          aria-pressed={item.month === selected}
          aria-label={item.revenue === null ? monthLabel(item.month) + ' · ' + t('report:year:no_data') :
            [ monthLabel(item.month), t('report:revenue') + ' ' + money(item.revenue), t('report:expenses') + ' ' + money(item.expenses ?? 0) ].join(' · ')}
          sx={{ ...bareButton, alignItems: 'center', gap: 0.5, opacity: item.month === selected ? 1 : 0.55 }}
        >
          <Stack direction='row' sx={{ alignItems: 'flex-end', gap: '2px', height: CHART_HEIGHT }}>
            {item.revenue === null ? <div style={{ width: 26, height: 2, background: COLORS.line }} /> : <>
              {column(item.revenue, COLORS.ok)}
              {column(item.expenses ?? 0, COLORS.danger)}
            </>}
          </Stack>
          <Typography variant='caption' sx={{ fontWeight: item.month === selected ? 700 : 400 }}>{item.month.slice(5)}</Typography>
        </Stack>
      )}
    </Stack>
  );
}

function Row({ href, primary, secondary, meta }: { href: string, primary: React.ReactNode, secondary?: React.ReactNode, meta?: React.ReactNode }) {
  return (
    <ListItemButton divider component={Link} href={href}>
      <ListItemText primary={primary} secondary={secondary} slotProps={{ secondary: { component: 'div' } }} />
      <Box sx={{ ml: 2, textAlign: 'end', flexShrink: 0 }}>{meta}</Box>
    </ListItemButton>
  );
}

// The owner's month and the fleet's money: figures with last month's change, counts, the year,
// each car, the clients, and who owes what right now.
export default function ReportsPage() {
  const t = useT();
  const money = useMoney();
  const [tab, setTab] = useState<Tab>('month');
  const [owingOnly, setOwingOnly] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const params = { year: month.getFullYear(), month: month.getMonth() + 1 };
  const { isLoading, data } = useQuery({ queryKey: [ 'report', params ], queryFn: report });
  const from = month.getTime() / 1000;
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime() / 1000;
  const { data: monthExpenses } = useQuery({ queryKey: [ 'expense.index', { from, to } ], queryFn: expenses });
  const deleteExpense = useDeleteExpense();
  const shiftMonth = (months: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + months, 1));
  const change = (current: number, previous: number|null) => previous ? (current - previous) / Math.abs(previous) * 100 : null;
  const carLabel = (car: { licence_plate: string, model_name: string }) => plate(car.licence_plate) + ' · ' + car.model_name;
  const amount = (value: number, colour?: string) => <Typography sx={{ fontWeight: 700, color: colour }}>{money(value)}</Typography>;

  const header = <Stack direction='row' sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
    <Stack direction='row' sx={{ alignItems: 'center' }}>
      <IconButton aria-label={t('common:previous')} onClick={() => shiftMonth(-1)}><ChevronLeft /></IconButton>
      <Typography variant='h6'>{monthLabel(data?.month ?? `${params.year}-${String(params.month).padStart(2, '0')}`)}</Typography>
      <IconButton aria-label={t('common:next')} onClick={() => shiftMonth(1)}><ChevronRight /></IconButton>
    </Stack>
    <Choice value={tab} onChange={setTab} options={TABS.map(value => ({ label: 'report:tab:' + value, value }))} />
  </Stack>;

  const content = () => {
    if (! data) {
      return null;
    }
    const overheadCategories = data.expenses_by_category.filter(item => AGENCY_CATEGORIES.includes(item.category));
    const clients = owingOnly ? data.clients.filter(item => item.outstanding > 0) : data.clients;

    if (tab === 'month') {
      return <>
        {from < data.since && <Typography variant='body2' sx={{ color: COLORS.warn, mb: 1 }}>{t('report:since', { date: formatDate(data.since) })}</Typography>}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, sm: 4 }}><Tile label='report:revenue' value={money(data.revenue)} change={change(data.revenue, data.previous.revenue)} /></Grid>
          <Grid size={{ xs: 12, sm: 4 }}><Tile label='report:net' value={money(data.net)} change={change(data.net, data.previous.net)} tone={data.net < 0 ? 'danger' : 'ok'} /></Grid>
          <Grid size={{ xs: 12, sm: 4 }}><Tile label='report:utilization_rate' value={percent(data.utilization_rate)} change={change(data.utilization_rate, data.previous.utilization_rate)} tone='info' /></Grid>
        </Grid>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Section title='report:money'>
              <Info label='report:revenue' value={money(data.revenue)} tone='ok' />
              {data.other_income > 0 && <Info label='report:other_income' value={money(data.other_income)} tone='ok' />}
              <Info label='report:car_costs' value={money(data.car_costs)} />
              {data.instalments > 0 && <Info label='report:instalments' value={money(data.instalments)} />}
              <Info label='report:overhead' value={money(data.overhead)} />
              <Info label='report:payroll' value={money(data.payroll + data.employer_charges)} />
              {data.commissions > 0 && <Info label='report:commissions' value={money(data.commissions)} />}
              <Divider />
              <Info label='report:net' value={money(data.net)} tone={data.net < 0 ? 'danger' : 'ok'} bold />
              <Info label='report:payments_received' value={money(data.payments_received)} />
              {data.payments_by_method.map(item => <Info key={item.method} label={'payment:method:' + item.method} value={money(item.amount)} />)}
            </Section>
            <Section title='report:kpis'>
              <Info label='report:average_daily_rate' value={money(data.kpis.average_daily_rate)} />
              <Info label='report:contracts_started' value={data.kpis.contracts_started} />
              <Info label='report:contracts_cancelled' value={data.kpis.contracts_cancelled} />
              <Info label='report:average_days' value={data.kpis.average_days} />
              <Info label='report:late_returns' value={t('report:late_returns:value', { count: data.kpis.late_returns, hours: data.kpis.late_hours })} tone={data.kpis.late_returns ? 'warn' : undefined} />
              <Info label='report:overdue_now' value={data.kpis.overdue_now} tone={data.kpis.overdue_now ? 'danger' : undefined} />
              <Info label='report:upcoming' value={t('report:upcoming:value', { count: data.upcoming.count, amount: money(data.upcoming.revenue) })} />
            </Section>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Section title='report:year'>
              <YearChart months={data.months} selected={data.month} onSelect={selected => setMonth(new Date(Number(selected.slice(0, 4)), Number(selected.slice(5)) - 1, 1))} />
              {data.months.some(item => item.revenue === null) && <Typography variant='body2' color='text.secondary'>{t('report:year:no_data')}</Typography>}
            </Section>
            <Section title='report:overhead'>
              {overheadCategories.map(item => <Info key={item.category} label={'expense:category:' + item.category} value={money(item.amount)} />)}
              {data.overhead_by_branch.filter(item => item.branch).map(item => <Info key={item.branch!.id} label='report:branch' params={{ name: item.branch!.name }} value={money(item.amount)} href='/settings/branches' />)}
              <Info label='report:overhead_per_car' value={money(data.overhead_per_car)} bold />
            </Section>
            {(data.payroll > 0 || data.employer_charges > 0) && <Section title='report:payroll'>
              {data.payroll_by_employee.map(item => <Info key={item.employee.id} label='report:employee' params={{ name: employeeName(item.employee) }} value={money(item.amount)} href={'/payroll/' + item.employee.id} />)}
              {data.employer_charges > 0 && <Info label='report:employer_charges' value={money(data.employer_charges)} />}
            </Section>}
            {data.commissions_by_broker.length > 0 && <Section title='report:commissions_by_broker'>
              {data.commissions_by_broker.map(item => <Info key={item.broker ?? ''} label='report:broker' params={{ name: item.broker ?? '—', count: item.contracts }} value={money(item.amount)} />)}
            </Section>}
          </Grid>
        </Grid>
        <Section title='report:expenses_of_month' action={<Button size='small' startIcon={<Add />} onClick={() => setIsAddingExpense(true)}>{t('expense:add')}</Button>}>
          {monthExpenses?.length ? monthExpenses.map(expense => <ExpenseRow key={expense.id} data={expense} onDelete={() => deleteExpense(expense.id)} />) : <Empty />}
        </Section>
      </>;
    }

    if (tab === 'fleet') {
      return <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Section title='report:utilization'>
            {data.utilization.map(item =>
              <Box key={item.car.id} component={Link} href={'/cars/' + item.car.id} sx={{ color: 'inherit', textDecoration: 'none', display: 'block', py: 0.5 }}>
                <Stack direction='row' sx={{ justifyContent: 'space-between' }}>
                  <Typography sx={{ fontWeight: 600 }}>{carLabel(item.car)}</Typography>
                  <Typography>{money(item.revenue)}</Typography>
                </Stack>
                <Bar ratio={item.rate} />
                <Typography variant='body2' color='text.secondary'>{[
                  t('report:days:rented', { days: item.days_rented, rate: Math.round(item.rate * 100) }),
                  t('report:days:idle', { days: item.idle_days }),
                  item.maintenance_days ? t('report:days:maintenance', { days: item.maintenance_days }) : null,
                  item.cost_per_km !== null ? t('report:cost_per_km', { amount: money(item.cost_per_km) }) : null,
                ].filter(Boolean).join(' · ')}</Typography>
              </Box>
            )}
          </Section>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Section title='report:fleet'>
            <Typography variant='body2' color='text.secondary'>{t('report:fleet:hint')}</Typography>
            {data.fleet.map(item =>
              <Box key={item.car.id} component={Link} href={'/cars/' + item.car.id} sx={{ color: 'inherit', textDecoration: 'none', display: 'block', py: 0.5 }}>
                <Stack direction='row' sx={{ justifyContent: 'space-between' }}>
                  <Typography sx={{ fontWeight: 600 }}>{carLabel(item.car)}</Typography>
                  <Typography sx={{ fontWeight: 700, color: (item.payback ?? 0) >= 1 ? COLORS.ok : undefined }}>{item.payback === null ? '—' : percent(item.payback)}</Typography>
                </Stack>
                {item.payback !== null && <Bar ratio={item.payback} colour={item.payback >= 1 ? COLORS.ok : COLORS.info} />}
                <Typography variant='body2' color='text.secondary'>{t('report:fleet:line', { earned: money(item.earned), cost: money(item.total_cost) })}</Typography>
                {!! item.history_since && <Typography variant='body2' sx={{ color: COLORS.warn }}>{t('report:fleet:since', { date: formatDate(item.history_since) })}</Typography>}
              </Box>
            )}
          </Section>
          <Section title='report:renewal'>
            <Info label='report:capital_next_12_months' value={money(data.capital_next_12_months)} bold />
            <List disablePadding>
              {data.renewal.map(item => <Row
                key={item.car.id}
                href={'/cars/' + item.car.id}
                primary={carLabel(item.car)}
                secondary={[ t('today:leaves_on', { date: formatDate(item.fleet_deadline!) }), item.expected_sale_price ? t('report:expected', { amount: money(item.expected_sale_price) }) : null ].filter(Boolean).join(' · ')}
                meta={<Badge label={item.months_left! < 0 ? 'today:deadline:passed' : 'today:deadline:months'} params={{ months: Math.max(0, item.months_left!) }} tone={item.months_left! < 6 ? (item.months_left! < 0 ? 'danger' : 'warn') : 'muted'} />}
              />)}
            </List>
          </Section>
          {data.sold_cars.length > 0 && <Section title='car:sold:label'>
            <List disablePadding>
              {data.sold_cars.map(item => <Row
                key={item.car.id}
                href={'/cars/' + item.car.id}
                primary={carLabel(item.car)}
                secondary={t('car:sold:on', { date: formatDate(item.sold_at) }) + ' · ' + money(item.sale_price)}
                meta={amount(item.result, item.result < 0 ? COLORS.danger : COLORS.ok)}
              />)}
            </List>
          </Section>}
        </Grid>
      </Grid>;
    }

    if (tab === 'clients') {
      return <>
        <Box sx={{ mb: 2 }}><Choice value={owingOnly} onChange={setOwingOnly} options={[ { label: 'report:clients:all', value: false }, { label: 'report:clients:owing', value: true } ]} /></Box>
        {clients.length ? <Card><List disablePadding>
          {clients.map(item => <Row
            key={item.client.id}
            href={'/clients/' + item.client.id}
            primary={item.client.first_name + ' ' + item.client.last_name}
            secondary={t('report:clients:line', { count: item.contracts, owed: money(item.outstanding) })}
            meta={<Stack sx={{ alignItems: 'flex-end', gap: 0.5 }}>{amount(item.revenue)}<Badge label={'client:badge:' + item.badge} tone={BADGE_TONES[item.badge]} /></Stack>}
          />)}
        </List></Card> : <Empty />}
      </>;
    }

    return <>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 4 }}><Tile label='report:owed_rent' value={money(data.owed_rent)} change={null} tone={data.owed_rent ? 'danger' : 'muted'} /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><Tile label='report:owed_fines' value={money(data.owed_fines)} change={null} tone={data.owed_fines ? 'danger' : 'muted'} /></Grid>
        {data.deposits_held > 0 && <Grid size={{ xs: 12, sm: 4 }}><Tile label='report:deposits_held' value={money(data.deposits_held)} change={null} /></Grid>}
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Section title='report:owed_contracts'>
            {data.owed_contracts.length ? <List disablePadding>{data.owed_contracts.map(item => <Row
              key={item.id}
              href={'/contracts/' + item.id}
              primary={item.client.first_name + ' ' + item.client.last_name}
              secondary={plate(item.car.licence_plate) + (item.days_late ? ' · ' + t('report:days_late', { days: item.days_late }) : '')}
              meta={amount(item.owed, COLORS.danger)}
            />)}</List> : <Empty />}
          </Section>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Section title='report:unpaid_fines'>
            {data.unpaid_fines.length ? <List disablePadding>{data.unpaid_fines.map(item => <Row
              key={item.id}
              href={'/fines/' + item.id}
              primary={item.client ? item.client.first_name + ' ' + item.client.last_name : plate(item.licence_plate)}
              secondary={plate(item.licence_plate) + ' · ' + formatDate(item.committed_at)}
              meta={amount(item.amount, COLORS.danger)}
            />)}</List> : <Empty />}
          </Section>
        </Grid>
      </Grid>
    </>;
  };

  return (
    <Page title='common:reports' actions={data && <Button variant='contained' startIcon={<FileDownload />} href={data.export_url} target='_blank'>{t('report:export')}</Button>}>
      {header}
      {isLoading ? <Loading /> : ! data ? <Empty text='report:forbidden' /> : content()}
      <ExpenseDialog open={isAddingExpense} onClose={() => setIsAddingExpense(false)} />
    </Page>
  );
}
