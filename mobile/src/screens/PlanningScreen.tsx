import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAgency } from '../api/agency';
import { destroyBlock, planning } from '../api/car';
import { atTime } from '../classes/Agency';
import Car from '../classes/Car';
import CarBlock from '../classes/CarBlock';
import Contract, { STATUS_CLOSED, STATUS_OUT, STATUS_RESERVED, STATUS_RETURNED } from '../classes/Contract';
import { translate } from '../i18n';
import { useLang, useNetworkErrorAlert } from '../store/hooks';
import { alertRequestError } from '../support/alert';
import { formatDate, formatDateTime, plate } from '../support/utils';
import FullScreenLoader from '../components/common/FullScreenLoader';
import LangAwareView from '../components/common/LangAwareView';
import TranslatableText from '../components/common/TranslatableText';
import ChipsField from '../components/Form/ChipsField';
import { STATUS_TONES } from '../components/contract/ContractStatus';
import Icon from '../components/ui/Icon';
import Screen from '../components/ui/Screen';
import { TabProps } from '../navigation/types';
import { useColors } from '../store/ThemeContext';

const DAY = 24 * 60 * 60;
const LABEL_WIDTH = 96;
const ROW_HEIGHT = 46;
const HEADER_HEIGHT = 40;
const MONTH_COLUMN = 34;
const ZOOMS = { week: 7, month: 31 };

// The same colours as the status badges.

const midnight = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

// The paper planning board: one row per car, one column per day, contracts as bars coloured by
// status, blocks in dark grey. Tap a bar to open it, an empty day to book or block the car.
export default function PlanningScreen({ navigation }: TabProps<'Planning'>): React.JSX.Element {
  const COLORS = useColors();
  const STATUS_COLOURS: Record<number, string> = Object.fromEntries([ STATUS_RESERVED, STATUS_OUT, STATUS_RETURNED, STATUS_CLOSED ].map(status => [ status, COLORS[STATUS_TONES[status]] ]));
  const OVERDUE = COLORS.danger;
  const BLOCKED = COLORS.mutedFill;
  const { selectedLang } = useLang();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const [zoom, setZoom] = useState<keyof typeof ZOOMS>('week');
  const [start, setStart] = useState(() => midnight(new Date()));
  const days = ZOOMS[zoom];
  const from = start.getTime() / 1000;
  // Days are counted on the calendar, so a daylight-saving change doesn't shift the last one.
  const to = new Date(start.getFullYear(), start.getMonth(), start.getDate() + days).getTime() / 1000;
  const column = zoom === 'week' ? (width - LABEL_WIDTH) / days : MONTH_COLUMN;
  const { isLoading, error, data, refetch, isRefetching } = useQuery({ queryKey: ['planning', { starts_at: from, ends_at: to }], queryFn: planning });
  useNetworkErrorAlert(error);

  const { data: agency } = useAgency();
  const removeBlock = useMutation({
    mutationFn: (block: CarBlock) => destroyBlock(block.car_id, block.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning'] });
      queryClient.invalidateQueries({ queryKey: ['car.index.search'] });
    },
    onError: (requestError) => alertRequestError(selectedLang, requestError),
  });

  const shift = (count: number) => setStart(new Date(start.getFullYear(), start.getMonth(), start.getDate() + count));
  const dayAt = (index: number) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
  const x = (timestamp: number) => (Math.min(Math.max(timestamp, from), to) - from) / DAY * column;
  const now = Date.now() / 1000;
  const todayIndex = Math.floor((midnight(new Date()).getTime() / 1000 - from) / DAY);
  const t = (key: string) => translate(key, selectedLang);

  const onDayPress = (car: Car, day: Date) => Alert.alert(
    car.manufacturer + ' ' + car.model_name + ' · ' + formatDate(day.getTime() / 1000),
    '',
    [
      { text: t('common:cancel'), style: 'cancel' },
      { text: t('block:new'), onPress: () => navigation.navigate('BlockFormScreen', { car, startsAt: day.getTime() / 1000 }) },
      // From the agency's usual pickup time.
      { text: t('planning:reserve'), onPress: () => navigation.navigate('CreateReservation', { car, startsAt: atTime(day, agency?.pickup_time ?? '10:00').getTime() / 1000 }) },
    ],
    { cancelable: true },
  );
  const onBlockPress = (block: CarBlock) => Alert.alert(
    t('block:reason:' + block.reason),
    [ formatDateTime(block.starts_at) + ' → ' + formatDateTime(block.ends_at), block.note ].filter(Boolean).join('\n'),
    [
      { text: t('common:close'), style: 'cancel' },
      { text: t('block:delete'), style: 'destructive', onPress: () => removeBlock.mutate(block) },
    ],
    { cancelable: true },
  );

  const bar = (key: string, startsAt: number, endsAt: number, colour: string, label: string, onPress: () => void) => {
    const left = x(startsAt);
    const barWidth = Math.max(6, x(endsAt) - left);
    return (
      <Pressable key={key} onPress={onPress} style={{ position: 'absolute', left, width: barWidth, top: 7, bottom: 7, backgroundColor: colour, borderRadius: 6, justifyContent: 'center', paddingHorizontal: 4 }}>
        {barWidth > 40 && <Text numberOfLines={1} style={{ color: COLORS.on, fontSize: 13, fontWeight: '600' }}>{label}</Text>}
      </Pressable>
    );
  };
  const isOverdue = (contract: Contract) => contract.status === STATUS_OUT && contract.ends_at < now;
  const contractBar = (contract: Contract) => bar(
    'contract-' + contract.id,
    contract.starts_at,
    isOverdue(contract) ? now : contract.ends_at, // still out: up to now
    isOverdue(contract) ? OVERDUE : STATUS_COLOURS[contract.status],
    contract.client ? contract.client.last_name : '',
    () => navigation.navigate('ContractScreen', { contractId: contract.id }),
  );

  const legend = [
    [ 'contract:status:' + STATUS_RESERVED, STATUS_COLOURS[STATUS_RESERVED] ],
    [ 'contract:status:' + STATUS_OUT, STATUS_COLOURS[STATUS_OUT] ],
    [ 'planning:overdue', OVERDUE ],
    [ 'contract:status:' + STATUS_RETURNED, STATUS_COLOURS[STATUS_RETURNED] ],
    [ 'contract:status:' + STATUS_CLOSED, STATUS_COLOURS[STATUS_CLOSED] ],
    [ 'planning:blocked', BLOCKED ],
  ];

  const board = data && (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ width: LABEL_WIDTH }}>
        <View style={{ height: HEADER_HEIGHT }} />
        {data.map(car =>
          <TouchableOpacity key={car.id} onPress={() => navigation.navigate('CarScreen', { carId: car.id })}>
            <View style={{ height: ROW_HEIGHT, justifyContent: 'center', paddingHorizontal: 6, borderTopWidth: 1, borderColor: COLORS.line }}>
              <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600' }}>{car.manufacturer} {car.model_name}</Text>
              <Text numberOfLines={1} style={{ fontSize: 12, color: COLORS.muted }}>{plate(car.licence_plate)}</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
      <ScrollView horizontal scrollEnabled={zoom === 'month'} showsHorizontalScrollIndicator={zoom === 'month'}>
        <View style={{ width: days * column }}>
          <View style={{ height: HEADER_HEIGHT, flexDirection: 'row' }}>
            {Array.from({ length: days }, (_, index) =>
              <View key={index} style={{ width: column, alignItems: 'center', justifyContent: 'center', backgroundColor: index === todayIndex ? COLORS.primary + '22' : undefined }}>
                <Text style={{ fontSize: 11, color: COLORS.muted }}>{translate('planning:weekday:' + dayAt(index).getDay(), selectedLang)}</Text>
                <Text style={{ fontSize: 14, fontWeight: index === todayIndex ? '700' : '400' }}>{dayAt(index).getDate()}</Text>
              </View>
            )}
          </View>
          {data.map(car =>
            <View key={car.id} style={{ height: ROW_HEIGHT, borderTopWidth: 1, borderColor: COLORS.line }}>
              <View style={[ StyleSheet.absoluteFill, { flexDirection: 'row' } ]}>
                {Array.from({ length: days }, (_, index) =>
                  <Pressable
                    key={index}
                    onPress={() => onDayPress(car, dayAt(index))}
                    style={{ width: column, borderLeftWidth: 1, borderColor: COLORS.line + '88', backgroundColor: index === todayIndex ? COLORS.primary + '11' : undefined }}
                  />
                )}
              </View>
              {car.contracts?.map(contractBar)}
              {car.blocks?.map(block => bar('block-' + block.id, block.starts_at, block.ends_at, BLOCKED, translate('block:reason:' + block.reason, selectedLang), () => onBlockPress(block)))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );

  return (
    <Screen white>
      <LangAwareView style={{ justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8 }}>
        <TouchableOpacity onPress={() => shift(-days)} hitSlop={10}><Icon name='chevron-left' size={32} color={COLORS.primary} /></TouchableOpacity>
        <TouchableOpacity onPress={() => setStart(midnight(new Date()))}>
          <Text className='text-body font-semibold text-ink'>{formatDate(from)} → {formatDate(to - 1)}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => shift(days)} hitSlop={10}><Icon name='chevron-right' size={32} color={COLORS.primary} /></TouchableOpacity>
      </LangAwareView>
      <View style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
        <ChipsField value={zoom} onChange={setZoom} options={(Object.keys(ZOOMS) as (keyof typeof ZOOMS)[]).map(option => ({ label: 'planning:' + option, value: option }))} />
      </View>
      <LangAwareView className='flex-wrap gap-x-3 gap-y-1 px-3 pb-2'>
        {legend.map(([ label, colour ]) =>
          <LangAwareView key={label} className='items-center gap-x-1'>
            <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: colour }} />
            <TranslatableText data={label} className='text-meta text-muted' />
          </LangAwareView>
        )}
      </LangAwareView>
      {isLoading ? <FullScreenLoader /> :
        <ScrollView refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); }} />}>
          {board}
        </ScrollView>
      }
    </Screen>
  );
}
