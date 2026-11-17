import { Text, TouchableOpacity, View } from 'react-native';
import Availability, { coverage, daysAndHours } from '../../classes/Availability';
import Car from '../../classes/Car';
import { useLang, useMoney, useT } from '../../store/hooks';
import { formatDateTime, plate, periodsAreEqual } from '../../support/utils';
import LangAwareView from '../common/LangAwareView';
import TranslatableText from '../common/TranslatableText';
import Card from '../ui/Card';
import Icon from '../ui/Icon';
import Tappable from '../ui/Tappable';
import { useOpen } from '../../support/useOpen';
import { useColors } from '../../store/ThemeContext';
import { BAR_GREEN } from '../../classes/Theme';

interface AvailableCarProps {
  data: Car, // with `availability_in_period`: its free stretches of the searched period, and `overdue_since`
  searched: [number, number], // the period asked for
  selected: Availability[], // this car's picked slots
  onPress: (period: [number, number]) => void, // picks or drops a free stretch
}

// A translated sentence with its **marked** parts in bold (the time missing, a price's figure).
const withBold = (text: string) => text.split('**').map((part, index) => index % 2 ? <Text key={index} style={{ fontWeight: '700' }}>{part}</Text> : part);

// An amount with its figure marked for `withBold`: '**140** TND'.
const markFigure = (amount: string) => amount.replace(/\d(?:[\d\s.,]*\d)?/, '**$&**');

// A car free for (part of) the searched period: tap a free stretch to book it. Under its dates, a
// bar over the searched period: green where the car is free, empty where it's missing (said in words
// below it). A car still out after its return date comes last, with a warning: it may not be back
// in time.
export default function AvailableCar({ data, searched, selected, onPress }: AvailableCarProps): React.JSX.Element {
  const COLORS = useColors();
  const money = useMoney();
  const open = useOpen();
  const t = useT();
  const { selectedLangWriteFrom } = useLang();
  const duration = (seconds: number) => {
    const [ days, hours ] = daysAndHours(seconds);
    return [ days ? t('duration:days', { days }) : '', hours ? t('duration:hours', { hours }) : '' ].filter(Boolean).join(' ');
  };

  return (
    <Card>
      <LangAwareView style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Tappable onPress={() => open.car(data.id)}>
          <View>
            <Text className='text-body font-semibold text-primary'>{plate(data.licence_plate)}</Text>
            <Text className='text-meta text-muted'>{data.manufacturer} {data.model_name} · {data.model_year}</Text>
          </View>
        </Tappable>
        <Text className='text-body text-ink' style={{ textAlign: selectedLangWriteFrom }}>{withBold(t('car:daily_price', { price: markFigure(money(data.daily_price)) }))}</Text>
      </LangAwareView>
      {!! data.overdue_since && <LangAwareView style={{ alignItems: 'center', gap: 6 }}>
        <Icon name='alert-outline' size={18} color={COLORS.warn} />
        <TranslatableText data='car:overdue_since' params={{ date: formatDateTime(data.overdue_since) }} className='flex-1 text-body font-semibold text-warn' />
      </LangAwareView>}
      {data.availability_in_period?.map(period => {
        const isSelected = selected.some(availability => periodsAreEqual(availability.period, period));
        const { from, to, missingBefore, missingAfter } = coverage(period, searched);
        const missing = [
          missingBefore > 0 ? t('reservation:missing:start', { time: duration(missingBefore) }) : '',
          missingAfter > 0 ? t('reservation:missing:end', { time: duration(missingAfter) }) : '',
        ].filter(Boolean).join(' · ');
        return (
          <View key={period[0]} style={{ gap: 4 }}>
            <TouchableOpacity activeOpacity={0.7} onPress={() => onPress(period)}>
              <LangAwareView style={{
                alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 14, borderRadius: 10, borderWidth: 1, overflow: 'hidden',
                borderColor: isSelected ? COLORS.primary : COLORS.line, backgroundColor: isSelected ? COLORS.primary + '12' : COLORS.surface,
              }}>
                <Icon name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={COLORS.primary} />
                <Text className='text-body text-ink' style={{ flex: 1 }}>{formatDateTime(period[0])} → {formatDateTime(period[1])}</Text>
                {/* The searched period as a track along the bottom edge, green where the car is free; time
                    runs from the reading side, the right in Arabic. */}
                {! isSelected && <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: COLORS.line }}>
                  <View style={{
                    position: 'absolute', top: 0, bottom: 0, width: (to - from) + '%', backgroundColor: BAR_GREEN[COLORS.scheme],
                    [selectedLangWriteFrom === 'right' ? 'right' : 'left']: from + '%',
                  }} />
                </View>}
              </LangAwareView>
            </TouchableOpacity>
            {!! missing && <Text className='text-meta text-ink' style={{ textAlign: selectedLangWriteFrom }}>{withBold(missing)}</Text>}
          </View>
        );
      })}
    </Card>
  );
}
