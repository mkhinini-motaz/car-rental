import { Linking, Text, TouchableOpacity } from 'react-native';
import Contract, { remainingRent } from '../../classes/Contract';
import { clientName } from '../../classes/Client';
import { useMoney } from '../../store/hooks';
import { formatDateTime, plate } from '../../support/utils';
import LangAwareView from '../common/LangAwareView';
import TranslatableText from '../common/TranslatableText';
import Card from '../ui/Card';
import Icon from '../ui/Icon';
import Tappable from '../ui/Tappable';
import { useOpen } from '../../support/useOpen';
import { useColors } from '../../store/ThemeContext';

interface ContractRowProps {
  data: Contract,
  timeLabel: string, // e.g. 'contract:ends_at:value', with ${date}
  time: number,
  location?: string|null, // where to hand the car over or collect it, when not at the agency
  isLate?: boolean,
  onPress: () => void,
}

// A contract in a list: the plate and model, the client with a call button, when, where, and the rent still owed.
export default function ContractRow({ data, timeLabel, time, location, isLate = false, onPress }: ContractRowProps): React.JSX.Element {
  const COLORS = useColors();
  const money = useMoney();
  const remaining = data.paid === undefined ? 0 : remainingRent(data);
  const open = useOpen();

  return (
    <Card onPress={onPress}>
      {data.car && <LangAwareView style={{ gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <Tappable onPress={() => open.car(data.car!.id)}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.ink }}>{plate(data.car.licence_plate)}</Text>
        </Tappable>
        <Text className='text-body text-muted'>{data.car.manufacturer} {data.car.model_name}</Text>
      </LangAwareView>}
      {data.client && <LangAwareView style={{ gap: 8, alignItems: 'center' }}>
        <Icon name='account-outline' size={18} color={COLORS.muted} />
        <Tappable onPress={() => open.client(data.client!.id)}>
          <Text className='text-body text-primary font-semibold' style={{ flexShrink: 1 }}>{clientName(data.client)}</Text>
        </Tappable>
        <TouchableOpacity onPress={() => Linking.openURL('tel:' + data.client!.phone)} hitSlop={10}>
          <Icon name='phone' size={20} color={COLORS.info} />
        </TouchableOpacity>
      </LangAwareView>}
      <TranslatableText data={timeLabel} params={{ date: formatDateTime(time) }} className={'text-body ' + (isLate ? 'font-semibold text-danger' : 'text-ink')} />
      {location && <LangAwareView style={{ gap: 8, alignItems: 'center' }}>
        <Icon name='map-marker-outline' size={18} color={COLORS.warn} />
        <Text className='text-body font-semibold text-warn'>{location}</Text>
      </LangAwareView>}
      {remaining > 0 && <TranslatableText data='payment:remaining:value' params={{ amount: money(remaining) }} className='text-body font-semibold text-danger' />}
    </Card>
  );
}
