import { Text, View } from 'react-native';
import Fine from '../../classes/Fine';
import { clientName } from '../../classes/Client';
import { Tone } from '../../constants';
import { useMoney } from '../../store/hooks';
import { formatDateTime, plate } from '../../support/utils';
import LangAwareView from '../common/LangAwareView';
import TranslatableText from '../common/TranslatableText';
import Badge from '../ui/Badge';
import Card from '../ui/Card';
import Tappable from '../ui/Tappable';
import { useOpen } from '../../support/useOpen';

// unpaid, paid by the client, from the deposit, borne by the agency
const STATUS_TONES: Record<number, Tone> = { 1: 'danger', 2: 'ok', 3: 'ok', 4: 'muted' };

export function FineStatus({ status }: { status: number }): React.JSX.Element {
  return <Badge label={'fine:status:' + status} tone={STATUS_TONES[status]} />;
}

export default function FineRow({ data, onPress }: { data: Fine, onPress?: () => void }): React.JSX.Element {
  const money = useMoney();
  const client = data.contract?.client ?? data.client; // the rental's, or the renter named for a rental kept on paper
  const open = useOpen();

  return (
    <Card onPress={onPress}>
      <LangAwareView style={{ gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <FineStatus status={data.status} />
        <Text className='text-title font-semibold text-ink'>{money(data.amount)}</Text>
      </LangAwareView>
      {data.car && <Tappable onPress={() => open.car(data.car!.id)}><Text className='text-body font-semibold text-ink'>{plate(data.car.licence_plate)} · {data.car.manufacturer} {data.car.model_name}</Text></Tappable>}
      <Text className='text-meta text-muted'>{formatDateTime(data.committed_at)}{data.reference ? ' · ' + data.reference : ''}</Text>
      {client && <Tappable onPress={() => open.client(client.id)}><Text className='text-body text-primary font-semibold'>{clientName(client)}</Text></Tappable>}
      {! data.contract_id && <TranslatableText data='fine:no_contract' className='text-meta text-warn' />}
      {!! data.paid_out_at && <TranslatableText data='fine:payout:line' params={{ date: formatDateTime(data.paid_out_at) }} className='text-meta text-muted' />}
      {!! data.note && <View><Text className='text-meta text-muted italic'>{data.note}</Text></View>}
    </Card>
  );
}
