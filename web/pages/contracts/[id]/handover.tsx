import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Checkbox, FormControlLabel, IconButton, Stack, TextField, Typography } from '@mui/material';
import AddAPhoto from '@mui/icons-material/AddAPhoto';
import Badge from '@mui/icons-material/Badge';
import Check from '@mui/icons-material/Check';
import DeleteOutline from '@mui/icons-material/DeleteOutlined';
import PersonOutline from '@mui/icons-material/PersonOutlined';
import { pricing, useAgency } from '../../../src/api/agency';
import { charges as previewCharges, HandoverInput, invalidateContractQueries, pickup, show, takeBack } from '../../../src/api/contract';
import { Charge } from '../../../src/classes/Contract';
import { ANGLE_OTHER, ANGLES, STAGE_PICKUP } from '../../../src/classes/Inspection';
import { METHODS } from '../../../src/classes/Payment';
import { COLORS } from '../../../src/constants';
import { useT } from '../../../src/store/Store';
import { validationErrors } from '../../../src/support/alert';
import { millimesFromInput, priceInputFromMillimes } from '../../../src/support/money';
import { resizePhoto } from '../../../src/support/photo';
import { debounce } from '../../../src/support/utils';
import { CarName } from '../../../src/components/car';
import { ClientWarning } from '../../../src/components/client';
import { CarOutline, DamageList, DamageMark, PhotoBox } from '../../../src/components/inspection';
import { useFeedback } from '../../../src/components/Feedback';
import { SignatureField } from '../../../src/components/signature';
import { Choice, ClientLink, DateTimeInput, Empty, Loading, Page, Section, useMoney } from '../../../src/components/common';

const MAX_EXTRA_PHOTOS = 4;

// Hands the car over (stage 1) or takes it back (stage 2): odometer, deposit at pickup, photos
// from fixed angles, and damage marked on the outline. On a phone the photo boxes open the camera.
export default function HandoverPage() {
  const t = useT();
  const money = useMoney();
  const router = useRouter();
  const contractId = Number(router.query.id);
  const isPickup = Number(router.query.stage) === STAGE_PICKUP;
  const queryClient = useQueryClient();
  const { notify, confirm, requestError } = useFeedback();
  const { isLoading, data } = useQuery({ queryKey: ['contract.show', { id: contractId }], queryFn: show });

  const [mileage, setMileage] = useState<string|null>(null); // null: not typed yet, show the car's last reading
  // Only asked when the agency takes deposits; null: not typed yet, show the agency's usual one.
  const { data: agency } = useAgency();
  const [typedDeposit, setDeposit] = useState<string|null>(null);
  const [chosenDepositMethod, setDepositMethod] = useState<number|null>(null);
  const [photos, setPhotos] = useState<Record<number, File>>({});
  const [extraPhotos, setExtraPhotos] = useState<File[]>([]);
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
  // Local previews of the photos taken, released when they change.
  const urls = useMemo(() => Object.fromEntries(Object.entries(photos).map(([ angle, file ]) => [ angle, URL.createObjectURL(file) ])), [photos]);
  const extraUrls = useMemo(() => extraPhotos.map(file => URL.createObjectURL(file)), [extraPhotos]);
  useEffect(() => () => Object.values(urls).forEach(url => URL.revokeObjectURL(url)), [urls]);
  useEffect(() => () => extraUrls.forEach(url => URL.revokeObjectURL(url)), [extraUrls]);

  const save = useMutation({
    mutationFn: (input: HandoverInput) => (isPickup ? pickup : takeBack)(contractId, input),
    onSuccess: () => {
      invalidateContractQueries(queryClient);
      notify(isPickup ? 'handover:pickup:done' : 'handover:return:done', 'success');
      router.replace('/contracts/' + contractId);
    },
    onError: (error) => {
      const errors = validationErrors(error);
      if (errors.client || errors.second_driver) {
        notify(errors.client ? 'client:incomplete' : 'driver:second:incomplete', 'error');
      } else if (errors.mileage) {
        notify('handover:mileage:invalid', 'error');
      } else {
        requestError(error);
      }
    },
  });

  if (isLoading) {
    return <Loading />;
  }
  if (! data) {
    return <Page title='contract:label'><Empty /></Page>;
  }

  const mileageValue = mileage ?? (isPickup && data.car?.mileage != null ? String(data.car.mileage) : '');
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
  const pickupPhoto = (angle: number) => data.photos?.find(photo => photo.stage === STAGE_PICKUP && photo.angle === angle)?.url;
  const setDamage = (index: number, change: object) => setDamages(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...change } : item));
  const back = encodeURIComponent(router.asPath);
  // Booked more than a day ago: maybe entered after the fact, so its time can be set (back to the booked start, or the pickup).
  const isLate = (isPickup ? data.starts_at : data.ends_at) < Date.now() / 1000 - 24 * 3600;
  const earliest = new Date((isPickup ? data.starts_at : data.picked_up_at ?? data.starts_at) * 1000);

  const onSave = async () => {
    const minimum = isPickup ? 0 : (data.pickup_mileage ?? 0);
    if (! /^\d+$/.test(mileageValue.trim()) || Number(mileageValue) < minimum) {
      notify('handover:mileage:invalid', 'error');
      return;
    }
    if (damages.some(damage => damage.amount.trim() && millimesFromInput(damage.amount) === null) || (isDirty && washing.trim() && millimesFromInput(washing) === null)) {
      notify('payment:amount:invalid', 'error');
      return;
    }
    if (isPickup && deposit.trim() && (! millimesFromInput(deposit) || ! depositMethod)) {
      notify('handover:deposit:invalid', 'error');
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
    if (ANGLES.some(angle => ! photos[angle]) && ! await confirm('handover:photos:missing')) {
      return;
    }
    save.mutate(input);
  };

  return (
    <Page title={isPickup ? 'handover:pickup' : 'handover:return'}>
      <Stack sx={{ gap: 2, maxWidth: 900 }}>
        {data.car && <CarName data={data.car} withPlate link />}
        {client && <Stack direction='row' sx={{ gap: 1, alignItems: 'center' }}><PersonOutline fontSize='small' color='action' /><ClientLink data={client} /></Stack>}
        {clientIsIncomplete && <Alert severity='error' action={<Button color='inherit' startIcon={<Badge />} component={Link} href={`/clients/${client!.id}/edit?back=${back}`}>{t('client:complete')}</Button>}>
          {t('client:incomplete')}
        </Alert>}
        {driverIsIncomplete && <Alert severity='error' action={<Button color='inherit' startIcon={<Badge />} component={Link} href={`/clients/${driver!.id}/edit?back=${back}`}>{t('client:complete')}</Button>}>
          {t('driver:second:incomplete')}
        </Alert>}
        {isPickup && <ClientWarning clientId={client?.id} />}

        <Section>
          {isLate && <Stack sx={{ gap: 0.5, maxWidth: 420 }}>
            <DateTimeInput label={isPickup ? 'handover:at:pickup' : 'handover:at:return'} value={handedAt ?? new Date()} onChange={setHandedAt} min={earliest} step={5} />
            <Typography variant='body2' color='text.secondary'>{t('handover:at:hint')}</Typography>
          </Stack>}
          <TextField
            label={t('handover:mileage')}
            value={mileageValue}
            onChange={event => setMileage(event.target.value)}
            helperText={! isPickup && data.pickup_mileage !== null ? t('handover:mileage:at_pickup', { km: data.pickup_mileage }) : undefined}
            slotProps={{ htmlInput: { inputMode: 'numeric' } }}
            sx={{ maxWidth: 280 }}
          />
          {asksDeposit && <>
            <TextField label={t('deposit:amount')} value={deposit} onChange={event => setDeposit(event.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} sx={{ maxWidth: 280 }} />
            <Choice label='deposit:method' value={depositMethod} onChange={setDepositMethod} options={METHODS.map(method => ({ label: 'payment:method:' + method, value: method }))} />
          </>}
        </Section>

        <Section title='inspection:photos'>
          <Stack direction='row' sx={{ flexWrap: 'wrap', columnGap: 4, rowGap: 2 }}>
          {ANGLES.map(angle =>
            <Box key={angle}>
              <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{t('inspection:angle:' + angle)}</Typography>
              <Stack direction='row' sx={{ gap: 2 }}>
                {! isPickup && <PhotoBox url={pickupPhoto(angle)} label={t('inspection:angle:' + angle)} caption='inspection:at_pickup' />}
                <PhotoBox url={urls[angle]} label={t('inspection:angle:' + angle)} caption={isPickup ? undefined : 'inspection:now'} onPick={file => setPhotos(current => ({ ...current, [angle]: file }))} />
              </Stack>
            </Box>
          )}
          </Stack>
          <Stack direction='row' sx={{ gap: 2, flexWrap: 'wrap' }}>
            {extraUrls.map((url, index) => <PhotoBox key={url} url={url} label={t('inspection:angle:7')} caption='inspection:angle:7' onPick={file => setExtraPhotos(current => current.map((item, itemIndex) => itemIndex === index ? file : item))} />)}
          </Stack>
          {extraPhotos.length < MAX_EXTRA_PHOTOS && <Box>
            <Button variant='outlined' component='label' startIcon={<AddAPhoto />}>
              {t('inspection:photo:add')}
              <input type='file' accept='image/*' capture='environment' hidden onChange={async event => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) {
                  const resized = await resizePhoto(file);
                  setExtraPhotos(current => [ ...current, resized ]);
                }
              }} />
            </Button>
          </Box>}
        </Section>

        <Section title='inspection:damages'>
          <Typography color='text.secondary'>{t('inspection:damages:hint')}</Typography>
          <CarOutline
            older={data.car_damages}
            earlier={isPickup ? [] : data.damages?.filter(damage => damage.stage === STAGE_PICKUP)}
            marks={damages}
            onMark={mark => setDamages(current => [ ...current, { ...mark, note: '', amount: '' } ])}
          />
          {!! data.car_damages?.length && <Box>
            <Typography sx={{ fontWeight: 600, color: COLORS.warn }}>{t('inspection:damages:open')}</Typography>
            <DamageList damages={data.car_damages} amounts={false} />
          </Box>}
          {! isPickup && !! data.damages?.length && <Box>
            <Typography color='text.secondary' sx={{ fontWeight: 600 }}>{t('inspection:damages:pickup')}</Typography>
            <DamageList damages={data.damages.filter(damage => damage.stage === STAGE_PICKUP)} />
          </Box>}
          {damages.map((damage, index) =>
            <Stack key={index} direction='row' sx={{ gap: 1, alignItems: 'center' }}>
              <Typography sx={{ fontWeight: 700 }}>{index + 1}.</Typography>
              <TextField value={damage.note} onChange={event => setDamage(index, { note: event.target.value })} placeholder='...' slotProps={{ htmlInput: { 'aria-label': (index + 1) + '. ' + t('contract:note') } }} />
              {! isPickup && <TextField value={damage.amount} onChange={event => setDamage(index, { amount: event.target.value })} placeholder='TND' sx={{ width: 110 }} slotProps={{ htmlInput: { inputMode: 'decimal', 'aria-label': (index + 1) + '. ' + t('payment:amount') } }} />}
              <IconButton color='error' aria-label={t('common:remove')} onClick={() => setDamages(current => current.filter((_item, itemIndex) => itemIndex !== index))}><DeleteOutline /></IconButton>
            </Stack>
          )}
        </Section>

        {! isPickup && <Section>
          <FormControlLabel control={<Checkbox checked={isDirty} onChange={() => setIsDirty(current => ! current)} />} label={t('handover:dirty')} />
          {isDirty && <TextField label={t('handover:washing')} value={washing} onChange={event => setWashing(event.target.value)} sx={{ maxWidth: 200 }} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />}
        </Section>}

        {! isPickup && ((preview?.charges.length ?? 0) > 0 || damageTotal > 0 || washingTotal > 0) && <Section title='charge:label'>
          {preview?.charges.map(charge =>
            <FormControlLabel
              key={charge.type}
              control={<Checkbox checked={! waived.includes(charge.type)} onChange={() => setWaived(current => current.includes(charge.type) ? current.filter(type => type !== charge.type) : [ ...current, charge.type ])} />}
              label={<Typography sx={{ textDecoration: waived.includes(charge.type) ? 'line-through' : 'none' }}>
                {t('charge:' + charge.type + (charge.unit ? ':' + charge.unit : ''), { quantity: charge.quantity, amount: money(charge.amount) })}
              </Typography>}
            />
          )}
          {damageTotal > 0 && <Typography>{t('charge:damage', { quantity: damages.filter(damage => millimesFromInput(damage.amount)).length, amount: money(damageTotal) })}</Typography>}
          {washingTotal > 0 && <Typography>{t('charge:washing', { amount: money(washingTotal) })}</Typography>}
          <Typography sx={{ fontWeight: 700 }}>{t('charge:total', { amount: money(chargesTotal) })}</Typography>
          {chargesTotal > 0 && (preview?.deposit_available ?? 0) > 0 && <FormControlLabel
            control={<Checkbox checked={fromDeposit} onChange={() => setFromDeposit(current => ! current)} />}
            label={t('charge:from_deposit', { amount: money(Math.min(chargesTotal, preview!.deposit_available)) })}
          />}
          {! fromDeposit && chargesTotal > 0 && <Typography color='text.secondary'>{t('charge:to_balance')}</Typography>}
        </Section>}

        {isPickup && <Section><SignatureField value={signature ?? data.signature} onChange={setSignature} /></Section>}
        <Box><Button variant='contained' size='large' startIcon={<Check />} onClick={onSave} loading={save.isPending}>{t(isPickup ? 'handover:pickup:save' : 'handover:return:save')}</Button></Box>
      </Stack>
    </Page>
  );
}
