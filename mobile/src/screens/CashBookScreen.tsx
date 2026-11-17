import { useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CashLine, destroyMovement, show } from '../api/cashbook';
import { index as staff } from '../api/user';
import { translate } from '../i18n';
import { useLang, useNetworkErrorAlert } from '../store/hooks';
import { alertConfirm, alertRequestError } from '../support/alert';
import { formatDate, formatMoneyDisplay, formatTime } from '../support/utils';
import ChipsField from '../components/Form/ChipsField';
import FullScreenLoader from '../components/common/FullScreenLoader';
import LangAwareView from '../components/common/LangAwareView';
import Card from '../components/ui/Card';
import TranslatableText from '../components/common/TranslatableText';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import InfoRow from '../components/ui/InfoRow';
import ListRow from '../components/ui/ListRow';
import Screen from '../components/ui/Screen';
import { ScreenProps } from '../navigation/types';
import { useColors } from '../store/ThemeContext';

const ymd = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// The till for one day: what came in and went out in cash, and the balance; card, transfer and
// cheque payments are summed apart. Filtered by staff member, it shows what they handled.
export default function CashBookScreen({ navigation }: ScreenProps<'CashBook'>): React.JSX.Element {
  const COLORS = useColors();
  const { selectedLang } = useLang();
  const queryClient = useQueryClient();
  const [day, setDay] = useState(() => new Date());
  const [userId, setUserId] = useState<number|null>(null);
  const { isLoading, error, data, refetch, isRefetching } = useQuery({ queryKey: ['cashbook', { date: ymd(day), user_id: userId ?? undefined }], queryFn: show });
  const { data: users } = useQuery({ queryKey: ['user.index'], queryFn: staff });
  useNetworkErrorAlert(error);
  const money = (millimes: number) => formatMoneyDisplay(millimes, selectedLang);
  const shift = (days: number) => setDay(new Date(day.getFullYear(), day.getMonth(), day.getDate() + days));

  const remove = useMutation({
    mutationFn: destroyMovement,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cashbook'] }),
    onError: (requestError) => alertRequestError(selectedLang, requestError),
  });

  const lineLabel = (line: CashLine) => {
    const kind = line.kind === 'movement' ? 'cash:movement:' + line.type :
      line.kind === 'expense' ? 'expense:category:' + line.category :
      line.kind === 'fine' ? 'cash:fine:client' :
      line.kind === 'fine_payout' ? 'cash:fine:agency' :
      line.kind === 'income' ? 'income:category:' + line.category :
      line.kind === 'salary' ? 'cash:salary:' + line.type :
      'cash:' + line.kind;
    return translate(kind, selectedLang) + (line.label ? ' · ' + line.label : '');
  };
  const onLinePress = (line: CashLine) => {
    if (line.contract_id) {
      navigation.navigate('ContractScreen', { contractId: line.contract_id });
    } else if (line.car_id) {
      navigation.navigate('CarScreen', { carId: line.car_id });
    } else if (line.kind === 'car_sale') {
      navigation.navigate('CarScreen', { carId: line.id! });
    } else if (line.kind === 'salary') {
      navigation.navigate('EmployeeScreen', { employeeId: line.id! });
    } else if (line.kind === 'fine' || line.kind === 'fine_payout') {
      navigation.navigate('FineScreen', { fineId: line.id! });
    } else if (line.kind === 'movement') {
      alertConfirm(selectedLang, 'cash:movement:delete:confirm', () => remove.mutate(line.id!));
    }
  };

  const figure = (label: string, amount: number|null, tone?: 'ok'|'danger'|'primary') => amount !== null &&
    <InfoRow key={label} label={label} value={money(amount)} tone={tone} bold={tone === 'primary'} />;
  const isPressable = (line: CashLine) => !! line.contract_id || !! line.car_id || [ 'movement', 'fine', 'fine_payout', 'car_sale', 'salary' ].includes(line.kind);

  return (
    <Screen>
      <LangAwareView style={{ justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8 }}>
        <TouchableOpacity onPress={() => shift(-1)} hitSlop={10}><Icon name='chevron-left' size={32} color={COLORS.primary} /></TouchableOpacity>
        <TouchableOpacity onPress={() => setDay(new Date())}>
          <Text className='text-title font-semibold text-ink'>{formatDate(day.getTime() / 1000)}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => shift(1)} hitSlop={10}><Icon name='chevron-right' size={32} color={COLORS.primary} /></TouchableOpacity>
      </LangAwareView>
      <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
        <ChipsField
          value={userId ?? 0}
          onChange={(value) => setUserId(value || null)}
          options={[ { label: 'cash:everyone', value: 0 }, ...(users ?? []).map(user => ({ label: user.first_name, value: user.id })) ]}
        />
      </View>

      {isLoading || ! data ? <FullScreenLoader /> :
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); }} />}>
          <Card>
            {figure('cash:opening', data.opening)}
            {figure('cash:in', data.cash_in, 'ok')}
            {figure('cash:out', data.cash_out, 'danger')}
            {figure('cash:closing', data.closing, 'primary')}
            {data.opening === null && <TranslatableText data='cash:filtered' className='text-meta text-muted' />}
            {new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime() / 1000 <= data.since && <TranslatableText data='cash:since' params={{ date: formatDate(data.since) }} className='text-meta text-warn' />}
          </Card>

          {data.payments_by_method.length > 0 && <Card>
            <TranslatableText data='cash:payments' className='text-title font-semibold text-ink' />
            {data.payments_by_method.map(item => figure('payment:method:' + item.method, item.amount))}
          </Card>}

          <TranslatableText data='cash:lines' className='text-title font-semibold text-ink mx-4 mt-3 mb-1' />
          <View className='mx-3 bg-surface border border-line rounded-xl overflow-hidden'>
            {data.lines.length === 0 && <TranslatableText data='common:no_data' className='text-body text-muted p-3' />}
            {data.lines.map((line, index) => <ListRow
              key={index}
              left={<Text className='text-meta text-muted' style={{ width: 40 }}>{formatTime(line.at)}</Text>}
              title={lineLabel(line)}
              subtitle={line.user ? line.user.first_name + ' ' + line.user.last_name : undefined}
              meta={<Text className='text-body font-semibold' style={{ color: line.amount < 0 ? COLORS.danger : COLORS.ok }}>{(line.amount > 0 ? '+' : '') + money(line.amount)}</Text>}
              onPress={isPressable(line) ? () => onLinePress(line) : undefined}
              chevron={false}
            />)}
          </View>

          <View style={{ margin: 12, gap: 8 }}>
            <Button label='cash:movement:add' variant='secondary' icon='swap-vertical' onPress={() => navigation.navigate('CashMovementFormScreen')} />
            <Button label='expense:add' variant='secondary' icon='plus' onPress={() => navigation.navigate('ExpenseFormScreen')} />
          </View>
        </ScrollView>
      }
    </Screen>
  );
}
