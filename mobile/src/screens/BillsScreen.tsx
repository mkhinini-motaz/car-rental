import { FlatList } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { bills } from '../api/money';
import { useMoney, useNetworkErrorAlert, useT } from '../store/hooks';
import { formatDate } from '../support/utils';
import FullScreenLoader from '../components/common/FullScreenLoader';
import TranslatableText from '../components/common/TranslatableText';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { useHeaderAction } from '../components/ui/HeaderAction';
import ListRow from '../components/ui/ListRow';
import Screen from '../components/ui/Screen';
import { ScreenProps } from '../navigation/types';
import { useColors } from '../store/ThemeContext';

// Bills that come back (owner): the Today screen shows them a week before they are due.
export default function BillsScreen({ navigation }: ScreenProps<'BillsScreen'>): React.JSX.Element {
  const COLORS = useColors();
  const money = useMoney();
  const t = useT();
  const { isLoading, error, data, refetch } = useQuery({ queryKey: ['bill.index'], queryFn: bills });
  useNetworkErrorAlert(error);
  useHeaderAction(navigation, 'plus-circle', () => navigation.navigate('BillFormScreen'));

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
        ListHeaderComponent={<TranslatableText data='bill:hint' className='text-meta text-muted mx-4 mb-2' />}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => <ListRow
          boxed
          icon='calendar-sync-outline'
          iconColor={item.next_due_at < Date.now() / 1000 + 7 * 24 * 3600 ? COLORS.warn : COLORS.primary}
          title={<TranslatableText data={'expense:category:' + item.category} className='text-body text-ink' />}
          subtitle={[ t('bill:next', { date: formatDate(item.next_due_at) }), t('bill:every', { months: item.every_months }), item.branch?.name, item.note ].filter(Boolean).join(' · ')}
          meta={money(item.amount)}
          onPress={() => navigation.navigate('BillFormScreen', { bill: item })}
        />}
        ListEmptyComponent={<EmptyState icon='calendar-sync-outline' label='bill:none' action={{ label: 'bill:add', onPress: () => navigation.navigate('BillFormScreen') }} />}
      />
    </Screen>
  );
}
