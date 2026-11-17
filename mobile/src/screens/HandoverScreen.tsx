import { useEffect, useMemo, useState } from 'react';
import SignatureField from '../components/contract/SignatureField';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import KeyboardScroll from '../components/ui/KeyboardScroll';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pricing, useAgency } from '../api/agency';
import { charges as previewCharges, HandoverInput, invalidateContractQueries, pickup, show, takeBack } from '../api/contract';
import { Charge } from '../classes/Contract';
import { ANGLE_OTHER, ANGLES, STAGE_PICKUP } from '../classes/Inspection';
import { METHODS } from '../classes/Payment';
import { useLang, useNetworkErrorAlert } from '../store/hooks';
import { alertConfirm, alertMessage, alertRequestError, validationErrors } from '../support/alert';
import { millimesFromInput, priceInputFromMillimes } from '../support/money';
import { debounce, formatMoneyDisplay, plate } from '../support/utils';
import { enqueueHandover, isOffline } from '../support/handoverQueue';
import { PhotoFile, takePhoto } from '../support/photo';
import RadioField from '../components/Form/RadioField';
import TextField from '../components/Form/TextField';
import DateTimeField from '../components/Form/DateTimeField';
import FullScreenLoader from '../components/common/FullScreenLoader';
import Button from '../components/ui/Button';
import ErrorState from '../components/ui/ErrorState';
import Icon from '../components/ui/Icon';
import Screen from '../components/ui/Screen';
import ListRow from '../components/ui/ListRow';
import { clientName } from '../classes/Client';
import { useFieldStyles } from '../components/Form/fieldStyles';
import LangAwareView from '../components/common/LangAwareView';
import Card from '../components/ui/Card';
import TranslatableText from '../components/common/TranslatableText';
import CarOutline, { DamageMark } from '../components/contract/CarOutline';
import { DamageList, PhotoBox } from '../components/contract/Inspection';
import ClientWarning from '../components/client/ClientWarning';
import { ScreenProps } from '../navigation/types';
import { useColors } from '../store/ThemeContext';

const MAX_EXTRA_PHOTOS = 4;

// Hands the car over (stage 1) or takes it back (stage 2): odometer, deposit at pickup, photos
// from fixed angles, and damage marked on the outline.
export default function HandoverScreen({ route, navigation }: ScreenProps<'HandoverScreen'>): React.JSX.Element {
  const fieldStyles = useFieldStyles();
  const COLORS = useColors();
  const { contractId, stage } = route.params;
  const isPickup = stage === STAGE_PICKUP;
  const { selectedLang, selectedLangWriteFrom } = useLang();
  const queryClient = useQueryClient();
  const { isLoading, error, data } = useQuery({ queryKey: ['contract.show', { id: contractId }], queryFn: show });
  useNetworkErrorAlert(error);

  const [mileage, setMileage] = useState<string|null>(null); // null: not typed yet, show the car's last reading
  // Only asked when the agency takes deposits; null: not typed yet, show the agency's usual one.
  const { data: agency } = useAgency();
  const [typedDeposit, setDeposit] = useState<string|null>(null);
  const [chosenDepositMethod, setDepositMethod] = useState<number|null>(null);
  const [photos, setPhotos] = useState<Record<number, PhotoFile>>({});
  const [extraPhotos, setExtraPhotos] = useState<PhotoFile[]>([]);
  const [damages, setDamages] = useState<(DamageMark & { note: string, amount: string })[]>([]);
  const [signature, setSignature] = useState<string|null>(null); // the client signs the contract as the car goes out (or signed it already, through the check-in link)
  // Entered after the fact (a car already out when the agency joined, a rental from the notebook): when it really happened. Null: now.
  const [handedAt, setHandedAt] = useState<Date|null>(null);
  const at = handedAt ? Math.floor(handedAt.getTime() / 1000) : undefined;
  // Return: extra km and lateness as the API computes them for the mileage typed, what staff waive,
  // and whether the deposit held pays them.
  const [preview, setPreview] = useState<{ charges: Charge[], deposit_available: number }|null>(null);
  const [waived, setWaived] = useState<Charge['type'][]>([]);
  const [fromDeposit, setFromDeposit] = useState(false);
  // Return: back dirty, the client pays the wash (null: not typed yet, the agency's usual price).
  const [isDirty, setIsDirty] = useState(false);
  const [typedWashing, setWashing] = useState<string|null>(null);
  const { data: rules } = useQuery({ queryKey: ['agency.pricing'], queryFn: pricing, enabled: ! isPickup });
  const fetchCharges = useMemo(() => debounce((km: number, when?: number) => previewCharges(contractId, km, when).then(setPreview).catch(() => setPreview(null)), 600), [contractId]);
  useEffect(() => {
    if (! isPickup && mileage !== null && /^\d+$/.test(mileage.trim())) {
      fetchCharges(Number(mileage), at);
    }
  }, [isPickup, mileage, at, fetchCharges]);

  const save = useMutation({
    mutationFn: (input: HandoverInput) => (isPickup ? pickup : takeBack)(contractId, input),
    onSuccess: () => {
      invalidateContractQueries(queryClient);
      alertMessage(selectedLang, isPickup ? 'handover:pickup:done' : 'handover:return:done');
      navigation.goBack();
    },
    onError: async (requestError, input) => {
      // No network (car park, airport): keep it on the phone and send it later.
      if (isOffline(requestError)) {
        await enqueueHandover(contractId, stage, input);
        alertMessage(selectedLang, 'handover:queued');
        navigation.goBack();
        return;
      }
      const errors = validationErrors(requestError);
      if (errors.client || errors.second_driver) {
        alertMessage(selectedLang, errors.client ? 'client:incomplete' : 'driver:second:incomplete');
      } else if (errors.mileage) {
        alertMessage(selectedLang, 'handover:mileage:invalid');
      } else {
        alertRequestError(selectedLang, requestError);
      }
    },
  });

  if (isLoading || ! data) {
    return isLoading ? <FullScreenLoader /> : <ErrorState error={error} onRetry={() => queryClient.invalidateQueries({ queryKey: ['contract.show'] })} />;
  }

  const mileageValue = mileage ?? (isPickup && data.car?.mileage !== null ? String(data.car?.mileage ?? '') : '');
  const asksDeposit = isPickup && !! agency?.takes_deposit;
  const deposit = ! asksDeposit ? '' : typedDeposit ?? (agency!.default_deposit ? priceInputFromMillimes(agency!.default_deposit) : '');
  const depositMethod = chosenDepositMethod ?? agency?.default_deposit_method ?? null;
  const client = data.client;
  const clientIsIncomplete = isPickup && client && (! client.id_number || ! client.driver_licence_number || ! client.driver_licence_delivery_date);
  // The insurance only covers a second driver whose licence is on the contract.
  const driver = data.second_driver;
  const driverIsIncomplete = isPickup && driver && (! driver.driver_licence_number || ! driver.driver_licence_delivery_date);
  const damageTotal = damages.reduce((sum, damage) => sum + (millimesFromInput(damage.amount) ?? 0), 0);
  const washing = typedWashing ?? (rules?.washing_price ? priceInputFromMillimes(rules.washing_price) : '');
  const washingTotal = isDirty ? millimesFromInput(washing) ?? 0 : 0;
  const kept = (preview?.charges ?? []).filter(charge => ! waived.includes(charge.type));
  const chargesTotal = kept.reduce((sum, charge) => sum + charge.amount, 0) + damageTotal + washingTotal;
  const money = (millimes: number) => formatMoneyDisplay(millimes, selectedLang);
  const pickupPhoto = (angle: number) => data.photos?.find(photo => photo.stage === STAGE_PICKUP && photo.angle === angle)?.url;
  const addPhoto = (onPhoto: (photo: PhotoFile) => void) => takePhoto().then(photo => photo && onPhoto(photo));
  // Booked more than a day ago: maybe entered after the fact, so its time can be set (back to the booked start, or the pickup).
  const isLate = (isPickup ? data.starts_at : data.ends_at) < Date.now() / 1000 - 24 * 3600;
  const earliest = new Date((isPickup ? data.starts_at : data.picked_up_at ?? data.starts_at) * 1000);

  const onSavePress = () => {
    const minimum = isPickup ? 0 : (data.pickup_mileage ?? 0);
    if (! /^\d+$/.test(mileageValue.trim()) || Number(mileageValue) < minimum) {
      alertMessage(selectedLang, 'handover:mileage:invalid');
      return;
    }
    if (damages.some(damage => damage.amount.trim() && millimesFromInput(damage.amount) === null) || (isDirty && washing.trim() && millimesFromInput(washing) === null)) {
      alertMessage(selectedLang, 'payment:amount:invalid');
      return;
    }
    if (isPickup && deposit.trim() && (! millimesFromInput(deposit) || ! depositMethod)) {
      alertMessage(selectedLang, 'handover:deposit:invalid');
      return;
    }
    const input: HandoverInput = {
      at: at ?? Math.floor(Date.now() / 1000),
      mileage: Number(mileageValue),
      ...(isPickup ? { deposit: millimesFromInput(deposit) ?? 0, deposit_method: depositMethod ?? undefined } : {}),
      ...(isPickup && signature ? { signature } : {}),
      photos: [
        ...Object.entries(photos).map(([ angle, file ]) => ({ angle: Number(angle), file })),
        ...extraPhotos.map(file => ({ angle: ANGLE_OTHER, file })),
      ],
      damages: damages.map(damage => ({ x: damage.x, y: damage.y, note: damage.note.trim() || null, ...(isPickup ? {} : { amount: millimesFromInput(damage.amount) }) })),
      ...(isPickup ? {} : { waived: waived.filter(type => type !== 'damage') as ('km'|'late')[], charges_from_deposit: fromDeposit ? 1 : 0, dirty: isDirty ? 1 : 0, washing: isDirty ? washingTotal : null }),
    };
    if (ANGLES.some(angle => ! photos[angle])) {
      alertConfirm(selectedLang, 'handover:photos:missing', () => save.mutate(input));
      return;
    }
    save.mutate(input);
  };

  return (
    <Screen white>
      <KeyboardScroll>
        <View style={{ padding: 16, gap: 18, paddingBottom: 32 }}>
          {/* Who and what: both open their page. */}
          <View style={{ borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, overflow: 'hidden' }}>
            {data.car && <ListRow icon='car' iconColor={COLORS.primary} title={plate(data.car.licence_plate)} subtitle={data.car.manufacturer + ' ' + data.car.model_name} onPress={() => navigation.navigate('CarScreen', { carId: data.car!.id })} />}
            {client && <ListRow icon='account-outline' iconColor={COLORS.primary} title={clientName(client)} subtitle={client.phone} onPress={() => navigation.navigate('ClientScreen', { clientId: client.id })} />}
          </View>
          {clientIsIncomplete && <Card>
            <TranslatableText data='client:incomplete' className='text-body font-semibold text-danger' />
            <Button label='client:complete' icon='card-account-details-outline' onPress={() => navigation.navigate('ClientFormScreen', { clientId: client.id })} />
          </Card>}
          {driverIsIncomplete && <Card>
            <TranslatableText data='driver:second:incomplete' className='text-body font-semibold text-danger' />
            <Button label='client:complete' icon='card-account-details-outline' onPress={() => navigation.navigate('ClientFormScreen', { clientId: driver.id })} />
          </Card>}
          {isPickup && <ClientWarning clientId={client?.id} />}

          {isLate && <View style={{ gap: 4 }}>
            <DateTimeField label={isPickup ? 'handover:at:pickup' : 'handover:at:return'} value={handedAt ?? new Date()} onChange={setHandedAt} minDate={earliest} maxDate={new Date()} minuteInterval={5} />
            <TranslatableText data='handover:at:hint' className='text-meta text-muted' />
          </View>}

          <TextField label='handover:mileage' value={mileageValue} onChange={setMileage} keyboardType='number-pad' />
          {! isPickup && data.pickup_mileage !== null &&
            <TranslatableText data='handover:mileage:at_pickup' params={{ km: data.pickup_mileage }} className='text-body text-muted' />}

          {asksDeposit && <>
            <TextField label='deposit:amount' value={deposit} onChange={setDeposit} keyboardType='decimal-pad' />
            <RadioField
              label='deposit:method'
              value={depositMethod}
              onChange={setDepositMethod}
              options={METHODS.map(method => ({ label: 'payment:method:' + method, value: method }))}
            />
          </>}

          <TranslatableText data='inspection:photos' className='text-title font-semibold text-ink' />
          {ANGLES.map(angle =>
            <View key={angle}>
              <TranslatableText data={'inspection:angle:' + angle} className='text-body font-semibold text-ink mb-1' />
              <LangAwareView className='gap-x-2'>
                {! isPickup && <PhotoBox uri={pickupPhoto(angle)} caption='inspection:at_pickup' />}
                <PhotoBox
                  uri={photos[angle]?.uri}
                  caption={isPickup ? undefined : 'inspection:now'}
                  onPress={() => addPhoto(photo => setPhotos(current => ({ ...current, [angle]: photo })))}
                />
              </LangAwareView>
            </View>
          )}
          <LangAwareView className='gap-2 flex-wrap'>
            {extraPhotos.map((photo, index) => <PhotoBox key={index} uri={photo.uri} />)}
          </LangAwareView>
          {extraPhotos.length < MAX_EXTRA_PHOTOS && <Button
            label='inspection:photo:add'
            variant='secondary'
            onPress={() => addPhoto(photo => setExtraPhotos(current => [ ...current, photo ]))}
            icon='camera-plus-outline'
          />}

          <TranslatableText data='inspection:damages' className='text-title font-semibold text-ink' />
          <TranslatableText data='inspection:damages:hint' className='text-body text-muted' />
          <CarOutline
            older={data.car_damages}
            earlier={isPickup ? [] : data.damages?.filter(damage => damage.stage === STAGE_PICKUP)}
            marks={damages}
            onPress={(mark) => setDamages(current => [ ...current, { ...mark, note: '', amount: '' } ])}
          />
          {!! data.car_damages?.length && <View className='gap-y-1'>
            <TranslatableText data='inspection:damages:open' className='text-body font-semibold' style={{ color: COLORS.warn }} />
            <DamageList damages={data.car_damages} amounts={false} />
          </View>}
          {! isPickup && !! data.damages?.length && <View className='gap-y-1'>
            <TranslatableText data='inspection:damages:pickup' className='text-body font-semibold text-muted' />
            <DamageList damages={data.damages.filter(damage => damage.stage === STAGE_PICKUP)} />
          </View>}
          {damages.map((damage, index) =>
            <LangAwareView key={index} className='gap-x-2 items-center'>
              <Text className='text-body font-semibold text-ink'>{index + 1}.</Text>
              <TextInput
                value={damage.note}
                onChangeText={(note) => setDamages(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, note } : item))}
                placeholder='...'
                textAlign={selectedLangWriteFrom}
                style={{ ...fieldStyles.input, flex: 1 }}
              />
              {! isPickup && <TextInput
                value={damage.amount}
                onChangeText={(amount) => setDamages(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount } : item))}
                placeholder='TND'
                keyboardType='decimal-pad'
                textAlign={selectedLangWriteFrom}
                style={{ ...fieldStyles.input, width: 90 }}
              />}
              <TouchableOpacity onPress={() => setDamages(current => current.filter((_item, itemIndex) => itemIndex !== index))} hitSlop={8}>
                <Icon name='delete-outline' size={24} color={COLORS.danger} />
              </TouchableOpacity>
            </LangAwareView>
          )}

          {! isPickup && <TouchableOpacity onPress={() => setIsDirty(current => ! current)}>
            <LangAwareView className='gap-x-2 items-center'>
              <Icon name={isDirty ? 'checkbox-marked' : 'checkbox-blank-outline'} size={24} color={COLORS.primary} />
              <TranslatableText data='handover:dirty' className='text-body text-ink flex-1' />
            </LangAwareView>
          </TouchableOpacity>}
          {isDirty && <TextField label='handover:washing' value={washing} onChange={setWashing} keyboardType='decimal-pad' />}

          {! isPickup && (kept.length > 0 || (preview?.charges.length ?? 0) > 0 || damageTotal > 0 || washingTotal > 0) && <Card>
            <TranslatableText data='charge:label' className='text-title font-semibold text-ink' />
            {preview?.charges.map(charge =>
              <TouchableOpacity key={charge.type} onPress={() => setWaived(current => current.includes(charge.type) ? current.filter(type => type !== charge.type) : [ ...current, charge.type ])}>
                <LangAwareView className='gap-x-2 items-center'>
                  <Icon name={waived.includes(charge.type) ? 'checkbox-blank-outline' : 'checkbox-marked'} size={24} color={COLORS.primary} />
                  <TranslatableText
                    data={'charge:' + charge.type + (charge.unit ? ':' + charge.unit : '')}
                    params={{ quantity: charge.quantity, amount: money(charge.amount) }}
                    className={'text-body flex-1 ' + (waived.includes(charge.type) ? 'line-through text-muted' : 'text-ink')}
                  />
                </LangAwareView>
              </TouchableOpacity>
            )}
            {damageTotal > 0 && <TranslatableText data='charge:damage' params={{ quantity: damages.filter(damage => millimesFromInput(damage.amount)).length, amount: money(damageTotal) }} className='text-body text-ink' />}
            {washingTotal > 0 && <TranslatableText data='charge:washing' params={{ amount: money(washingTotal) }} className='text-body text-ink' />}
            <TranslatableText data='charge:total' params={{ amount: money(chargesTotal) }} className='text-body font-semibold text-ink' />
            {chargesTotal > 0 && (preview?.deposit_available ?? 0) > 0 && <TouchableOpacity onPress={() => setFromDeposit(current => ! current)}>
              <LangAwareView className='gap-x-2 items-center'>
                <Icon name={fromDeposit ? 'checkbox-marked' : 'checkbox-blank-outline'} size={24} color={COLORS.primary} />
                <TranslatableText data='charge:from_deposit' params={{ amount: money(Math.min(chargesTotal, preview!.deposit_available)) }} className='text-body text-ink flex-1' />
              </LangAwareView>
            </TouchableOpacity>}
            {! fromDeposit && chargesTotal > 0 && <TranslatableText data='charge:to_balance' className='text-body text-muted' />}
          </Card>}

          {isPickup && <Card><SignatureField value={signature ?? data.signature} onChange={setSignature} /></Card>}
          <Button label={isPickup ? 'handover:pickup:save' : 'handover:return:save'} onPress={onSavePress} isLoading={save.isPending} icon='check' />
        </View>
      </KeyboardScroll>
    </Screen>
  );
}
