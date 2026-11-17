import { useState } from 'react';
import { Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { report, Report } from '../api/agency';
import { index as expenses } from '../api/expense';
import { BADGE_TONES } from '../classes/Client';
import { employeeName } from '../classes/Employee';
import { AGENCY_CATEGORIES } from '../classes/Expense';
import { Tone } from '../constants';
import { useColors } from '../store/ThemeContext';
import { useMoney, useNetworkErrorAlert, useT } from '../store/hooks';
import { formatDate, plate } from '../support/utils';
import FullScreenLoader from '../components/common/FullScreenLoader';
import LangAwareView from '../components/common/LangAwareView';
import TranslatableText from '../components/common/TranslatableText';
import ChipsField from '../components/Form/ChipsField';
import { ExpenseRow, useDeleteExpense } from '../components/car/CarMoney';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import Icon from '../components/ui/Icon';
import InfoRow from '../components/ui/InfoRow';
import ListRow from '../components/ui/ListRow';
import Screen from '../components/ui/Screen';
import { ScreenProps } from '../navigation/types';

const TABS = [ 'month', 'fleet', 'clients', 'owed' ] as const;
type Tab = typeof TABS[number];
const monthLabel = (month: string) => month.slice(5) + '/' + month.slice(0, 4); // 'YYYY-MM' → 'MM/YYYY'
const percent = (ratio: number) => Math.round(ratio * 100) + ' %';

// A bar as a share of 1; plain views, no chart library.
function Bar({ ratio, colour }: { ratio: number, colour?: string }) {
  const COLORS = useColors();
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: COLORS.line, overflow: 'hidden' }}>
      <View style={{ height: '100%', borderRadius: 4, backgroundColor: colour ?? COLORS.primary, width: `${Math.max(1, Math.min(100, ratio * 100))}%` }} />
    </View>
  );
}

// A figure with its change since last month.
function Tile({ label, value, change, tone = 'primary' }: { label: string, value: string, change: number|null, tone?: Tone }) {
  const COLORS = useColors();
  return (
    <View className='bg-surface border border-line rounded-xl px-3 py-2.5' style={{ flex: 1, gap: 2 }}>
      <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS[tone] }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <TranslatableText data={label} className='text-meta text-muted' />
      {change !== null && <Text style={{ fontSize: 12, fontWeight: '600', color: change < 0 ? COLORS.danger : COLORS.ok }}>{(change > 0 ? '+' : '') + Math.round(change) + ' %'}</Text>}
    </View>
  );
}

const CHART_HEIGHT = 110;

// The year as twelve columns, revenue (green) beside costs (red); tap one to open that month. A
// month before the agency joined has no data: a grey line, not a zero.
function YearChart({ months, selected, onSelect }: { months: Report['months'], selected: string, onSelect: (month: string) => void }) {
  const COLORS = useColors();
  const largest = Math.max(1, ...months.map(item => Math.max(item.revenue ?? 0, item.expenses ?? 0)));
  const column = (value: number, colour: string) =>
    <View style={{ width: 7, height: Math.max(2, value / largest * CHART_HEIGHT), backgroundColor: colour, borderRadius: 2 }} />;

  return (
    <LangAwareView style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
      {months.map(item =>
        <TouchableOpacity key={item.month} onPress={() => onSelect(item.month)}>
          <View style={{ alignItems: 'center', gap: 4, opacity: item.month === selected ? 1 : 0.55 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: CHART_HEIGHT }}>
              {item.revenue === null ? <View style={{ width: 16, height: 2, backgroundColor: COLORS.line }} /> : <>
                {column(item.revenue, COLORS.ok)}
                {column(item.expenses ?? 0, COLORS.danger)}
              </>}
            </View>
            <Text style={{ fontSize: 11, fontWeight: item.month === selected ? '700' : '400', color: COLORS.ink }}>{item.month.slice(5)}</Text>
          </View>
        </TouchableOpacity>
      )}
    </LangAwareView>
  );
}

// The owner's month and the fleet's money: figures with last month's change, counts, the year,
// each car, the clients, and who owes what right now.
export default function ReportsScreen({ navigation }: ScreenProps<'Reports'>): React.JSX.Element {
  const COLORS = useColors();
  const t = useT();
  const money = useMoney();
  const [tab, setTab] = useState<Tab>('month');
  const [owingOnly, setOwingOnly] = useState(false);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const params = { year: month.getFullYear(), month: month.getMonth() + 1 };
  const { isLoading, error, data, refetch } = useQuery({ queryKey: ['report', params], queryFn: report });
  const from = month.getTime() / 1000;
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime() / 1000;
  const { data: monthExpenses } = useQuery({ queryKey: ['expense.index', { from, to }], queryFn: expenses });
  useNetworkErrorAlert(error);
  const deleteExpense = useDeleteExpense();
  const shiftMonth = (months: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + months, 1));
  const change = (current: number, previous: number|null) => previous ? (current - previous) / Math.abs(previous) * 100 : null;

  const header = <>
    <LangAwareView style={{ justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8 }}>
      <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={10}><Icon name='chevron-left' size={32} color={COLORS.primary} /></TouchableOpacity>
      <Text className='text-title font-semibold text-ink'>{monthLabel(data?.month ?? `${params.year}-${String(params.month).padStart(2, '0')}`)}</Text>
      <TouchableOpacity onPress={() => shiftMonth(1)} hitSlop={10}><Icon name='chevron-right' size={32} color={COLORS.primary} /></TouchableOpacity>
    </LangAwareView>
    <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
      <ChipsField value={tab} onChange={setTab} options={TABS.map(value => ({ label: 'report:tab:' + value, value }))} />
    </View>
  </>;

  if (isLoading || ! data) {
    return <Screen>{header}{isLoading ? <FullScreenLoader /> : <ErrorState error={error} onRetry={() => refetch()} />}</Screen>;
  }

  const overheadCategories = data.expenses_by_category.filter(item => AGENCY_CATEGORIES.includes(item.category));
  const clients = owingOnly ? data.clients.filter(item => item.outstanding > 0) : data.clients;

  const monthTab = <>
    {from < data.since && <TranslatableText data='report:since' params={{ date: formatDate(data.since) }} className='text-meta text-warn mx-4 mt-1' />}
    <LangAwareView style={{ gap: 8, marginHorizontal: 12, marginVertical: 6 }}>
      <Tile label='report:revenue' value={money(data.revenue)} change={change(data.revenue, data.previous.revenue)} />
      <Tile label='report:net' value={money(data.net)} change={change(data.net, data.previous.net)} tone={data.net < 0 ? 'danger' : 'ok'} />
      <Tile label='report:utilization_rate' value={percent(data.utilization_rate)} change={change(data.utilization_rate, data.previous.utilization_rate)} tone='info' />
    </LangAwareView>
    <Card>
      <TranslatableText data='report:money' className='text-title font-semibold text-ink' />
      <InfoRow label='report:revenue' value={money(data.revenue)} tone='ok' />
      {data.other_income > 0 && <InfoRow label='report:other_income' value={money(data.other_income)} tone='ok' />}
      <InfoRow label='report:car_costs' value={money(data.car_costs)} />
      {data.instalments > 0 && <InfoRow label='report:instalments' value={money(data.instalments)} />}
      <InfoRow label='report:overhead' value={money(data.overhead)} />
      <InfoRow label='report:payroll' value={money(data.payroll + data.employer_charges)} />
      {data.commissions > 0 && <InfoRow label='report:commissions' value={money(data.commissions)} />}
      <View className='h-px bg-line my-1' />
      <InfoRow label='report:net' value={money(data.net)} tone={data.net < 0 ? 'danger' : 'ok'} bold />
      <InfoRow label='report:payments_received' value={money(data.payments_received)} />
      {data.payments_by_method.map(item => <InfoRow key={item.method} label={'payment:method:' + item.method} value={money(item.amount)} />)}
    </Card>
    <Card>
      <TranslatableText data='report:year' className='text-title font-semibold text-ink' />
      <YearChart months={data.months} selected={data.month} onSelect={(selected) => setMonth(new Date(Number(selected.slice(0, 4)), Number(selected.slice(5)) - 1, 1))} />
      {data.months.some(item => item.revenue === null) && <TranslatableText data='report:year:no_data' className='text-meta text-muted' />}
    </Card>
    <Card>
      <TranslatableText data='report:kpis' className='text-title font-semibold text-ink' />
      <InfoRow label='report:average_daily_rate' value={money(data.kpis.average_daily_rate)} />
      <InfoRow label='report:contracts_started' value={String(data.kpis.contracts_started)} />
      <InfoRow label='report:contracts_cancelled' value={String(data.kpis.contracts_cancelled)} />
      <InfoRow label='report:average_days' value={String(data.kpis.average_days)} />
      <InfoRow label='report:late_returns' value={t('report:late_returns:value', { count: data.kpis.late_returns, hours: data.kpis.late_hours })} tone={data.kpis.late_returns ? 'warn' : undefined} />
      <InfoRow label='report:overdue_now' value={String(data.kpis.overdue_now)} tone={data.kpis.overdue_now ? 'danger' : undefined} />
      <InfoRow label='report:upcoming' value={t('report:upcoming:value', { count: data.upcoming.count, amount: money(data.upcoming.revenue) })} />
    </Card>
    <Card>
      <TranslatableText data='report:overhead' className='text-title font-semibold text-ink' />
      {overheadCategories.map(item => <InfoRow key={item.category} label={'expense:category:' + item.category} value={money(item.amount)} />)}
      {data.overhead_by_branch.filter(item => item.branch).map(item => <InfoRow key={item.branch!.id} label='report:branch' params={{ name: item.branch!.name }} value={money(item.amount)} onPress={() => navigation.navigate('BranchesScreen')} />)}
      <InfoRow label='report:overhead_per_car' value={money(data.overhead_per_car)} bold />
    </Card>
    {(data.payroll > 0 || data.employer_charges > 0) && <Card>
      <TranslatableText data='report:payroll' className='text-title font-semibold text-ink' />
      {data.payroll_by_employee.map(item => <InfoRow key={item.employee.id} label='report:employee' params={{ name: employeeName(item.employee) }} value={money(item.amount)} onPress={() => navigation.navigate('EmployeeScreen', { employeeId: item.employee.id })} />)}
      {data.employer_charges > 0 && <InfoRow label='report:employer_charges' value={money(data.employer_charges)} />}
    </Card>}
    {data.commissions_by_broker.length > 0 && <Card>
      <TranslatableText data='report:commissions_by_broker' className='text-title font-semibold text-ink' />
      {data.commissions_by_broker.map(item => <InfoRow key={item.broker ?? ''} label='report:broker' params={{ name: item.broker ?? '—', count: item.contracts }} value={money(item.amount)} />)}
    </Card>}
    <TranslatableText data='report:expenses_of_month' className='text-title font-semibold text-ink mx-4 mt-4 mb-1' />
    <View className='mx-3 bg-surface border border-line rounded-xl overflow-hidden'>
      {monthExpenses?.length ? monthExpenses.map(expense => <ExpenseRow key={expense.id} data={expense} onDelete={() => deleteExpense(expense.id)} />) :
        <TranslatableText data='common:no_data' className='text-body text-muted p-3' />}
    </View>
    <View style={{ margin: 12, gap: 8 }}>
      <Button label='expense:add' variant='secondary' icon='plus' onPress={() => navigation.navigate('ExpenseFormScreen')} />
      <Button label='report:export' icon='file-download-outline' onPress={() => Linking.openURL(data.export_url)} />
    </View>
  </>;

  const fleetTab = <>
    <Card>
      <TranslatableText data='report:utilization' className='text-title font-semibold text-ink' />
      {data.utilization.map(item =>
        <TouchableOpacity key={item.car.id} onPress={() => navigation.navigate('CarScreen', { carId: item.car.id })} style={{ gap: 4, paddingVertical: 4 }}>
          <LangAwareView style={{ justifyContent: 'space-between' }}>
            <Text className='text-body font-semibold text-ink'>{plate(item.car.licence_plate)} · {item.car.model_name}</Text>
            <Text className='text-body text-ink'>{money(item.revenue)}</Text>
          </LangAwareView>
          <Bar ratio={item.rate} />
          <Text className='text-meta text-muted'>{[
            t('report:days:rented', { days: item.days_rented, rate: Math.round(item.rate * 100) }),
            t('report:days:idle', { days: item.idle_days }),
            item.maintenance_days ? t('report:days:maintenance', { days: item.maintenance_days }) : null,
            item.cost_per_km !== null ? t('report:cost_per_km', { amount: money(item.cost_per_km) }) : null,
          ].filter(Boolean).join(' · ')}</Text>
        </TouchableOpacity>
      )}
    </Card>
    <Card>
      <TranslatableText data='report:fleet' className='text-title font-semibold text-ink' />
      <TranslatableText data='report:fleet:hint' className='text-meta text-muted' />
      {data.fleet.map(item =>
        <TouchableOpacity key={item.car.id} onPress={() => navigation.navigate('CarScreen', { carId: item.car.id })} style={{ gap: 4, paddingVertical: 4 }}>
          <LangAwareView style={{ justifyContent: 'space-between' }}>
            <Text className='text-body font-semibold text-ink'>{plate(item.car.licence_plate)} · {item.car.model_name}</Text>
            <Text className='text-body font-semibold' style={{ color: (item.payback ?? 0) >= 1 ? COLORS.ok : COLORS.ink }}>{item.payback === null ? '—' : percent(item.payback)}</Text>
          </LangAwareView>
          {item.payback !== null && <Bar ratio={item.payback} colour={item.payback >= 1 ? COLORS.ok : COLORS.info} />}
          <Text className='text-meta text-muted'>{t('report:fleet:line', { earned: money(item.earned), cost: money(item.total_cost) })}</Text>
          {!! item.history_since && <Text className='text-meta text-warn'>{t('report:fleet:since', { date: formatDate(item.history_since) })}</Text>}
        </TouchableOpacity>
      )}
    </Card>
    <Card>
      <TranslatableText data='report:renewal' className='text-title font-semibold text-ink' />
      <InfoRow label='report:capital_next_12_months' value={money(data.capital_next_12_months)} bold />
      {data.renewal.map(item => <ListRow
        key={item.car.id}
        title={plate(item.car.licence_plate) + ' · ' + item.car.model_name}
        subtitle={[ t('today:leaves_on', { date: formatDate(item.fleet_deadline!) }), item.expected_sale_price ? t('report:expected', { amount: money(item.expected_sale_price) }) : null ].filter(Boolean).join(' · ')}
        meta={<Badge label={item.months_left! < 0 ? 'today:deadline:passed' : 'today:deadline:months'} params={{ months: Math.max(0, item.months_left!) }} tone={item.months_left! < 6 ? (item.months_left! < 0 ? 'danger' : 'warn') : 'muted'} />}
        onPress={() => navigation.navigate('CarScreen', { carId: item.car.id })}
      />)}
    </Card>
    {data.sold_cars.length > 0 && <Card>
      <TranslatableText data='car:sold:label' className='text-title font-semibold text-ink' />
      {data.sold_cars.map(item => <ListRow
        key={item.car.id}
        title={plate(item.car.licence_plate) + ' · ' + item.car.model_name}
        subtitle={t('car:sold:on', { date: formatDate(item.sold_at) }) + ' · ' + money(item.sale_price)}
        meta={<Text className='text-body font-semibold' style={{ color: item.result < 0 ? COLORS.danger : COLORS.ok }}>{money(item.result)}</Text>}
        onPress={() => navigation.navigate('CarScreen', { carId: item.car.id })}
      />)}
    </Card>}
  </>;

  const clientsTab = <>
    <View style={{ paddingHorizontal: 12, paddingBottom: 4 }}>
      <ChipsField value={owingOnly} onChange={setOwingOnly} options={[ { label: 'report:clients:all', value: false }, { label: 'report:clients:owing', value: true } ]} />
    </View>
    {clients.length ? clients.map(item => <ListRow
      boxed
      key={item.client.id}
      title={item.client.first_name + ' ' + item.client.last_name}
      subtitle={t('report:clients:line', { count: item.contracts, owed: money(item.outstanding) })}
      meta={<View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text className='text-body font-semibold text-ink'>{money(item.revenue)}</Text>
        <Badge label={'client:badge:' + item.badge} tone={BADGE_TONES[item.badge]} />
      </View>}
      onPress={() => navigation.navigate('ClientScreen', { clientId: item.client.id })}
    />) : <EmptyState icon='account-search-outline' label='common:no_data' />}
  </>;

  const owedTab = <>
    <LangAwareView style={{ gap: 8, marginHorizontal: 12, marginVertical: 6 }}>
      <Tile label='report:owed_rent' value={money(data.owed_rent)} change={null} tone={data.owed_rent ? 'danger' : 'muted'} />
      <Tile label='report:owed_fines' value={money(data.owed_fines)} change={null} tone={data.owed_fines ? 'danger' : 'muted'} />
      {data.deposits_held > 0 && <Tile label='report:deposits_held' value={money(data.deposits_held)} change={null} />}
    </LangAwareView>
    <TranslatableText data='report:owed_contracts' className='text-title font-semibold text-ink mx-4 mt-3 mb-1' />
    {data.owed_contracts.length ? data.owed_contracts.map(item => <ListRow
      boxed
      key={item.id}
      title={item.client.first_name + ' ' + item.client.last_name}
      subtitle={plate(item.car.licence_plate) + (item.days_late ? ' · ' + t('report:days_late', { days: item.days_late }) : '')}
      meta={<Text className='text-body font-semibold text-danger'>{money(item.owed)}</Text>}
      onPress={() => navigation.navigate('ContractScreen', { contractId: item.id })}
    />) : <TranslatableText data='common:no_data' className='text-body text-muted mx-4' />}
    <TranslatableText data='report:unpaid_fines' className='text-title font-semibold text-ink mx-4 mt-3 mb-1' />
    {data.unpaid_fines.length ? data.unpaid_fines.map(item => <ListRow
      boxed
      key={item.id}
      title={item.client ? item.client.first_name + ' ' + item.client.last_name : plate(item.licence_plate)}
      subtitle={plate(item.licence_plate) + ' · ' + formatDate(item.committed_at)}
      meta={<Text className='text-body font-semibold text-danger'>{money(item.amount)}</Text>}
      onPress={() => navigation.navigate('FineScreen', { fineId: item.id })}
    />) : <TranslatableText data='common:no_data' className='text-body text-muted mx-4' />}
  </>;

  return (
    <Screen>
      {header}
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {tab === 'month' && monthTab}
        {tab === 'fleet' && fleetTab}
        {tab === 'clients' && clientsTab}
        {tab === 'owed' && owedTab}
      </ScrollView>
    </Screen>
  );
}
