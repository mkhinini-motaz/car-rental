import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pricing } from '../api/agency';
import { cancel, close, invalidateContractQueries, show, update } from '../api/contract';
import Client from '../classes/Client';
import Contract, { Extra, extrasPrice, STATUS_CLOSED, STATUS_OUT, STATUS_RESERVED, STATUS_RETURNED } from '../classes/Contract';
import { STAGE_PICKUP, STAGE_RETURN } from '../classes/Inspection';
import { translate } from '../i18n';
import { useIsOwner, useLang, useNetworkErrorAlert } from '../store/hooks';
import { alertConfirm, alertMessage, alertRequestError, validationErrors } from '../support/alert';
import { diffInDays, formatDateTime, formatMoneyDisplay, plate } from '../support/utils';
import { millimesFromInput, priceInputFromMillimes } from '../support/money';
import ContractCard from '../components/car/Contract';
import ClientPicker from '../components/client/ClientPicker';
import DateTimeField from '../components/Form/DateTimeField';
import TextField from '../components/Form/TextField';
import KeyboardDismissibleAwareScrollView from '../components/common/KeyboardDismissibleAwareScrollView';
import FullScreenLoader from '../components/common/FullScreenLoader';
import LangAwareView from '../components/common/LangAwareView';
import TranslatableText from '../components/common/TranslatableText';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ErrorState from '../components/ui/ErrorState';
import ListRow from '../components/ui/ListRow';
import Screen from '../components/ui/Screen';
import ContractStatus from '../components/contract/ContractStatus';
import InspectionSummary from '../components/contract/Inspection';
import PaymentsSection from '../components/contract/PaymentsSection';
import ExtrasField from '../components/contract/ExtrasField';
import LocationField from '../components/contract/LocationField';
import SourceField, { emptySource, sourceInput, sourceOf, SourceValue } from '../components/contract/SourceField';
import ActivityLog from '../components/contract/ActivityLog';
import WhatsAppSection from '../components/contract/WhatsAppSection';
import PapersSection from '../components/contract/PapersSection';
import TasksSection from '../components/contract/TasksSection';
import ClientWarning from '../components/client/ClientWarning';
import FineRow from '../components/fine/FineRow';
import { syncAutoExtras } from '../support/extras';
import { discardHandover, usePendingHandovers } from '../support/handoverQueue';
import Badge from '../components/ui/Badge';
import { ScreenProps } from '../navigation/types';
import { useColors } from '../store/ThemeContext';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60;

// What happened at pickup and return: times, odometer, deposit, lateness.
function Handover({ data }: { data: Contract }): React.JSX.Element|null {
  const { selectedLang } = useLang();
  if (! data.picked_up_at) {
    return null;
  }
  const lateUntil = data.returned_at ?? Math.floor(Date.now() / 1000);
  const lateHours = Math.ceil((lateUntil - data.ends_at) / HOUR);

  return (
    <Card>
      <TranslatableText data='handover:label' className='text-title font-semibold text-ink' />
      {/* A rental from the notebook may have no odometer readings. */}
      <TranslatableText data={data.pickup_mileage === null ? 'handover:picked_up:no_km' : 'handover:picked_up'} params={{ date: formatDateTime(data.picked_up_at), km: data.pickup_mileage }} className='text-body text-ink' />
      {data.deposit > 0 && <TranslatableText
        data='deposit:taken'
        params={{ amount: formatMoneyDisplay(data.deposit, selectedLang), method: translate('payment:method:' + data.deposit_method, selectedLang) }}
        className='text-body text-ink'
      />}
      {data.returned_at && <>
        <TranslatableText data={data.return_mileage === null ? 'handover:returned:no_km' : 'handover:returned'} params={{ date: formatDateTime(data.returned_at), km: data.return_mileage }} className='text-body text-ink' />
        {data.pickup_mileage !== null && data.return_mileage !== null && <TranslatableText data='handover:driven' params={{ km: data.return_mileage - data.pickup_mileage }} className='text-body font-semibold text-ink' />}
      </>}
      {lateHours > 0 && <TranslatableText data='handover:late' params={{ hours: lateHours }} className='text-body font-semibold text-danger' />}
      {data.charges.map(charge =>
        <TranslatableText
          key={charge.type}
          data={'charge:' + charge.type + (charge.unit ? ':' + charge.unit : '')}
          params={{ quantity: charge.quantity, amount: formatMoneyDisplay(charge.amount, selectedLang) }}
          className='text-body font-semibold text-danger'
        />
      )}
      {(data.fines_from_deposit ?? 0) > 0 && <TranslatableText data='deposit:fines' params={{ amount: formatMoneyDisplay(data.fines_from_deposit!, selectedLang) }} className='text-body text-ink' />}
      {data.status === STATUS_CLOSED && data.deposit > 0 && <>
        {data.deposit_kept > 0 && <TranslatableText data='deposit:kept' params={{ amount: formatMoneyDisplay(data.deposit_kept, selectedLang), reason: data.deposit_kept_reason }} className='text-body text-ink' />}
        <TranslatableText data='deposit:returned' params={{ amount: formatMoneyDisplay(data.deposit_returned ?? 0, selectedLang) }} className='text-body text-ink' />
      </>}
    </Card>
  );
}

// Settles a returned contract: how much of the deposit is kept, and why (the owner only;
// managers give it all back).
function CloseSection({ data }: { data: Contract }): React.JSX.Element {
  const { selectedLang } = useLang();
  const isOwner = useIsOwner();
  const queryClient = useQueryClient();
  const [kept, setKept] = useState('');
  const [reason, setReason] = useState('');
  const keptMillimes = kept.trim() ? millimesFromInput(kept) : 0;
  const available = data.deposit_available ?? 0; // fines and charges may already have come out of it

  const closeContract = useMutation({
    mutationFn: () => close(data.id, { deposit_kept: keptMillimes ?? 0, deposit_kept_reason: reason.trim() || null }),
    onSuccess: () => {
      invalidateContractQueries(queryClient);
      alertMessage(selectedLang, 'contract:closed');
    },
    onError: (error) => validationErrors(error).payments ?
      alertMessage(selectedLang, 'contract:unpaid') :
      alertRequestError(selectedLang, error),
  });

  const onClosePress = () => {
    if (keptMillimes === null || keptMillimes > available) {
      alertMessage(selectedLang, 'deposit:kept:invalid');
      return;
    }
    if (keptMillimes > 0 && ! reason.trim()) {
      alertMessage(selectedLang, 'deposit:reason:required');
      return;
    }
    alertConfirm(selectedLang, 'contract:close:confirm', () => closeContract.mutate());
  };

  return (
    <Card>
      <TranslatableText data='contract:close' className='text-title font-semibold text-ink' />
      {available > 0 && <>
        {isOwner && <>
          <TextField label='deposit:kept:amount' value={kept} onChange={setKept} keyboardType='decimal-pad' />
          <TextField label='deposit:kept:reason' value={reason} onChange={setReason} />
        </>}
        <TranslatableText
          data='deposit:returned'
          params={{ amount: formatMoneyDisplay(available - (keptMillimes ?? 0), selectedLang) }}
          className='text-body font-semibold text-ink'
        />
      </>}
      <Button label='contract:close' onPress={onClosePress} isLoading={closeContract.isPending} icon='check-circle-outline' />
    </Card>
  );
}

export default function ContractScreen({ route, navigation }: ScreenProps<'ContractScreen'>): React.JSX.Element {
  const COLORS = useColors();
  const { contractId } = route.params;
  const { selectedLang } = useLang();
  const queryClient = useQueryClient();
  const { isLoading, error, data } = useQuery({ queryKey: ['contract.show', { id: contractId }], queryFn: show });
  useNetworkErrorAlert(error);

  const [startsAt, setStartsAt] = useState<Date|null>(null);
  const [endsAt, setEndsAt] = useState<Date|null>(null);
  const [price, setPrice] = useState('');
  const [client, setClient] = useState<Client|null>(null);
  const [note, setNote] = useState('');
  const [extras, setExtras] = useState<Extra[]>([]);
  const [secondDriver, setSecondDriver] = useState<Client|null>(null);
  const [pickupLocation, setPickupLocation] = useState<string|null>(null);
  const [returnLocation, setReturnLocation] = useState<string|null>(null);
  const [source, setSource] = useState<SourceValue>(emptySource);
  const [sourceIsInvalid, setSourceIsInvalid] = useState(false);
  const isOwner = useIsOwner();
  const pending = usePendingHandovers().find(item => item.contractId === contractId);
  const { data: rules } = useQuery({ queryKey: ['agency.pricing'], queryFn: pricing });
  useEffect(() => {
    if (data) {
      setExtras(data.extras);
      setSecondDriver(data.second_driver ?? null);
      setPickupLocation(data.pickup_location);
      setReturnLocation(data.return_location);
      setStartsAt(new Date(data.starts_at * 1000));
      setEndsAt(new Date(data.ends_at * 1000));
      setPrice(priceInputFromMillimes(data.daily_price));
      setClient(data.client ?? null);
      setNote(data.note ?? '');
      setSource(sourceOf(data));
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => update(contractId, {
      starts_at: Math.floor(startsAt!.getTime() / 1000),
      ends_at: Math.floor(endsAt!.getTime() / 1000),
      daily_price: millimesFromInput(price)!,
      client_id: client!.id,
      second_driver_id: secondDriver?.id ?? null,
      pickup_location: pickupLocation?.trim() || null,
      return_location: returnLocation?.trim() || null,
      note: note.trim() || null,
      extras,
      ...sourceInput(source, rentalTotal)!,
    }),
    onSuccess: () => {
      invalidateContractQueries(queryClient);
      alertMessage(selectedLang, 'contract:saved');
    },
    onError: (requestError) => alertRequestError(selectedLang, requestError),
  });
  const cancelContract = useMutation({
    mutationFn: () => cancel(contractId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['contract.show', { id: contractId }] }); // it's gone: don't refetch it
      invalidateContractQueries(queryClient);
      navigation.goBack();
    },
    onError: (requestError) => alertRequestError(selectedLang, requestError),
  });

  if (isLoading || ! data || ! startsAt || ! endsAt) {
    return data || isLoading ? <FullScreenLoader /> : <ErrorState error={error} onRetry={() => queryClient.invalidateQueries({ queryKey: ['contract.show', { id: contractId }] })} />;
  }

  const dailyPrice = millimesFromInput(price);
  const days = diffInDays(startsAt.getTime() / 1000, endsAt.getTime() / 1000);
  const rentalTotal = (dailyPrice ?? 0) * days + extrasPrice(extras, days); // a commission typed as '10%' is of this
  // The second driver and the delivery places bring their fees along.
  const changeTrip = (change: Partial<{ secondDriver: Client|null, pickupLocation: string|null, returnLocation: string|null }>) => {
    const trip = { secondDriver, pickupLocation, returnLocation, ...change };
    setSecondDriver(trip.secondDriver);
    setPickupLocation(trip.pickupLocation);
    setReturnLocation(trip.returnLocation);
    setExtras(current => syncAutoExtras(current, rules, selectedLang, trip));
  };
  const onSavePress = () => {
    if (secondDriver && secondDriver.id === client?.id) {
      alertMessage(selectedLang, 'driver:second:same');
      return;
    }
    if (! dailyPrice || endsAt <= startsAt) {
      alertMessage(selectedLang, ! dailyPrice ? 'contract:price:invalid' : 'contract:dates:invalid');
      return;
    }
    if (! sourceInput(source, rentalTotal)) {
      setSourceIsInvalid(true);
      alertMessage(selectedLang, 'contract:broker:invalid');
      return;
    }
    save.mutate();
  };

  const car = data.car;

  return (
    <Screen>
      <KeyboardDismissibleAwareScrollView>
        <View style={{ paddingTop: 6, paddingBottom: 32 }}>
          {car && <View className='bg-surface border border-line rounded-xl mx-3 my-1.5 overflow-hidden'>
            <ListRow
              icon='car'
              iconColor={COLORS.primary}
              title={<Text className='text-body font-semibold text-ink'>{plate(car.licence_plate)}</Text>}
              subtitle={car.manufacturer + ' ' + car.model_name + ' · ' + car.model_year}
              meta={<ContractStatus status={data.status} />}
              onPress={() => navigation.navigate('CarScreen', { carId: car.id })}
            />
          </View>}
          {data.status === STATUS_CLOSED ?
            <ContractCard data={data} /> :
            <Card>
              <ClientPicker value={client} onChange={setClient} />
              <ClientWarning clientId={client?.id} />
              <ClientPicker label='driver:second' value={secondDriver} onChange={(driver) => changeTrip({ secondDriver: driver })} onClear={() => changeTrip({ secondDriver: null })} />
              <ClientWarning clientId={secondDriver?.id} withBadge={false} />
              <LocationField label='location:pickup' value={pickupLocation} onChange={(location) => changeTrip({ pickupLocation: location })} locations={rules?.locations ?? []} />
              <LocationField label='location:return' value={returnLocation} onChange={(location) => changeTrip({ returnLocation: location })} locations={rules?.locations ?? []} />
              <LangAwareView style={{ gap: 8 }}>
                <DateTimeField label='contract:starts_at' value={startsAt} onChange={setStartsAt} minuteInterval={30} />
                <DateTimeField label='contract:ends_at' value={endsAt} onChange={setEndsAt} minuteInterval={30} />
              </LangAwareView>
              <Button label='contract:add_day' variant='secondary' compact icon='calendar-plus' onPress={() => setEndsAt(new Date(endsAt.getTime() + DAY))} />
              <TextField label='contract:daily_price' value={price} onChange={setPrice} keyboardType='decimal-pad' />
              <TextField label='contract:note' value={note} onChange={setNote} multiline />
              <ExtrasField value={extras} onChange={setExtras} catalogue={rules?.extras ?? []} days={days} />
              <SourceField value={source} onChange={setSource} error={sourceIsInvalid} />
              <TranslatableText
                data='contract:total'
                params={{ days, price: dailyPrice ? formatMoneyDisplay(dailyPrice * days + extrasPrice(extras, days), selectedLang) : '—' }}
                className='text-title font-semibold text-ink'
              />
              <Button label='common:save' onPress={onSavePress} isLoading={save.isPending} icon='check' />
            </Card>
          }

          <Handover data={data} />

          {pending && <Card>
            <Badge label={pending.error ? 'handover:pending:failed' : 'handover:pending'} tone={pending.error ? 'danger' : 'warn'} />
            <TranslatableText
              data={pending.error ? pending.error : 'handover:pending:hint'}
              params={{ stage: translate(pending.stage === STAGE_PICKUP ? 'handover:pickup' : 'handover:return', selectedLang) }}
              className='text-body text-ink'
            />
            {pending.error && <Button label='handover:pending:discard' variant='danger' icon='delete-outline' onPress={() => alertConfirm(selectedLang, 'handover:pending:discard:confirm', () => discardHandover(contractId))} />}
          </Card>}
          {! pending && <View className='mx-3 my-1.5 gap-y-2'>
            {data.status === STATUS_RESERVED && <Button label='handover:pickup' icon='key-arrow-right' onPress={() => navigation.navigate('HandoverScreen', { contractId, stage: STAGE_PICKUP })} />}
            {data.status === STATUS_OUT && <Button label='handover:return' icon='car-arrow-left' onPress={() => navigation.navigate('HandoverScreen', { contractId, stage: STAGE_RETURN })} />}
          </View>}
          <TasksSection data={data} />
          {data.status === STATUS_RETURNED && <CloseSection data={data} />}

          <PaymentsSection data={data} />
          <WhatsAppSection data={data} />
          <PapersSection data={data} />
          {data.fines?.map(fine => <FineRow key={fine.id} data={fine} onPress={() => navigation.navigate('FineScreen', { fineId: fine.id })} />)}
          <InspectionSummary data={data} />
          <ActivityLog activities={data.activities} />

          <View className='mx-3 mt-4 gap-y-2'>
            {data.status !== STATUS_RESERVED && <Button label='contract:repair' variant='secondary' icon='wrench' onPress={() => navigation.navigate('ExpenseFormScreen', { contractId })} />}
            {data.status === STATUS_RESERVED && isOwner && <Button
              label='contract:cancel'
              variant='danger'
              icon='calendar-remove'
              isLoading={cancelContract.isPending}
              onPress={() => alertConfirm(selectedLang, 'contract:cancel:confirm', () => cancelContract.mutate())}
            />}
          </View>
        </View>
      </KeyboardDismissibleAwareScrollView>
    </Screen>
  );
}
