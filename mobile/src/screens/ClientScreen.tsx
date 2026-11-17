import { useEffect } from 'react';
import { FlatList, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { show } from '../api/clients';
import { clientName } from '../classes/Client';
import { CLIENT_DOCUMENTS } from '../classes/Document';
import { useIsOwner, useMoney, useNetworkErrorAlert } from '../store/hooks';
import { formatDate, formatDateTime, plate } from '../support/utils';
import ClientDetails from '../components/client/ClientDetails';
import FullScreenLoader from '../components/common/FullScreenLoader';
import TranslatableText from '../components/common/TranslatableText';
import ContractStatus from '../components/contract/ContractStatus';
import Documents from '../components/document/Documents';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ErrorState from '../components/ui/ErrorState';
import InfoRow from '../components/ui/InfoRow';
import ListRow from '../components/ui/ListRow';
import Screen from '../components/ui/Screen';
import { ScreenProps } from '../navigation/types';

// A client: details and blacklist warnings, what they brought in and how they behave, their rentals.
export default function ClientScreen({ route, navigation }: ScreenProps<'ClientScreen'>): React.JSX.Element {
  const { clientId } = route.params;
  const money = useMoney();
  const isOwner = useIsOwner();
  const { isLoading, error, data, refetch } = useQuery({ queryKey: ['client.show', { id: clientId }], queryFn: show });
  useNetworkErrorAlert(error);

  useEffect(() => {
    if (data) {
      navigation.setOptions({ title: clientName(data) });
    }
  }, [data, navigation]);

  if (isLoading) {
    return <FullScreenLoader />;
  }
  if (! data) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  const stats = data.stats;

  return (
    <Screen>
      <FlatList
        data={data.contracts}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={<>
          <ClientDetails data={data} />
          <Documents owner='client' ownerId={clientId} documents={data.documents ?? []} types={CLIENT_DOCUMENTS} hint='document:private' />
          <View className='mx-3 my-1.5'>
            <Button label='common:edit' variant='secondary' icon='pencil' onPress={() => navigation.navigate('ClientFormScreen', { clientId })} />
          </View>
          {stats && stats.contracts_count === 0 && <Card>
            <TranslatableText data='client:stats:none' params={{ date: formatDate(data.created_at) }} className='text-body text-muted' />
            {stats.rentals_before > 0 && <InfoRow label='client:stats:before' value={String(stats.rentals_before)} />}
          </Card>}
          {stats && stats.contracts_count > 0 && <Card>
            <TranslatableText data='client:stats' className='text-title font-semibold text-ink' />
            <TranslatableText data='client:stats:counted_since' params={{ date: formatDate(data.created_at) }} className='text-meta text-muted' />
            <InfoRow label='client:stats:contracts' value={String(stats.contracts_count)} />
            {stats.rentals_before > 0 && <InfoRow label='client:stats:before' value={String(stats.rentals_before)} />}
            {stats.first_rental_at && <InfoRow label='client:stats:since' value={formatDate(stats.first_rental_at) + ' → ' + formatDate(stats.last_rental_at!)} />}
            <InfoRow label='client:stats:revenue' value={money(stats.revenue)} tone='ok' />
            <InfoRow label='client:stats:average' value={money(stats.average_value) + ' · ' + stats.average_days + ' j'} />
            <InfoRow label='client:stats:outstanding' value={money(stats.outstanding)} tone={stats.outstanding ? 'danger' : undefined} />
            {stats.fines_unpaid > 0 && <InfoRow label='client:stats:fines_unpaid' value={money(stats.fines_unpaid)} tone='danger' />}
            {stats.damage_charged > 0 && <InfoRow label='client:stats:damage' value={money(stats.damage_charged)} />}
            {stats.repair_costs > 0 && <InfoRow label='client:stats:repairs' value={money(stats.repair_costs)} tone='warn' />}
            {stats.deposits_kept > 0 && <InfoRow label='client:stats:deposits_kept' value={money(stats.deposits_kept)} />}
            <InfoRow label='client:stats:late_returns' value={stats.late_returns ? stats.late_returns + ' · ' + stats.late_hours + ' h' : '0'} tone={stats.late_returns ? 'warn' : undefined} />
            {(stats.cancellations > 0 || stats.no_shows > 0) && <InfoRow label='client:stats:cancellations' value={stats.cancellations + ' · ' + stats.no_shows} />}
            {isOwner && <InfoRow label='client:stats:net' value={money(stats.net)} tone={stats.net < 0 ? 'danger' : 'ok'} bold />}
          </Card>}
          <TranslatableText data='client:history' className='text-title font-semibold text-ink mx-4 mt-4 mb-1' />
        </>}
        renderItem={({ item }) => <ListRow
          boxed
          title={item.car ? plate(item.car.licence_plate) + ' · ' + item.car.manufacturer + ' ' + item.car.model_name : '—'}
          subtitle={formatDateTime(item.starts_at) + ' → ' + formatDateTime(item.ends_at)}
          meta={<ContractStatus status={item.status} />}
          onPress={() => navigation.navigate('ContractScreen', { contractId: item.id })}
        />}
        ListEmptyComponent={<TranslatableText data='common:no_data' className='text-body text-muted mx-4' />}
      />
    </Screen>
  );
}
