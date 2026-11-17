import { ScrollView, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { destroySalaryPayment, employee, MONEY_QUERIES } from '../api/money';
import { employeeName, TYPE_ADVANCE, TYPE_SALARY } from '../classes/Employee';
import { useLang, useMoney, useNetworkErrorAlert } from '../store/hooks';
import { alertConfirm, alertRequestError } from '../support/alert';
import { formatDate, formatLocalPhoneNumber } from '../support/utils';
import FullScreenLoader from '../components/common/FullScreenLoader';
import LangAwareView from '../components/common/LangAwareView';
import TranslatableText from '../components/common/TranslatableText';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ErrorState from '../components/ui/ErrorState';
import { useHeaderAction } from '../components/ui/HeaderAction';
import InfoRow from '../components/ui/InfoRow';
import ListRow from '../components/ui/ListRow';
import Screen from '../components/ui/Screen';
import { ScreenProps } from '../navigation/types';
import { useColors } from '../store/ThemeContext';

// An employee: this month (paid, due), a payment one tap away, and every payment with the year's total.
export default function EmployeeScreen({ route, navigation }: ScreenProps<'EmployeeScreen'>): React.JSX.Element {
  const COLORS = useColors();
  const { employeeId } = route.params;
  const { selectedLang } = useLang();
  const money = useMoney();
  const queryClient = useQueryClient();
  const { isLoading, error, data, refetch } = useQuery({ queryKey: ['employee.show', { id: employeeId }], queryFn: employee });
  useNetworkErrorAlert(error);
  useHeaderAction(navigation, data ? 'pencil' : null, () => navigation.navigate('EmployeeFormScreen', { employee: data }));
  const remove = useMutation({
    mutationFn: (paymentId: number) => destroySalaryPayment(employeeId, paymentId),
    onSuccess: () => MONEY_QUERIES.forEach(key => queryClient.invalidateQueries({ queryKey: [key] })),
    onError: (requestError) => alertRequestError(selectedLang, requestError),
  });

  if (isLoading) {
    return <FullScreenLoader />;
  }
  if (! data) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  const due = data.due_this_month ?? 0;
  const pay = (type: number, amount?: number) => navigation.navigate('SalaryPaymentFormScreen', { employee: data, type, amount });

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <Card>
          <Text className='text-title font-semibold text-ink'>{employeeName(data)}</Text>
          {data.role_label && <Text className='text-body text-muted'>{data.role_label}</Text>}
          {data.phone && <InfoRow label='form:phone:label' value={formatLocalPhoneNumber(data.phone)} />}
          <InfoRow label='payroll:salary' value={money(data.monthly_salary)} />
          {data.hired_at && <InfoRow label='payroll:hired_at' value={formatDate(data.hired_at)} />}
          <View className='h-px bg-line my-1' />
          <InfoRow label='payroll:paid_this_month' value={money(data.paid_this_month ?? 0)} />
          <InfoRow label='payroll:due' value={money(due)} tone={due > 0 ? 'warn' : 'ok'} bold />
          <InfoRow label='payroll:year_total' value={money(data.year_total ?? 0)} />
        </Card>
        <LangAwareView style={{ gap: 8, marginHorizontal: 12, marginVertical: 6 }}>
          <View style={{ flex: 1 }}><Button label='payroll:pay_salary' icon='cash' onPress={() => pay(TYPE_SALARY, due || undefined)} disabled={! data.active} /></View>
          <View style={{ flex: 1 }}><Button label='payroll:pay_advance' variant='secondary' icon='cash-fast' onPress={() => pay(TYPE_ADVANCE)} disabled={! data.active} /></View>
        </LangAwareView>
        <TranslatableText data='payroll:payments' className='text-title font-semibold text-ink mx-4 mt-4 mb-1' />
        <View className='mx-3 bg-surface border border-line rounded-xl overflow-hidden'>
          {data.payments?.length ? data.payments.map(payment => <ListRow
            key={payment.id}
            icon={payment.method === 1 ? 'cash' : 'bank-outline'}
            iconColor={COLORS.muted}
            title={<TranslatableText data={'payroll:type:' + payment.type} params={{ month: payment.month }} className='text-body text-ink' />}
            subtitle={formatDate(payment.paid_at) + (payment.note ? ' · ' + payment.note : '')}
            meta={money(payment.amount)}
            onPress={() => alertConfirm(selectedLang, 'payroll:payment:delete', () => remove.mutate(payment.id))}
            chevron={false}
          />) : <TranslatableText data='common:no_data' className='text-body text-muted p-3' />}
        </View>
      </ScrollView>
    </Screen>
  );
}
