import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, TouchableOpacity, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboard, useAgency } from '../api/agency';
import { store as storeExpense } from '../api/expense';
import { MONEY_QUERIES, payBill } from '../api/money';
import { employeeName } from '../classes/Employee';
import { CATEGORY_INSTALMENT } from '../classes/Expense';
import { METHOD_CASH, METHOD_TRANSFER } from '../classes/Payment';
import { invalidateContractQueries, markCleaned } from '../api/contract';
import { staffName } from '../classes/Agency';
import { useIsOwner, useLang, useMoney, useNetworkErrorAlert, useT, useUser } from '../store/hooks';
import { alertRequestError } from '../support/alert';
import { todayBounds } from '../support/day';
import { formatDate, formatDateTime, plate } from '../support/utils';
import LangAwareView from '../components/common/LangAwareView';
import TranslatableText from '../components/common/TranslatableText';
import MovementRow, { movementState } from '../components/contract/MovementRow';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import ListGroup from '../components/ui/ListGroup';
import Icon from '../components/ui/Icon';
import ListRow from '../components/ui/ListRow';
import Screen from '../components/ui/Screen';
import Stat from '../components/ui/Stat';
import FullScreenLoader from '../components/common/FullScreenLoader';
import { TabProps } from '../navigation/types';
import { useColors } from '../store/ThemeContext';

const PAPERS = [ 'insurance_ends_at', 'circulation_tax_ends_at', 'technical_control_ends_at' ] as const;
// Day strip: [ first day from today, number of days ].
const RANGES = { yesterday: [ -1, 1 ], today: [ 0, 1 ], tomorrow: [ 1, 1 ], week: [ 0, 7 ] } as const;
type Range = keyof typeof RANGES;

// Days are counted on the calendar, so a daylight-saving change doesn't shift them.
const rangeBounds = (range: Range): [number, number] => {
  const [ first, count ] = RANGES[range];
  const now = new Date();
  return [
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + first).getTime() / 1000,
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + first + count).getTime() / 1000,
  ];
};

// Today's pending movements (late ones included): the Today tab's badge.
export function useTodayCount(): number {
  const [ starts_at, ends_at ] = todayBounds();
  const { data } = useQuery({ queryKey: ['dashboard', { starts_at, ends_at }], queryFn: dashboard });
  const now = Date.now() / 1000;
  return data ? data.pickups.filter(contract => movementState(contract, 'out', now).isPending).length
    + data.returns.filter(contract => movementState(contract, 'back', now).isPending).length : 0;
}

// The agency's day, as the notebook had it: which car goes out and which comes back, in time
// order, with the handover one tap away. Tomorrow and the week are on the day strip.
export default function TodayScreen({ navigation }: TabProps<'Today'>): React.JSX.Element {
  const COLORS = useColors();
  const [range, setRange] = useState<Range>('today');
  const [onlyMine, setOnlyMine] = useState(false); // the pickups, returns and cleaning given to me
  const me = useUser().id;
  const [ todayStart, todayEnd ] = todayBounds();
  const [ starts_at, ends_at ] = range === 'today' ? [ todayStart, todayEnd ] : rangeBounds(range);
  const today = useQuery({ queryKey: ['dashboard', { starts_at: todayStart, ends_at: todayEnd }], queryFn: dashboard });
  const selected = useQuery({ queryKey: ['dashboard', { starts_at, ends_at }], queryFn: dashboard });
  useNetworkErrorAlert(selected.error);
  const data = selected.data && (onlyMine ? {
    ...selected.data,
    pickups: selected.data.pickups.filter(contract => contract.pickup_user_id === me),
    returns: selected.data.returns.filter(contract => contract.return_user_id === me),
    to_clean: selected.data.to_clean.filter(contract => contract.return_user_id === me),
  } : selected.data);
  const { data: agency } = useAgency();
  const expiryLimit = Date.now() / 1000 + (agency?.expiry_warning_days ?? 7) * 24 * 60 * 60;
  const now = Date.now() / 1000;

  const openContract = (contractId: number) => navigation.navigate('ContractScreen', { contractId });
  const openHandover = (contractId: number, stage: number) => navigation.navigate('HandoverScreen', { contractId, stage });
  const openCar = (carId: number) => navigation.navigate('CarScreen', { carId });
  const { selectedLang } = useLang();
  const t = useT();
  const isOwner = useIsOwner();
  const money = useMoney();
  const queryClient = useQueryClient();
  // Paying is always a tap and a confirmation: nothing is paid by itself.
  const clean = useMutation({
    mutationFn: (contractId: number) => markCleaned(contractId, true),
    onSuccess: () => invalidateContractQueries(queryClient),
    onError: (requestError) => alertRequestError(selectedLang, requestError),
  });
  const pay = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: () => MONEY_QUERIES.forEach(key => queryClient.invalidateQueries({ queryKey: [key] })),
    onError: (requestError) => alertRequestError(selectedLang, requestError),
  });
  const askHowPaid = (title: string, action: (method: number) => Promise<unknown>) => Alert.alert(title, t('today:pay:how'), [
    { text: t('common:cancel'), style: 'cancel' },
    { text: t('payment:method:' + METHOD_TRANSFER), onPress: () => pay.mutate(() => action(METHOD_TRANSFER)) },
    { text: t('payment:method:' + METHOD_CASH), onPress: () => pay.mutate(() => action(METHOD_CASH)) },
  ], { cancelable: true });
  const dueBackToday = today.data?.returns.filter(contract => movementState(contract, 'back', now).label !== 'movement:back' && contract.ends_at >= now).length ?? 0;

  const list = (title: string, direction: 'out' | 'back') => {
    const contracts = (direction === 'out' ? data?.pickups : data?.returns) ?? [];
    return <>
      <TranslatableText data={title} params={{ count: contracts.length }} className='text-title font-semibold text-ink mx-4 mt-4 mb-1' />
      {contracts.length ?
        contracts.map(contract => <MovementRow
          key={contract.id}
          data={contract}
          direction={direction}
          showDate={range === 'week'}
          onPress={() => openContract(contract.id)}
          onHandover={stage => openHandover(contract.id, stage)}
        />) :
        <TranslatableText data={direction === 'out' ? 'movement:none:out' : 'movement:none:back'} className='text-body text-muted mx-4 my-2' />
      }
    </>;
  };

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={selected.isRefetching} onRefresh={() => { selected.refetch(); today.refetch(); }} />}>
        {today.data && <View className='px-3 pt-3 gap-y-2'>
          <LangAwareView style={{ gap: 8 }}>
            <Stat label='today:available' value={today.data.cars_available + '/' + today.data.cars_total} tone='ok' onPress={() => navigation.navigate('Cars')} />
            <Stat label='today:out' value={today.data.cars_out} tone='info' onPress={() => navigation.navigate('RentedCars')} />
          </LangAwareView>
          <LangAwareView style={{ gap: 8 }}>
            <Stat label='today:due_back' value={dueBackToday} tone='primary' onPress={() => setRange('today')} />
            <Stat label='today:overdue' value={today.data.overdue} tone={today.data.overdue ? 'danger' : 'muted'} onPress={() => navigation.navigate('RentedCars')} />
          </LangAwareView>
          {today.data.cars_total === 0 && isOwner && // a new agency starts with its fleet
            <EmptyState icon='car-off' label='today:first_car' action={{ label: 'car:new', onPress: () => navigation.navigate('CarFormScreen') }} />}
        </View>}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingTop: 12 }}>
          {[ ...(Object.keys(RANGES) as Range[]).map(option => ({ label: 'today:range:' + option, isOn: range === option, onPress: () => setRange(option) })),
            { label: 'task:mine', isOn: onlyMine, onPress: () => setOnlyMine(current => ! current) },
          ].map(({ label, isOn, onPress }) =>
            <TouchableOpacity key={label} onPress={onPress} activeOpacity={0.7}>
              <View style={{ borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: isOn ? COLORS.primary : COLORS.surface }}>
                <TranslatableText data={label} style={{ color: isOn ? COLORS.onPrimary : COLORS.primary, fontSize: 15, fontWeight: '600' }} />
              </View>
            </TouchableOpacity>
          )}
        </ScrollView>

        {selected.isLoading ? <FullScreenLoader /> :
          ! data ? <ErrorState error={selected.error} onRetry={() => selected.refetch()} /> : <>
            {list('movement:going_out', 'out')}
            {list('movement:coming_back', 'back')}

            {range === 'today' && data.to_clean.length > 0 && <ListGroup title='today:to_clean'>
              {data.to_clean.map(contract => <ListRow
                key={'clean-' + contract.id}
                icon='car-wash'
                iconColor={COLORS.info}
                title={contract.car ? plate(contract.car.licence_plate) + ' · ' + contract.car.manufacturer + ' ' + contract.car.model_name : '—'}
                subtitle={[ t('task:back_since', { date: formatDateTime(contract.returned_at!) }), staffName(agency?.staff?.find(user => user.id === contract.return_user_id)) ].filter(Boolean).join(' · ')}
                meta={<TouchableOpacity onPress={() => clean.mutate(contract.id)} disabled={clean.isPending} hitSlop={10}>
                  <Icon name='checkbox-blank-outline' size={24} color={COLORS.primary} />
                </TouchableOpacity>}
                onPress={() => openContract(contract.id)}
              />)}
            </ListGroup>}
            {range === 'today' && (data.maintenance_due.length > 0 || data.expiring_cars.length > 0) && <ListGroup title='today:cars_to_check'>
              {data.maintenance_due.map(car => <ListRow
                key={'oil-' + car.id}
                icon='oil'
                iconColor={COLORS.warn}
                title={plate(car.licence_plate) + ' · ' + car.manufacturer + ' ' + car.model_name}
                subtitle={<TranslatableText
                  data={car.oil_change?.last_at === null ? 'car:oil_change:unknown' : car.oil_change?.due_mileage == null ? 'car:oil_change:due_date' : 'car:oil_change:due'}
                  params={{ km: car.oil_change?.due_mileage, date: formatDate(car.oil_change?.due_at ?? 0) }}
                  className='text-meta text-muted'
                />}
                meta={<Badge label='dashboard:maintenance' tone='warn' />}
                onPress={() => openCar(car.id)}
              />)}
              {data.expiring_cars.map(car => <ListRow
                key={'papers-' + car.id}
                icon='file-alert-outline'
                iconColor={COLORS.warn}
                title={plate(car.licence_plate) + ' · ' + car.manufacturer + ' ' + car.model_name}
                subtitle={<View>
                  {PAPERS.filter(paper => car[paper] < expiryLimit).map(paper =>
                    <TranslatableText key={paper} data={'car:' + paper} params={{ date: formatDate(car[paper]) }} className='text-meta text-muted' />
                  )}
                </View>}
                meta={<Badge label='today:papers' tone={PAPERS.some(paper => car[paper] < now) ? 'danger' : 'warn'} />}
                onPress={() => openCar(car.id)}
              />)}
            </ListGroup>}
            {range === 'today' && (data.instalments_due?.length || data.bills_due?.length || data.salaries_due?.length) ? <ListGroup title='today:to_pay'>
              {data.instalments_due?.map(due => <ListRow
                key={'instalment-' + due.car.id}
                icon='bank-transfer-out'
                iconColor={COLORS.warn}
                title={t('today:instalment', { plate: plate(due.car.licence_plate) })}
                subtitle={[ formatDate(due.next_due_at!), due.lender, (due.paid + 1) + ' / ' + due.months ].filter(Boolean).join(' · ')}
                meta={money(due.amount)}
                onPress={() => askHowPaid(t('today:instalment', { plate: plate(due.car.licence_plate) }), method => storeExpense({
                  car_id: due.car.id, category: CATEGORY_INSTALMENT, amount: due.amount, spent_at: Math.floor(Date.now() / 1000), method: method as 1,
                  mileage: null, garage: null, note: due.lender,
                }))}
              />)}
              {data.bills_due?.map(bill => <ListRow
                key={'bill-' + bill.id}
                icon='calendar-sync-outline'
                iconColor={COLORS.warn}
                title={<TranslatableText data={'expense:category:' + bill.category} className='text-body text-ink' />}
                subtitle={[ formatDate(bill.next_due_at), bill.branch?.name, bill.note ].filter(Boolean).join(' · ')}
                meta={money(bill.amount)}
                onPress={() => askHowPaid(t('expense:category:' + bill.category), method => payBill(bill.id, method))}
              />)}
              {data.salaries_due?.map(({ employee, due }) => <ListRow
                key={'salary-' + employee.id}
                icon='account-cash-outline'
                iconColor={COLORS.warn}
                title={employeeName(employee)}
                subtitle={t('today:salary_due')}
                meta={money(due)}
                onPress={() => navigation.navigate('SalaryPaymentFormScreen', { employee, type: 1, amount: due })}
              />)}
            </ListGroup> : null}
            {range === 'today' && !! data.fleet_deadlines?.length && <ListGroup title='today:leaving_fleet'>
              {data.fleet_deadlines.map(({ car, deadline }) => <ListRow
                key={'deadline-' + car.id}
                icon='calendar-alert'
                iconColor={deadline < now ? COLORS.danger : COLORS.warn}
                title={plate(car.licence_plate) + ' · ' + car.manufacturer + ' ' + car.model_name}
                subtitle={t('today:leaves_on', { date: formatDate(deadline) })}
                meta={<Badge label={deadline < now ? 'today:deadline:passed' : 'today:deadline:months'} params={{ months: Math.max(0, Math.floor((deadline - now) / (30 * 24 * 3600))) }} tone={deadline < now ? 'danger' : 'warn'} />}
                onPress={() => openCar(car.id)}
              />)}
            </ListGroup>}
            {range !== 'today' && ! data.pickups.length && ! data.returns.length &&
              <EmptyState icon='calendar-blank-outline' label='movement:none' action={{ label: 'common:reservation:create', onPress: () => navigation.navigate('CreateReservation') }} />}
            <View style={{ height: 24 }} />
          </>
        }
      </ScrollView>
    </Screen>
  );
}
