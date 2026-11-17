import { FlatList } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { index } from '../api/user';
import { branches } from '../api/money';
import { useNetworkErrorAlert, useT } from '../store/hooks';
import { formatLocalPhoneNumber } from '../support/utils';
import FullScreenLoader from '../components/common/FullScreenLoader';
import TranslatableText from '../components/common/TranslatableText';
import Badge from '../components/ui/Badge';
import ErrorState from '../components/ui/ErrorState';
import { useHeaderAction } from '../components/ui/HeaderAction';
import ListRow from '../components/ui/ListRow';
import Screen from '../components/ui/Screen';
import { ScreenProps } from '../navigation/types';
import { useColors } from '../store/ThemeContext';

// The owner's staff accounts: who can log in, as owner or manager.
export default function StaffScreen({ navigation }: ScreenProps<'StaffScreen'>): React.JSX.Element {
  const COLORS = useColors();
  const t = useT();
  const { isLoading, error, data, refetch } = useQuery({ queryKey: ['user.index'], queryFn: index });
  const { data: branchList = [] } = useQuery({ queryKey: ['branch.index'], queryFn: branches });
  const branchName = (id?: number|null) => branchList.find(branch => branch.id === id)?.name;
  useNetworkErrorAlert(error);
  useHeaderAction(navigation, 'account-plus', () => navigation.navigate('StaffFormScreen'));

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
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={<TranslatableText data='staff:hint' className='text-meta text-muted mx-4 mb-2' />}
        renderItem={({ item }) => <ListRow
          boxed
          icon={item.disabled ? 'account-off-outline' : 'account-key-outline'}
          iconColor={item.disabled ? COLORS.muted : COLORS.primary}
          title={item.first_name + ' ' + item.last_name}
          subtitle={[ t('staff:role:' + item.role), branchName(item.branch_id), formatLocalPhoneNumber(item.phone) ].filter(Boolean).join(' · ')}
          meta={item.disabled ? <Badge label='staff:disabled' tone='danger' /> : item.invited ? <Badge label='staff:invited' tone='warn' /> : undefined}
          onPress={() => navigation.navigate('StaffFormScreen', { user: item })}
        />}
      />
    </Screen>
  );
}
