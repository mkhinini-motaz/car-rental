import { Text, TouchableOpacity, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { destroy } from '../../api/expense';
import { destroyIncome, MONEY_QUERIES } from '../../api/money';
import Car from '../../classes/Car';
import Expense, { MAINTENANCE_CATEGORIES } from '../../classes/Expense';
import Income from '../../classes/Income';
import { useIsOwner, useLang, useMoney } from '../../store/hooks';
import { alertConfirm, alertRequestError } from '../../support/alert';
import { formatDate, plate } from '../../support/utils';
import TranslatableText from '../common/TranslatableText';
import Button from '../ui/Button';
import Card from '../ui/Card';
import InfoRow from '../ui/InfoRow';
import ListRow from '../ui/ListRow';
import Icon from '../ui/Icon';
import LangAwareView from '../common/LangAwareView';
import { useOpen } from '../../support/useOpen';
import { useColors } from '../../store/ThemeContext';


function useInvalidateMoney() {
  const queryClient = useQueryClient();
  return () => MONEY_QUERIES.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
}

export function useDeleteExpense() {
  const { selectedLang } = useLang();
  const invalidate = useInvalidateMoney();
  const { mutate } = useMutation({ mutationFn: destroy, onSuccess: invalidate, onError: (error) => alertRequestError(selectedLang, error) });
  return (id: number) => alertConfirm(selectedLang, 'expense:delete:confirm', () => mutate(id));
}

function useDeleteIncome() {
  const { selectedLang } = useLang();
  const invalidate = useInvalidateMoney();
  const { mutate } = useMutation({ mutationFn: destroyIncome, onSuccess: invalidate, onError: (error) => alertRequestError(selectedLang, error) });
  return (id: number) => alertConfirm(selectedLang, 'income:delete:confirm', () => mutate(id));
}

// An expense in a list: category and amount, then the date and details. Tapping opens its car
// (unless `onCar` is off, on the car's own page); the owner removes it with the bin.
export function ExpenseRow({ data, onDelete, opensCar = true }: { data: Expense, onDelete?: () => void, opensCar?: boolean }): React.JSX.Element {
  const COLORS = useColors();
  const money = useMoney();
  const open = useOpen();
  const details = [
    formatDate(data.spent_at), data.car && plate(data.car.licence_plate), data.branch?.name, data.employee?.first_name,
    data.mileage !== null && MAINTENANCE_CATEGORIES.includes(data.category) ? data.mileage + ' km' : null, data.garage, data.note,
  ].filter(Boolean).join(' · ');

  return <ListRow
    title={<TranslatableText data={'expense:category:' + data.category} className='text-body text-ink' />}
    subtitle={details}
    meta={<LangAwareView style={{ gap: 12, alignItems: 'center' }}>
      <Text className='text-body font-semibold text-ink'>{money(data.amount)}</Text>
      {onDelete && <TouchableOpacity onPress={onDelete} hitSlop={8}><Icon name='delete-outline' size={20} color={COLORS.danger} /></TouchableOpacity>}
    </LangAwareView>}
    icon='receipt-text-outline'
    onPress={opensCar && data.car_id ? () => open.car(data.car_id!) : undefined}
  />;
}

// The car's life in money, for the owner: what it cost (purchase, fees, interest, running costs),
// how much of that its rentals earned back, its credit, when it must leave the fleet, and this month.
export function CarMoneyCards({ data, onEditPurchase }: { data: Car, onEditPurchase: () => void }): React.JSX.Element|null {
  const COLORS = useColors();
  const money = useMoney();
  const report = data.money;
  if (! report) {
    return null;
  }

  const now = Date.now() / 1000;
  const financing = report.financing;
  const payback = report.payback;
  const deadlineTone = report.months_left === null ? undefined : report.months_left < 0 ? 'danger' : report.months_left < 6 ? 'warn' : undefined;

  return <>
    <Card>
      <TranslatableText data='car:money:cost' className='text-title font-semibold text-ink' />
      {report.purchase_price === null ? <>
        <TranslatableText data='car:money:no_price' className='text-body text-muted' />
        <Button label='car:purchase' variant='secondary' icon='cash-plus' onPress={onEditPurchase} compact />
      </> : <>
        <InfoRow label='car:purchase_price' value={money(report.purchase_price)} />
        {report.purchase_fees > 0 && <InfoRow label='car:purchase_fees' value={money(report.purchase_fees)} />}
        {report.interest > 0 && <InfoRow label='car:money:interest' value={money(report.interest)} />}
      </>}
      {(Object.keys(report.costs) as (keyof typeof report.costs)[]).filter(group => report.costs[group] > 0).map(group =>
        <InfoRow key={group} label={'car:money:cost:' + group} value={money(report.costs[group])} />
      )}
      <View className='h-px bg-line my-1' />
      <InfoRow label='car:money:total_cost' value={money(report.total_cost)} bold />
    </Card>

    <Card>
      <TranslatableText data='car:money:payback' className='text-title font-semibold text-ink' />
      {!! report.history_since && <TranslatableText data='car:money:history_since' params={{ date: formatDate(report.history_since) }} className='text-meta text-warn' />}
      <InfoRow label='car:money:earned' value={money(report.earned)} tone='ok' />
      {report.earned_before > 0 && <InfoRow label='car:money:earned_before' value={money(report.earned_before)} />}
      {report.other_income > 0 && <InfoRow label='car:money:other_income' value={money(report.other_income)} tone='ok' />}
      {payback !== null && <>
        <InfoRow label='car:money:total_cost' value={money(report.total_cost)} />
        <View style={{ height: 10, borderRadius: 5, backgroundColor: COLORS.line, overflow: 'hidden', marginVertical: 4 }}>
          <View style={{ width: Math.min(100, payback * 100) + '%', height: '100%', backgroundColor: payback >= 1 ? COLORS.ok : COLORS.info }} />
        </View>
        <InfoRow label='car:money:payback:percent' value={Math.round(payback * 100) + ' %'} bold />
        {payback >= 1 && <TranslatableText data='car:money:paid_off' className='text-body text-ok' />}
        <InfoRow label='car:money:monthly_earned' value={money(report.monthly_earned)} />
      </>}
      {data.sold_at && <>
        <View className='h-px bg-line my-1' />
        <InfoRow label='car:sale:price' value={money(data.sale_price ?? 0)} />
        <InfoRow label='car:money:result' value={money(report.result)} tone={report.result < 0 ? 'danger' : 'ok'} bold />
      </>}
    </Card>

    {financing && <Card>
      <TranslatableText data='car:financing' className='text-title font-semibold text-ink' />
      <InfoRow label='car:financing:paid' value={financing.paid + ' / ' + financing.months} />
      <InfoRow label='car:financing:instalment' value={money(financing.amount)} />
      <InfoRow label='car:financing:remaining' value={money(financing.remaining)} bold />
      {financing.next_due_at && <InfoRow label='car:financing:next' value={formatDate(financing.next_due_at)} tone={financing.next_due_at < now + 7 * 24 * 3600 ? 'warn' : undefined} />}
      <InfoRow label='car:financing:ends' value={formatDate(financing.ends_at)} />
      {financing.lender && <InfoRow label='car:lender' value={financing.lender} />}
    </Card>}

    <Card>
      <TranslatableText data='car:money:this_month' className='text-title font-semibold text-ink' />
      <InfoRow label='car:money:days_rented' value={String(report.this_month.days_rented)} />
      <InfoRow label='car:money:idle_days' value={String(report.this_month.idle_days)} />
      <InfoRow label='car:money:maintenance_days' value={String(report.this_month.maintenance_days)} />
      {report.cost_per_km !== null && <InfoRow label='car:money:cost_per_km' value={money(report.cost_per_km)} />}
      {report.fleet_deadline && ! data.sold_at && <>
        <View className='h-px bg-line my-1' />
        <InfoRow label='car:fleet_deadline' value={formatDate(report.fleet_deadline)} tone={deadlineTone} bold />
        <TranslatableText
          data={report.months_left! < 0 ? 'car:fleet_deadline:passed' : 'car:fleet_deadline:months'}
          params={{ months: report.months_left }}
          className='text-meta text-muted'
        />
        {data.expected_sale_price ? <InfoRow label='car:expected_sale_price' value={money(data.expected_sale_price)} /> : null}
      </>}
    </Card>
  </>;
}

// The car's expenses and other income, newest first; the owner can remove them.
export function CarMoneyLists({ data }: { data: Car }): React.JSX.Element {
  const COLORS = useColors();
  const isOwner = useIsOwner();
  const money = useMoney();
  const deleteExpense = useDeleteExpense();
  const deleteIncome = useDeleteIncome();

  return <>
    <TranslatableText data='expense:label' className='text-title font-semibold text-ink mx-4 mt-4 mb-1' />
    <View className='mx-3 bg-surface border border-line rounded-xl overflow-hidden'>
      {data.expenses?.length ?
        data.expenses.map(expense => <ExpenseRow key={expense.id} data={expense} opensCar={false} onDelete={isOwner ? () => deleteExpense(expense.id) : undefined} />) :
        <TranslatableText data='common:no_data' className='text-body text-muted p-3' />
      }
    </View>
    {isOwner && !! data.incomes?.length && <>
      <TranslatableText data='income:label' className='text-title font-semibold text-ink mx-4 mt-4 mb-1' />
      <View className='mx-3 bg-surface border border-line rounded-xl overflow-hidden'>
        {data.incomes.map((income: Income) => <ListRow
          key={income.id}
          icon='cash-plus'
          iconColor={COLORS.ok}
          title={<TranslatableText data={'income:category:' + income.category} className='text-body text-ink' />}
          subtitle={[ formatDate(income.received_at), income.note ].filter(Boolean).join(' · ')}
          meta={<LangAwareView style={{ gap: 12, alignItems: 'center' }}>
            <Text className='text-body font-semibold text-ok'>{money(income.amount)}</Text>
            <TouchableOpacity onPress={() => deleteIncome(income.id)} hitSlop={8}><Icon name='delete-outline' size={20} color={COLORS.danger} /></TouchableOpacity>
          </LangAwareView>}
          chevron={false}
        />)}
      </View>
    </>}
  </>;
}
