import { useLayoutEffect } from 'react';
import { FlatList, Image, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { index } from '../api/car';
import { carState } from '../classes/Car';
import { useIsOwner, useLang, useNetworkErrorAlert } from '../store/hooks';
import { todayBounds } from '../support/day';
import { formatMoneyDisplay, plate } from '../support/utils';
import FullScreenLoader from '../components/common/FullScreenLoader';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import Icon from '../components/ui/Icon';
import ListRow from '../components/ui/ListRow';
import Screen from '../components/ui/Screen';
import { TabProps } from '../navigation/types';
import { useColors } from '../store/ThemeContext';

// The fleet: plate and model, where the car is now, its daily price.
export default function CarsScreen({ navigation }: TabProps<'Cars'>): React.JSX.Element {
  const COLORS = useColors();
  const { selectedLang } = useLang();
  const isOwner = useIsOwner();
  const { isLoading, error, data, refetch, isRefetching } = useQuery({ queryKey: ['car.index'], queryFn: index });
  useNetworkErrorAlert(error);
  useLayoutEffect(() => navigation.setOptions({
    headerRight: isOwner ? () => <TouchableOpacity onPress={() => navigation.navigate('CarFormScreen')} hitSlop={10} style={{ marginHorizontal: 16 }}>
      <Icon name='plus-circle' size={28} color={COLORS.onNav} />
    </TouchableOpacity> : undefined,
  }), [navigation, isOwner, COLORS]);

  if (isLoading) {
    return <FullScreenLoader />;
  }
  if (! data) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  const now = Date.now() / 1000;
  const [ , todayEnd ] = todayBounds();

  return (
    <Screen>
      <FlatList
        data={data}
        contentContainerStyle={{ paddingVertical: 8 }}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => {
          const state = carState(item, now, todayEnd);
          return <ListRow
            boxed
            left={item.photo_url ?
              <Image source={{ uri: item.photo_url }} style={{ width: 44, height: 44, borderRadius: 8 }} /> :
              <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: COLORS.canvas, alignItems: 'center', justifyContent: 'center' }}><Icon name='car' size={24} color={COLORS.muted} /></View>}
            title={<Text className='text-body font-semibold text-ink'>{plate(item.licence_plate)}</Text>}
            subtitle={item.manufacturer + ' ' + item.model_name + ' · ' + item.model_year}
            meta={<View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Badge label={state.label} params={state.params} tone={state.tone} />
              <Text className='text-meta text-muted'>{formatMoneyDisplay(item.daily_price, selectedLang)}</Text>
            </View>}
            onPress={() => navigation.navigate('CarScreen', { carId: item.id })}
          />;
        }}
        ListEmptyComponent={<EmptyState icon='car-off' label='car:none' action={isOwner ? { label: 'car:new', onPress: () => navigation.navigate('CarFormScreen') } : undefined} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); }} />}
      />
    </Screen>
  );
}
