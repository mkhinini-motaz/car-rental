import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Button, Grid, Stack, TextField, Typography } from '@mui/material';
import CarRental from '@mui/icons-material/CarRental';
import EventBusy from '@mui/icons-material/EventBusy';
import Save from '@mui/icons-material/Save';
import Build from '@mui/icons-material/Build';
import { pricing } from '../../../src/api/agency';
import { cancel, invalidateContractQueries, show, update } from '../../../src/api/contract';
import Client from '../../../src/classes/Client';
import { Extra, extrasPrice, STATUS_CLOSED, STATUS_OUT, STATUS_RESERVED, STATUS_RETURNED } from '../../../src/classes/Contract';
import { STAGE_PICKUP, STAGE_RETURN } from '../../../src/classes/Inspection';
import { useIsOwner, useLang, useT } from '../../../src/store/Store';
import { syncAutoExtras } from '../../../src/support/extras';
import { millimesFromInput, priceInputFromMillimes } from '../../../src/support/money';
import { diffInDays } from '../../../src/support/utils';
import { CarName } from '../../../src/components/car';
import { ClientPicker, ClientWarning } from '../../../src/components/client';
import { ContractCard, ContractStatus, emptySource, ExtrasField, LocationField, SourceField, sourceInput, sourceOf, SourceValue } from '../../../src/components/contract';
import { ActivityLog, CloseSection, HandoverSummary, PapersSection, PaymentsSection, TasksSection, WhatsAppSection } from '../../../src/components/contractSections';
import { InspectionSummary } from '../../../src/components/inspection';
import { FineRow } from '../../../src/components/fine';
import { useFeedback } from '../../../src/components/Feedback';
import ExpenseDialog from '../../../src/components/ExpenseDialog';
import { DateTimeInput, Empty, Loading, Page, Section, useMoney } from '../../../src/components/common';

const DAY = 24 * 60 * 60 * 1000;
type Trip = { secondDriver: Client|null, pickupLocation: string|null, returnLocation: string|null };

// A contract: edited while it isn't closed, then handed over, taken back, settled; payments, fines,
// the inspection and who did what.
export default function ContractPage() {
  const t = useT();
  const money = useMoney();
  const router = useRouter();
  const contractId = Number(router.query.id);
  const { selectedLang } = useLang();
  const isOwner = useIsOwner();
  const queryClient = useQueryClient();
  const { notify, confirm, requestError } = useFeedback();
  const { isLoading, data } = useQuery({ queryKey: ['contract.show', { id: contractId }], queryFn: show });
  const { data: rules } = useQuery({ queryKey: ['agency.pricing'], queryFn: pricing });

  const [startsAt, setStartsAt] = useState<Date|null>(null);
  const [endsAt, setEndsAt] = useState<Date|null>(null);
  const [price, setPrice] = useState('');
  const [client, setClient] = useState<Client|null>(null);
  const [note, setNote] = useState('');
  const [extras, setExtras] = useState<Extra[]>([]);
  const [trip, setTrip] = useState<Trip>({ secondDriver: null, pickupLocation: null, returnLocation: null });
  const [isAddingRepair, setIsAddingRepair] = useState(false);
  const [source, setSource] = useState<SourceValue>(emptySource);
  const [sourceIsInvalid, setSourceIsInvalid] = useState(false);
  useEffect(() => {
    if (data) {
      setExtras(data.extras);
      setTrip({ secondDriver: data.second_driver ?? null, pickupLocation: data.pickup_location, returnLocation: data.return_location });
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
      second_driver_id: trip.secondDriver?.id ?? null,
      pickup_location: trip.pickupLocation?.trim() || null,
      return_location: trip.returnLocation?.trim() || null,
      note: note.trim() || null,
      extras,
      ...sourceInput(source, rentalTotal)!,
    }),
    onSuccess: () => {
      invalidateContractQueries(queryClient);
      notify('contract:saved', 'success');
    },
    onError: requestError,
  });
  const cancelContract = useMutation({
    mutationFn: () => cancel(contractId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['contract.show', { id: contractId }] }); // it's gone: don't refetch it
      invalidateContractQueries(queryClient);
      router.back();
    },
    onError: requestError,
  });

  if (isLoading) {
    return <Loading />;
  }
  if (! data || ! startsAt || ! endsAt) {
    return <Page title='contract:label'><Empty /></Page>;
  }

  const dailyPrice = millimesFromInput(price);
  const days = diffInDays(startsAt.getTime() / 1000, endsAt.getTime() / 1000);
  const rentalTotal = (dailyPrice ?? 0) * days + extrasPrice(extras, days); // a commission typed as '10%' is of this
  // The second driver and the delivery places bring their fees along.
  const changeTrip = (change: Partial<Trip>) => {
    const next = { ...trip, ...change };
    setTrip(next);
    setExtras(current => syncAutoExtras(current, rules, selectedLang, next));
  };
  const onSave = () => {
    if (trip.secondDriver && trip.secondDriver.id === client?.id) {
      notify('driver:second:same', 'error');
    } else if (! dailyPrice || endsAt <= startsAt) {
      notify(! dailyPrice ? 'contract:price:invalid' : 'contract:dates:invalid', 'error');
    } else if (! sourceInput(source, rentalTotal)) {
      setSourceIsInvalid(true);
      notify('contract:broker:invalid', 'error');
    } else {
      save.mutate();
    }
  };

  const actions = <>
    {data.status === STATUS_RESERVED && <Button variant='contained' startIcon={<CarRental />} component={Link} href={`/contracts/${contractId}/handover?stage=${STAGE_PICKUP}`}>{t('handover:pickup')}</Button>}
    {data.status === STATUS_OUT && <Button variant='contained' startIcon={<CarRental />} component={Link} href={`/contracts/${contractId}/handover?stage=${STAGE_RETURN}`}>{t('handover:return')}</Button>}
    {/* A repair this rental caused: counted against its client. */}
    {data.status !== STATUS_RESERVED && <Button variant='outlined' startIcon={<Build />} onClick={() => setIsAddingRepair(true)}>{t('contract:repair')}</Button>}
  </>;

  return (
    <Page titleText={t('contract:label') + ' #' + data.id} actions={actions}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}>
          {data.status === STATUS_CLOSED ? <ContractCard data={data} /> :
            <Section>
              <ContractStatus status={data.status} />
              {data.car && <CarName data={data.car} withPlate link />}
              <ClientPicker value={client} onChange={setClient} />
              <ClientWarning clientId={client?.id} />
              <ClientPicker label='driver:second' value={trip.secondDriver} onChange={driver => changeTrip({ secondDriver: driver })} onClear={() => changeTrip({ secondDriver: null })} />
              <ClientWarning clientId={trip.secondDriver?.id} withBadge={false} />
              <LocationField label='location:pickup' value={trip.pickupLocation} onChange={location => changeTrip({ pickupLocation: location })} locations={rules?.locations ?? []} />
              <LocationField label='location:return' value={trip.returnLocation} onChange={location => changeTrip({ returnLocation: location })} locations={rules?.locations ?? []} />
              <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2, mt: 1 }}>
                <DateTimeInput label='contract:starts_at' value={startsAt} onChange={setStartsAt} />
                <DateTimeInput label='contract:ends_at' value={endsAt} onChange={setEndsAt} />
              </Stack>
              <Box><Button size='small' onClick={() => setEndsAt(new Date(endsAt.getTime() + DAY))}>+ {t('contract:add_day')}</Button></Box>
              <TextField label={t('contract:daily_price')} value={price} onChange={event => setPrice(event.target.value)} error={! dailyPrice} slotProps={{ htmlInput: { inputMode: 'decimal' } }} sx={{ maxWidth: 240 }} />
              <TextField label={t('contract:note')} value={note} onChange={event => setNote(event.target.value)} multiline minRows={2} />
              <ExtrasField value={extras} onChange={setExtras} catalogue={rules?.extras ?? []} days={days} />
              <SourceField value={source} onChange={setSource} error={sourceIsInvalid} />
              <Typography variant='h6' component='p'>{t('contract:total', { days, price: dailyPrice ? money(dailyPrice * days + extrasPrice(extras, days)) : '—' })}</Typography>
              <Box><Button variant='contained' startIcon={<Save />} onClick={onSave} loading={save.isPending}>{t('common:save')}</Button></Box>
            </Section>
          }
          <InspectionSummary data={data} />
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <HandoverSummary data={data} />
          <TasksSection data={data} />
          {data.status === STATUS_RETURNED && <CloseSection data={data} />}
          <PaymentsSection data={data} />
          <WhatsAppSection data={data} />
          <PapersSection data={data} />
          {data.fines?.map(fine => <FineRow key={fine.id} data={fine} href={'/fines/' + fine.id} />)}
          <ActivityLog activities={data.activities} />
          {data.status === STATUS_RESERVED && isOwner && <Button
            variant='outlined'
            color='error'
            startIcon={<EventBusy />}
            loading={cancelContract.isPending}
            onClick={async () => await confirm('contract:cancel:confirm') && cancelContract.mutate()}
          >
            {t('contract:cancel')}
          </Button>}
        </Grid>
      </Grid>
      <ExpenseDialog open={isAddingRepair} onClose={() => setIsAddingRepair(false)} contractId={contractId} />
    </Page>
  );
}
