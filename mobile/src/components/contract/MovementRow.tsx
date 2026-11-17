import { Linking, Text, TouchableOpacity, View } from 'react-native';
import { useAgency } from '../../api/agency';
import { staffName } from '../../classes/Agency';
import Contract, { remainingRent, STATUS_OUT, STATUS_RESERVED } from '../../classes/Contract';
import { clientName } from '../../classes/Client';
import { STAGE_PICKUP, STAGE_RETURN } from '../../classes/Inspection';
import { Tone } from '../../constants';
import { useLang } from '../../store/hooks';
import { formatDate, formatMoneyDisplay, formatTime, plate } from '../../support/utils';
import { usePendingHandovers } from '../../support/handoverQueue';
import { useOpen } from '../../support/useOpen';
import Tappable from '../ui/Tappable';
import LangAwareView from '../common/LangAwareView';
import TranslatableText from '../common/TranslatableText';
import { isSwatch } from '../Form/ColorField';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Icon from '../ui/Icon';
import { useColors } from '../../store/ThemeContext';

const HOUR = 60 * 60;

interface MovementRowProps {
  data: Contract,
  direction: 'out' | 'back',
  showDate?: boolean, // a week: the day before the time
  onPress: () => void, // opens the contract
  onHandover: (stage: number) => void, // pick up or take back
}

// Where a car is in its day: going out (booked, late, handed over) or coming back (due, overdue,
// back). The time and the plate are large enough to read at arm's length.
export function movementState(data: Contract, direction: 'out' | 'back', now: number): { label: string, tone: Tone, isPending: boolean } {
  if (direction === 'out') {
    if (data.status !== STATUS_RESERVED) {
      return { label: 'movement:handed_over', tone: 'ok', isPending: false };
    }
    return data.starts_at < now ? { label: 'movement:late', tone: 'danger', isPending: true } :
      data.starts_at < now + HOUR ? { label: 'movement:due_now', tone: 'warn', isPending: true } :
      { label: 'movement:ready', tone: 'info', isPending: true };
  }
  if (data.status !== STATUS_OUT) {
    return { label: 'movement:back', tone: 'ok', isPending: false };
  }
  return data.ends_at < now ? { label: 'movement:overdue', tone: 'danger', isPending: true } :
    data.ends_at < now + HOUR ? { label: 'movement:due_now', tone: 'warn', isPending: true } :
    { label: 'movement:later', tone: 'info', isPending: true };
}

export default function MovementRow({ data, direction, showDate = false, onPress, onHandover }: MovementRowProps): React.JSX.Element {
  const COLORS = useColors();
  const { selectedLang } = useLang();
  const now = Date.now() / 1000;
  const state = movementState(data, direction, now);
  const isQueued = usePendingHandovers().some(item => item.contractId === data.id);
  const open = useOpen();
  const time = direction === 'out' ? (data.picked_up_at ?? data.starts_at) : (data.returned_at ?? data.ends_at);
  const location = direction === 'out' ? data.pickup_location : data.return_location;
  const owed = data.paid === undefined ? 0 : remainingRent(data);
  const car = data.car;
  const { data: agency } = useAgency();
  const assignee = agency?.staff?.find(user => user.id === (direction === 'out' ? data.pickup_user_id : data.return_user_id));

  return (
    <Card onPress={onPress}>
      <LangAwareView style={{ gap: 12 }}>
        <View style={{ width: 58, alignItems: 'center' }}>
          {showDate && <Text className='text-meta text-muted'>{formatDate(time).slice(0, 5)}</Text>}
          <Text style={{ fontSize: 18, fontWeight: '700', color: state.tone === 'danger' ? COLORS.danger : COLORS.ink }}>{formatTime(time)}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <LangAwareView style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <Tappable onPress={car ? () => open.car(car.id) : undefined}>
              <Text style={{ fontSize: 20, fontWeight: '700', letterSpacing: 0.5, color: COLORS.ink, flexShrink: 1 }} numberOfLines={1}>{car && plate(car.licence_plate)}</Text>
            </Tappable>
            <Badge label={state.label} tone={state.tone} />
          </LangAwareView>
          {car && <LangAwareView style={{ gap: 6, alignItems: 'center' }}>
            <Text className='text-body text-ink'>{car.manufacturer} {car.model_name}</Text>
            {car.colour && (isSwatch(car.colour) ?
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: car.colour, borderWidth: 1, borderColor: '#00000033' }} /> :
              <Text className='text-meta text-muted'>{car.colour}</Text>)}
          </LangAwareView>}
          {data.client && <LangAwareView style={{ gap: 8, alignItems: 'center' }}>
            <Icon name='account-outline' size={18} color={COLORS.muted} />
            <Tappable onPress={() => open.client(data.client!.id)}>
              <Text className='text-body text-primary font-semibold' style={{ flexShrink: 1 }} numberOfLines={1}>{clientName(data.client)}</Text>
            </Tappable>
            <TouchableOpacity onPress={() => Linking.openURL('tel:' + data.client!.phone)} hitSlop={10}>
              <Icon name='phone' size={20} color={COLORS.info} />
            </TouchableOpacity>
          </LangAwareView>}
          {location && <LangAwareView style={{ gap: 8, alignItems: 'center' }}>
            <Icon name='map-marker-outline' size={18} color={COLORS.warn} />
            <Text className='text-body font-semibold' style={{ color: COLORS.warn }}>{location}</Text>
          </LangAwareView>}
          {assignee && <LangAwareView style={{ gap: 8, alignItems: 'center' }}>
            <Icon name='account-hard-hat-outline' size={18} color={COLORS.muted} />
            <Text className='text-body text-muted'>{staffName(assignee)}</Text>
          </LangAwareView>}
          {owed > 0 && <TranslatableText data='payment:remaining:value' params={{ amount: formatMoneyDisplay(owed, selectedLang) }} className='text-body font-semibold text-danger' />}
          {isQueued && <Badge label='handover:pending' tone='warn' />}
          {state.isPending && ! isQueued && <View style={{ alignSelf: 'flex-start', marginTop: 4 }}>
            <Button
              compact
              label={direction === 'out' ? 'handover:pickup' : 'handover:return'}
              icon={direction === 'out' ? 'key-arrow-right' : 'car-arrow-left'}
              onPress={() => onHandover(direction === 'out' ? STAGE_PICKUP : STAGE_RETURN)}
            />
          </View>}
        </View>
      </LangAwareView>
    </Card>
  );
}
