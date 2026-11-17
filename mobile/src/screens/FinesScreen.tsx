import { FlatList, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { index } from '../api/fine';
import { useNetworkErrorAlert } from '../store/hooks';
import FullScreenLoader from '../components/common/FullScreenLoader';
import FineRow from '../components/fine/FineRow';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { useHeaderAction } from '../components/ui/HeaderAction';
import Screen from '../components/ui/Screen';
import { ScreenProps } from '../navigation/types';

// Traffic fines, unpaid first.
export default function FinesScreen({ navigation }: ScreenProps<'Fines'>): React.JSX.Element {
  const { isLoading, error, data, refetch, isRefetching } = useQuery({ queryKey: ['fine.index'], queryFn: index });
  useNetworkErrorAlert(error);
  const newFine = () => navigation.navigate('FineFormScreen');
  useHeaderAction(navigation, 'plus-circle', newFine);

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
        contentContainerStyle={{ paddingVertical: 6 }}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <FineRow data={item} onPress={() => navigation.navigate('FineScreen', { fineId: item.id })} />}
        ListEmptyComponent={<EmptyState icon='receipt-text-check-outline' label='fine:none' action={{ label: 'fine:new', onPress: newFine }} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); }} />}
      />
    </Screen>
  );
}
