import { useEffect } from 'react';
import { FlatList, Image, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { show } from '../api/car';
import { MONEY_QUERIES, undoSale } from '../api/money';
import { carState } from '../classes/Car';
import { clientName } from '../classes/Client';
import { CAR_DOCUMENTS, CIRCULATION_TAX, INSURANCE, TECHNICAL_CONTROL } from '../classes/Document';
import { STAGE_PICKUP } from '../classes/Inspection';
import { useIsOwner, useLang, useMoney, useNetworkErrorAlert, useT } from '../store/hooks';
import { alertConfirm, alertRequestError } from '../support/alert';
import { todayBounds } from '../support/day';
import { formatDate, formatDateTime, plate } from '../support/utils';
import FullScreenLoader from '../components/common/FullScreenLoader';
import LangAwareView from '../components/common/LangAwareView';
import TranslatableText from '../components/common/TranslatableText';
import { isSwatch } from '../components/Form/ColorField';
import { CarMoneyCards, CarMoneyLists } from '../components/car/CarMoney';
import ContractStatus from '../components/contract/ContractStatus';
import Documents from '../components/document/Documents';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ErrorState from '../components/ui/ErrorState';
import InfoRow from '../components/ui/InfoRow';
import ListGroup from '../components/ui/ListGroup';
import ListRow from '../components/ui/ListRow';
import Screen from '../components/ui/Screen';
import { ScreenProps } from '../navigation/types';
import { useColors } from '../store/ThemeContext';

// A car: who has it, its papers and maintenance, what it cost and earned (owner), its rentals.
export default function CarScreen({ route, navigation }: ScreenProps<'CarScreen'>): React.JSX.Element {
  const COLORS = useColors();
  const { carId } = route.params;
  const { selectedLang } = useLang();
  const t = useT();
  const isOwner = useIsOwner();
  const money = useMoney();
  const queryClient = useQueryClient();
  const { isLoading, error, data, refetch } = useQuery({ queryKey: ['car.show', { id: carId }], queryFn: show });
  useNetworkErrorAlert(error);
  const unsell = useMutation({
    mutationFn: () => undoSale(carId),
    onSuccess: () => MONEY_QUERIES.forEach(key => queryClient.invalidateQueries({ queryKey: [key] })),
    onError: (requestError) => alertRequestError(selectedLang, requestError),
  });

  useEffect(() => {
    if (data) {
      navigation.setOptions({ title: `${data.manufacturer} ${data.model_name}` });
    }
  }, [data, navigation]);

  if (isLoading) {
    return <FullScreenLoader />;
  }
  if (! data) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  const now = Date.now() / 1000;
  const state = carState(data, now, todayBounds()[1]);
  const paper = (expiresAt: number) => ({ date: formatDate(expiresAt), tone: expiresAt < now ? 'danger' as const : expiresAt < now + 30 * 24 * 3600 ? 'warn' as const : undefined });
  const oilChange = data.oil_change;
  // Due with none recorded: an old car's last one is unknown until it's entered (the expense form opens on oil change).
  const isOilUnknown = !! oilChange && oilChange.last_at === null && oilChange.is_due;

  const header = <>
    <Card>
      {data.photo_url && <Image source={{ uri: data.photo_url }} style={{ width: '100%', height: 170, borderRadius: 8 }} resizeMode='cover' />}
      <LangAwareView style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: COLORS.ink, letterSpacing: 0.5 }}>{plate(data.licence_plate)}</Text>
        {data.sold_at ? <Badge label='car:sold:on' params={{ date: formatDate(data.sold_at) }} tone='muted' /> : <Badge label={state.label} params={state.params} tone={state.tone} />}
      </LangAwareView>
      <LangAwareView style={{ gap: 8, alignItems: 'center' }}>
        <Text className='text-body text-ink'>{data.manufacturer} {data.model_name} · {data.model_year}</Text>
        {data.colour && (isSwatch(data.colour) ?
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: data.colour, borderWidth: 1, borderColor: '#00000033' }} /> :
          <Text className='text-meta text-muted'>{data.colour}</Text>)}
      </LangAwareView>
      <InfoRow label='contract:daily_price' value={money(data.daily_price)} />
      {data.mileage !== null && <InfoRow label='car:mileage' value={data.mileage.toLocaleString('fr-FR')} />}
      <InfoRow label='car:fuel_type' value={<TranslatableText data={'car:fuel_type:' + data.fuel_type} className='text-body font-semibold text-ink' />} />
      <InfoRow label='car:transmission_type' value={<TranslatableText data={'car:transmission_type:' + data.transmission_type} className='text-body font-semibold text-ink' />} />
      <InfoRow label='car:first_circulation_date' value={data.first_circulation_date} />
      <InfoRow
        label='car:oil_change'
        value={isOilUnknown ? t('car:oil_change:unknown') : oilChange ? (oilChange.due_mileage === null ? formatDate(oilChange.due_at) : oilChange.due_mileage + ' km · ' + formatDate(oilChange.due_at)) : '—'}
        tone={oilChange?.is_due ? 'danger' : undefined}
        onPress={isOilUnknown ? () => navigation.navigate('ExpenseFormScreen', { carId }) : undefined}
      />
    </Card>

    <Documents owner='car' ownerId={carId} documents={data.documents ?? []} types={CAR_DOCUMENTS} dates={{
      [INSURANCE]: paper(data.insurance_ends_at),
      [CIRCULATION_TAX]: paper(data.circulation_tax_ends_at),
      [TECHNICAL_CONTROL]: paper(data.technical_control_ends_at),
    }} />

    <View className='mx-3 my-1.5 gap-y-2'>
      <LangAwareView style={{ gap: 8 }}>
        {isOwner && ! data.sold_at && <View style={{ flex: 1 }}><Button label='common:edit' variant='secondary' icon='pencil' onPress={() => navigation.navigate('CarFormScreen', { carId })} /></View>}
        <View style={{ flex: 1 }}><Button label='expense:add' variant='secondary' icon='wrench' onPress={() => navigation.navigate('ExpenseFormScreen', { carId })} /></View>
      </LangAwareView>
      {isOwner && <LangAwareView style={{ gap: 8 }}>
        <View style={{ flex: 1 }}><Button label='car:purchase' variant='secondary' icon='cash' onPress={() => navigation.navigate('CarPurchaseFormScreen', { carId })} /></View>
        <View style={{ flex: 1 }}><Button label='income:add' variant='secondary' icon='cash-plus' onPress={() => navigation.navigate('IncomeFormScreen', { carId })} /></View>
      </LangAwareView>}
      {isOwner && (data.sold_at ?
        <Button label='car:sale:undo' variant='danger' icon='undo' isLoading={unsell.isPending} onPress={() => alertConfirm(selectedLang, 'car:sale:undo:confirm', () => unsell.mutate())} /> :
        <Button label='car:sell' variant='secondary' icon='handshake-outline' onPress={() => navigation.navigate('CarSaleFormScreen', { carId })} />)}
    </View>

    {isOwner && <CarMoneyCards data={data} onEditPurchase={() => navigation.navigate('CarPurchaseFormScreen', { carId })} />}
    <CarMoneyLists data={data} />
    {!! data.damages?.length && <ListGroup title='damage:history'>
      {data.damages.map(damage => {
        const contract = data.contracts?.find(item => item.id === damage.contract_id);
        return <ListRow
          key={damage.id}
          icon='car-wrench'
          iconColor={damage.repaired_at ? COLORS.muted : COLORS.warn}
          title={damage.note || '—'}
          subtitle={[ t(damage.stage === null ? 'damage:on_car' : damage.stage === STAGE_PICKUP ? 'inspection:damages:pickup' : 'inspection:damages:return'), contract?.client && clientName(contract.client), formatDate(damage.created_at) ].filter(Boolean).join(' · ')}
          meta={damage.repaired_at ?
            <Badge label='damage:repaired:on' params={{ date: formatDate(damage.repaired_at) }} tone='muted' /> :
            <Badge label='damage:open' tone='warn' />}
          onPress={damage.repaired_at ? undefined : () => navigation.navigate('DamageRepairFormScreen', { carId, damage })}
        />;
      })}
    </ListGroup>}
    {! data.damages?.length && ! data.sold_at && ! data.contracts?.some(contract => contract.picked_up_at) && <Card>
      <TranslatableText data='damage:history' className='text-title font-semibold text-ink' />
      <TranslatableText data='damage:no_inspection' className='text-body text-muted' />
    </Card>}
    {/* Old data: the scratches it came with, the rentals in the notebook. */}
    {! data.sold_at && <LangAwareView style={{ gap: 8, marginHorizontal: 12, marginVertical: 6 }}>
      <View style={{ flex: 1 }}><Button label='damage:mark' variant='secondary' icon='car-wrench' onPress={() => navigation.navigate('CarDamageFormScreen', { carId })} /></View>
      <View style={{ flex: 1 }}><Button label='contract:past:add' variant='secondary' icon='notebook-outline' onPress={() => navigation.navigate('PastRentalFormScreen', { carId })} /></View>
    </LangAwareView>}
    <TranslatableText data='car:contracts' className='text-title font-semibold text-ink mx-4 mt-4 mb-1' />
  </>;

  return (
    <Screen>
      <FlatList
        data={data.contracts}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => <ListRow
          boxed
          title={item.client ? clientName(item.client) : '—'}
          subtitle={formatDateTime(item.starts_at) + ' → ' + formatDateTime(item.ends_at)}
          meta={<ContractStatus status={item.status} />}
          onPress={() => navigation.navigate('ContractScreen', { contractId: item.id })}
        />}
        ListEmptyComponent={<TranslatableText data='common:no_data' className='text-body text-muted mx-4' />}
        keyExtractor={item => String(item.id)}
      />
    </Screen>
  );
}
