import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { employees } from '../api/money';
import { employeeName } from '../classes/Employee';
import { useMoney, useNetworkErrorAlert } from '../store/hooks';
import FullScreenLoader from '../components/common/FullScreenLoader';
import TranslatableText from '../components/common/TranslatableText';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { useHeaderAction } from '../components/ui/HeaderAction';
import ListRow from '../components/ui/ListRow';
import Screen from '../components/ui/Screen';
import { ScreenProps } from '../navigation/types';
import { useColors } from '../store/ThemeContext';

// Payroll (owner): who works at the agency, their salary, and what is still due this month.
export default function EmployeesScreen({ navigation }: ScreenProps<'EmployeesScreen'>): React.JSX.Element {
  const COLORS = useColors();
  const money = useMoney();
  const { isLoading, error, data, refetch, isRefetching } = useQuery({ queryKey: ['employee.index'], queryFn: employees });
  useNetworkErrorAlert(error);
  useHeaderAction(navigation, 'account-plus', () => navigation.navigate('EmployeeFormScreen'));

  if (isLoading) {
    return <FullScreenLoader />;
  }
  if (! data) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  return (
    <Screen>
      <FlatList
        data={data}
        contentContainerStyle={{ paddingVertical: 8 }}
        ListHeaderComponent={<TranslatableText data='payroll:hint' className='text-meta text-muted mx-4 mb-2' />}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => <ListRow
          boxed
          icon={item.user_id ? 'account-key-outline' : 'account-outline'}
          iconColor={item.active ? COLORS.primary : COLORS.muted}
          title={employeeName(item)}
          subtitle={[ item.role_label, money(item.monthly_salary) ].filter(Boolean).join(' · ')}
          meta={! item.active ? <Badge label='payroll:inactive' /> : (item.due_this_month ?? 0) > 0 ?
            <View style={{ alignItems: 'flex-end' }}>
              <TranslatableText data='payroll:due' className='text-meta text-muted' />
              <Text className='text-body font-semibold text-warn'>{money(item.due_this_month!)}</Text>
            </View> :
            <Badge label='payroll:paid' tone='ok' />}
          onPress={() => navigation.navigate('EmployeeScreen', { employeeId: item.id })}
        />}
        ListEmptyComponent={<EmptyState icon='account-group-outline' label='payroll:none' action={{ label: 'payroll:add', onPress: () => navigation.navigate('EmployeeFormScreen') }} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); }} />}
      />
    </Screen>
  );
}
