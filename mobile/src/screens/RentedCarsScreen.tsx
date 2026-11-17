import { RefreshControl, SectionList } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { index } from '../api/contract';
import Contract, { STATUS_OUT } from '../classes/Contract';
import { useNetworkErrorAlert } from '../store/hooks';
import { todayBounds } from '../support/day';
import FullScreenLoader from '../components/common/FullScreenLoader';
import TranslatableText from '../components/common/TranslatableText';
import ContractRow from '../components/contract/ContractRow';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import Screen from '../components/ui/Screen';
import { ScreenProps } from '../navigation/types';

// Cars handed over and not back yet: overdue first, then due back today, then later.
export default function RentedCarsScreen({ navigation }: ScreenProps<'RentedCars'>): React.JSX.Element {
  const { isLoading, error, data, refetch, isRefetching } = useQuery({
    queryKey: ['contract.index', { status: [ STATUS_OUT ], orderBy: 'ends_at' }],
    queryFn: index,
  });
  useNetworkErrorAlert(error);

  if (isLoading) {
    return <FullScreenLoader />;
  }
  if (! data) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  const now = Date.now() / 1000;
  const [ , todayEnd ] = todayBounds();
  const group = (test: (contract: Contract) => boolean) => data.filter(test);
  const sections = [
    { title: 'rented:overdue', data: group(contract => contract.ends_at < now) },
    { title: 'rented:today', data: group(contract => contract.ends_at >= now && contract.ends_at < todayEnd) },
    { title: 'rented:later', data: group(contract => contract.ends_at >= todayEnd) },
  ].filter(section => section.data.length);

  return (
    <Screen>
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        renderSectionHeader={({ section }) =>
          <TranslatableText data={section.title} params={{ count: section.data.length }} className='text-title font-semibold text-ink mx-4 mt-4 mb-1' />
        }
        renderItem={({ item }) =>
          <ContractRow
            data={item}
            timeLabel='contract:ends_at:value'
            time={item.ends_at}
            location={item.return_location}
            isLate={item.ends_at < now}
            onPress={() => navigation.navigate('ContractScreen', { contractId: item.id })}
          />
        }
        ListEmptyComponent={<EmptyState icon='car-off' label='rented:none' />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); }} />}
        stickySectionHeadersEnabled={false}
      />
    </Screen>
  );
}
