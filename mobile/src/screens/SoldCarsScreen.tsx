import { FlatList } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { soldCars } from '../api/money';
import { useMoney, useNetworkErrorAlert, useT } from '../store/hooks';
import { formatDate, plate } from '../support/utils';
import FullScreenLoader from '../components/common/FullScreenLoader';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import ListRow from '../components/ui/ListRow';
import Screen from '../components/ui/Screen';
import { ScreenProps } from '../navigation/types';

// Cars that left the fleet (owner): open one to see what it finally returned.
export default function SoldCarsScreen({ navigation }: ScreenProps<'SoldCarsScreen'>): React.JSX.Element {
  const money = useMoney();
  const t = useT();
  const { isLoading, error, data, refetch } = useQuery({ queryKey: ['car.sold'], queryFn: soldCars });
  useNetworkErrorAlert(error);

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
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => <ListRow
          boxed
          icon='car-off'
          title={plate(item.licence_plate)}
          subtitle={item.manufacturer + ' ' + item.model_name + ' · ' + t('car:sold:on', { date: formatDate(item.sold_at!) })}
          meta={item.sale_price ? money(item.sale_price) : undefined}
          onPress={() => navigation.navigate('CarScreen', { carId: item.id })}
        />}
        ListEmptyComponent={<EmptyState icon='car-off' label='car:sold:none' />}
      />
    </Screen>
  );
}
