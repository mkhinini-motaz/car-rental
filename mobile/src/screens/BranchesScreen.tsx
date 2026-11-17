import { FlatList } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { branches } from '../api/money';
import { useMoney, useNetworkErrorAlert } from '../store/hooks';
import FullScreenLoader from '../components/common/FullScreenLoader';
import TranslatableText from '../components/common/TranslatableText';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { useHeaderAction } from '../components/ui/HeaderAction';
import ListRow from '../components/ui/ListRow';
import Screen from '../components/ui/Screen';
import { ScreenProps } from '../navigation/types';
import { useColors } from '../store/ThemeContext';

// The agency's premises and their rent (owner); agency expenses can be tagged with one.
export default function BranchesScreen({ navigation }: ScreenProps<'BranchesScreen'>): React.JSX.Element {
  const COLORS = useColors();
  const money = useMoney();
  const { isLoading, error, data, refetch } = useQuery({ queryKey: ['branch.index'], queryFn: branches });
  useNetworkErrorAlert(error);
  useHeaderAction(navigation, 'plus-circle', () => navigation.navigate('BranchFormScreen'));

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
        ListHeaderComponent={<TranslatableText data='branch:hint' className='text-meta text-muted mx-4 mb-2' />}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => <ListRow
          boxed
          icon='storefront-outline'
          iconColor={COLORS.primary}
          title={item.name}
          subtitle={item.address ?? undefined}
          meta={item.monthly_rent ? money(item.monthly_rent) : undefined}
          onPress={() => navigation.navigate('BranchFormScreen', { branch: item })}
        />}
        ListEmptyComponent={<EmptyState icon='storefront-outline' label='branch:none' action={{ label: 'branch:add', onPress: () => navigation.navigate('BranchFormScreen') }} />}
      />
    </Screen>
  );
}
