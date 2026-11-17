import ContractClass from '../../classes/Contract';
import { clientName } from '../../classes/Client';
import { useMoney, useT } from '../../store/hooks';
import { diffInDays, formatDateTime } from '../../support/utils';
import TranslatableText from '../common/TranslatableText';
import Card from '../ui/Card';
import InfoRow from '../ui/InfoRow';
import { useOpen } from '../../support/useOpen';

// A contract read-only (closed): who, when, where, and for how much.
export default function Contract({ data, onPress }: { data: ContractClass, onPress?: () => void }): React.JSX.Element {
  const money = useMoney();
  const t = useT();
  const days = diffInDays(data.starts_at, data.ends_at);
  const open = useOpen();

  return (
    <Card onPress={onPress}>
      {data.client && <InfoRow label='contract:client' value={clientName(data.client)} onPress={() => open.client(data.client!.id)} />}
      {data.second_driver && <InfoRow label='driver:second' value={clientName(data.second_driver)} onPress={() => open.client(data.second_driver!.id)} />}
      {data.pickup_location && <InfoRow label='location:pickup' value={data.pickup_location} />}
      {data.return_location && <InfoRow label='location:return' value={data.return_location} />}
      <InfoRow label='contract:starts_at' value={formatDateTime(data.starts_at)} />
      <InfoRow label='contract:ends_at' value={formatDateTime(data.ends_at)} />
      <InfoRow label='contract:daily_price' value={money(data.daily_price)} />
      <InfoRow label='client:days_rented' params={{ days }} value={money(data.total_price)} bold />
      {!! data.source && <InfoRow label='contract:source' value={t('contract:source:' + data.source) + (data.broker ? ' · ' + data.broker : '')} />}
      {data.commission > 0 && <InfoRow label='contract:commission:label' value={money(data.commission)} />}
      {!! data.note && <TranslatableText data={data.note} className='text-meta text-muted italic' />}
    </Card>
  );
}
