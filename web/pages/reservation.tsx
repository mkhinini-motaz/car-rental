import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Button, Card, CardContent, Grid, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import Save from '@mui/icons-material/Save';
import Search from '@mui/icons-material/Search';
import { index, quote, Quote, show as showCar } from '../src/api/car';
import { pricing, useAgency } from '../src/api/agency';
import Agency, { atTime } from '../src/classes/Agency';
import { invalidateContractQueries, store } from '../src/api/contract';
import Car from '../src/classes/Car';
import Client from '../src/classes/Client';
import { Extra, extrasPrice } from '../src/classes/Contract';
import Availability, { coverage, daysAndHours } from '../src/classes/Availability';
import { COLORS } from '../src/constants';
import { useLang, useT } from '../src/store/Store';
import { isOverlapError } from '../src/support/alert';
import { syncAutoExtras } from '../src/support/extras';
import { millimesFromInput, priceInputFromMillimes } from '../src/support/money';
import { arrow, debounce, diffInDays, formatDateTime, periodsAreEqual } from '../src/support/utils';
import { occursInPeriod } from '../src/support/day';
import { CarName } from '../src/components/car';
import { ClientPicker, ClientWarning } from '../src/components/client';
import { emptySource, ExtrasField, LocationField, SourceField, sourceInput, SourceValue } from '../src/components/contract';
import { useFeedback } from '../src/components/Feedback';
import { DateTimeInput, Empty, Loading, Page, Section, useMoney } from '../src/components/common';

const HOUR = 60 * 60 * 1000;
type Trip = { secondDriver: Client|null, pickupLocation: string|null, returnLocation: string|null };
const noTrip: Trip = { secondDriver: null, pickupLocation: null, returnLocation: null };

// The agency's next usual pickup time (today's if still ahead) to its return time the day after;
// until the agency is loaded, the next full hour and a day later.
function defaultPeriod(agency?: Agency): [Date, Date] {
  if (! agency) {
    const startsAt = new Date(Math.ceil(Date.now() / HOUR) * HOUR);
    return [ startsAt, new Date(startsAt.getTime() + 24 * HOUR) ];
  }
  const now = new Date();
  const today = atTime(now, agency.pickup_time);
  const startsAt = today > now ? today : atTime(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), agency.pickup_time);
  return [ startsAt, atTime(new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate() + 1), agency.return_time) ];
}

const slotKey = (availability: Availability) => availability.car.id + '-' + availability.period[0];

// Why the suggested price differs from the car's: the season and the long-rental discount.
function QuoteHint({ data }: { data?: Quote }) {
  const t = useT();
  const money = useMoney();
  if (! data || (! data.seasons.length && ! data.discount_percent)) {
    return null;
  }
  const details = [ ...data.seasons, data.discount_percent ? '-' + data.discount_percent + '%' : '' ].filter(Boolean).join(', ');
  return <Typography variant='body2' color='text.secondary'>{t('reservation:quote', { base: money(data.base_price), details })}</Typography>;
}

// A translated sentence with its **marked** parts in bold (the time missing, a price's figure).
const withBold = (text: string) => text.split('**').map((part, index) => index % 2 ? <b key={index}>{part}</b> : part);

// An amount with its figure marked for `withBold`: '**140** TND'.
const markFigure = (amount: string) => amount.replace(/\d(?:[\d\s.,]*\d)?/, '**$&**');

// A car's free periods within the one searched; click one to add it to the reservation. Under its
// dates, a bar over the searched period: green where the car is free, empty where it's missing (said
// in words below it). A car still out after its return date comes last, with a warning: it may not
// be back in time.
function CarAvailability({ car, searched, selected, onPick }: { car: Car, searched: [number, number], selected: Availability[], onPick: (period: [number, number]) => void }) {
  const t = useT();
  const money = useMoney();
  const { isRtl } = useLang();
  const duration = (seconds: number) => {
    const [ days, hours ] = daysAndHours(seconds);
    return [ days ? t('duration:days', { days }) : '', hours ? t('duration:hours', { hours }) : '' ].filter(Boolean).join(' ');
  };
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack sx={{ gap: 1 }}>
          <CarName data={car} withPlate link />
          <Typography variant='body2' color='text.secondary'>{withBold(t('car:daily_price', { price: markFigure(money(car.daily_price)) }))}</Typography>
          {!! car.overdue_since && <Typography variant='body2' sx={{ color: COLORS.warn, fontWeight: 600 }}>{t('car:overdue_since', { date: formatDateTime(car.overdue_since) })}</Typography>}
          {car.availability_in_period?.map(period => {
            const isSelected = selected.some(availability => periodsAreEqual(availability.period, period));
            const { from, to, missingBefore, missingAfter } = coverage(period, searched);
            const missing = [
              missingBefore > 0 ? t('reservation:missing:start', { time: duration(missingBefore) }) : '',
              missingAfter > 0 ? t('reservation:missing:end', { time: duration(missingAfter) }) : '',
            ].filter(Boolean).join(' · ');
            return <Stack key={period[0]} sx={{ gap: 0.5 }}>
              <Button variant={isSelected ? 'contained' : 'outlined'} aria-pressed={isSelected} onClick={() => onPick(period)} sx={{ pt: 0.75, pb: 1.25, fontWeight: 500, overflow: 'hidden' }}>
                {formatDateTime(period[0]) + arrow(isRtl) + formatDateTime(period[1])}
                {/* The searched period as a track along the button's bottom edge, green where the car is free.
                    Inline `insetInlineStart`: the RTL stylis plugin leaves it alone, and time runs from the right in Arabic. */}
                {! isSelected && <Box aria-hidden sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, bgcolor: 'divider' }}>
                  <Box sx={{ position: 'absolute', top: 0, bottom: 0, bgcolor: 'success.light' }} style={{ insetInlineStart: from + '%', width: (to - from) + '%' }} />
                </Box>}
              </Button>
              {!! missing && <Typography variant='body2'>{withBold(missing)}</Typography>}
            </Stack>;
          })}
          {!! car.contracts?.length && <Box>
            <Typography variant='caption' color='text.secondary'>{t('car:contracts_in_period')}</Typography>
            {car.contracts.map(contract => <Typography key={contract.id} variant='body2' color='text.secondary'>{formatDateTime(contract.starts_at) + arrow(isRtl) + formatDateTime(contract.ends_at)}</Typography>)}
          </Box>}
        </Stack>
      </CardContent>
    </Card>
  );
}

// From the planning, `?car=&startsAt=` holds the car and the day clicked: the slot is picked already.
export default function ReservationPage() {
  const t = useT();
  const money = useMoney();
  const router = useRouter();
  const { selectedLang, isRtl } = useLang();
  const queryClient = useQueryClient();
  const { notify, requestError } = useFeedback();
  const [selected, setSelected] = useState<Availability[]>([]);
  const [startsAt, setStartsAt] = useState(() => defaultPeriod()[0]);
  const [endsAt, setEndsAt] = useState(() => defaultPeriod()[1]);
  const [searchValue, setSearchValue] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSetSearch = useMemo(() => debounce(setSearch, 400), []);
  const [client, setClient] = useState<Client|null>(null);
  const [clientIsMissing, setClientIsMissing] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({}); // dinars as typed, per slot
  const [quotes, setQuotes] = useState<Record<string, Quote>>({}); // suggested by the pricing rules, per slot
  const [note, setNote] = useState('');
  const [trip, setTrip] = useState<Trip>(noTrip);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [source, setSource] = useState<SourceValue>(emptySource);
  const [sourceIsInvalid, setSourceIsInvalid] = useState(false);
  const { data: rules } = useQuery({ queryKey: ['agency.pricing'], queryFn: pricing });
  const { data: agency } = useAgency();
  const periodIsTouched = useRef(false);
  const period = { starts_at: Math.floor(startsAt.getTime() / 1000), ends_at: Math.floor(endsAt.getTime() / 1000) };
  const { data: cars, isLoading } = useQuery({ queryKey: ['car.index.search', { ...period, search }], queryFn: index, enabled: endsAt > startsAt });

  // Prefills the slot's price from the agency's pricing rules, unless staff already typed one.
  const fetchQuote = (availability: Availability) => {
    const key = slotKey(availability);
    quote(availability.car.id, availability.period[0], availability.period[1])
      .then(suggested => {
        setQuotes(current => ({ ...current, [key]: suggested }));
        setPrices(current => key in current ? current : { ...current, [key]: priceInputFromMillimes(suggested.daily_price) });
      })
      .catch(() => {}); // the car's own price stays
  };

  // The planning's empty cell: that car, that day at the usual pickup time to the next day's return time.
  const presetCarId = Number(router.query.car) || 0;
  const presetStartsAt = Number(router.query.startsAt) || 0;
  const { data: presetCar } = useQuery({ queryKey: ['car.show', { id: presetCarId }], queryFn: showCar, enabled: !! presetCarId });
  useEffect(() => {
    if (! presetCar || ! presetStartsAt) {
      return;
    }
    const from = new Date(presetStartsAt * 1000);
    const to = agency ? atTime(new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1), agency.return_time) : new Date(from.getTime() + 24 * HOUR);
    periodIsTouched.current = true;
    setStartsAt(from);
    setEndsAt(to);
    const slot = { car: presetCar, period: [ from.getTime() / 1000, to.getTime() / 1000 ] as [number, number] };
    setSelected([ slot ]);
    fetchQuote(slot);
  }, [presetCar, presetStartsAt, agency]); // eslint-disable-line react-hooks/exhaustive-deps

  // Once the agency is known, a period nobody changed moves to its usual times.
  useEffect(() => {
    if (agency && ! periodIsTouched.current && ! presetCarId) {
      const [ from, to ] = defaultPeriod(agency);
      setStartsAt(from);
      setEndsAt(to);
    }
  }, [agency, presetCarId]);

  // A new period drops the slots picked for the old one.
  const changePeriod = (from: Date, to: Date) => {
    periodIsTouched.current = true;
    setStartsAt(from);
    setEndsAt(to);
    setSelected([]);
  };
  const changeTrip = (change: Partial<Trip>) => {
    const next = { ...trip, ...change };
    setTrip(next);
    setExtras(current => syncAutoExtras(current, rules, selectedLang, next));
  };
  const priceOf = (availability: Availability) => prices[slotKey(availability)] ?? priceInputFromMillimes(availability.car.daily_price);
  const slotDays = (availability: Availability) => diffInDays(availability.period[0], availability.period[1]);

  // Adds or removes a slot; two slots can't overlap (the same client can't drive two cars at once).
  const onPick = (car: Car, picked: [number, number]) => {
    const isSame = (availability: Availability) => availability.car.id === car.id && periodsAreEqual(availability.period, picked);
    if (selected.some(isSame)) {
      setSelected(selected.filter(availability => ! isSame(availability)));
      return;
    }
    if (selected.some(availability => occursInPeriod(picked, availability.period))) {
      notify('car:availability:occurs_in_period', 'error');
      return;
    }
    const slot = { car, period: picked };
    setSelected([ ...selected, slot ].sort((a, b) => a.period[0] - b.period[0]));
    fetchQuote(slot);
  };

  const save = useMutation({
    mutationFn: () => store({
      client_id: client!.id,
      second_driver_id: trip.secondDriver?.id ?? null,
      pickup_location: trip.pickupLocation?.trim() || null,
      return_location: trip.returnLocation?.trim() || null,
      extras,
      note: note.trim() || undefined,
      ...sourceInput(source, total / selected.length), // a percentage is of each car's rental
      contracts: selected.map(availability => ({
        car_id: availability.car.id,
        starts_at: availability.period[0],
        ends_at: availability.period[1],
        daily_price: millimesFromInput(priceOf(availability))!,
      })),
    }),
    onSuccess: (contracts) => {
      invalidateContractQueries(queryClient);
      notify('reservation:saved', 'success');
      router.push(contracts.length === 1 ? '/contracts/' + contracts[0].id : '/today');
    },
    onError: (error) => {
      requestError(error);
      if (isOverlapError(error)) {
        // Someone booked one of these cars meanwhile: show fresh availability.
        setSelected([]);
        invalidateContractQueries(queryClient);
      }
    },
  });

  const onSave = () => {
    if (! client) {
      setClientIsMissing(true);
      notify('client:required', 'error');
    } else if (trip.secondDriver && trip.secondDriver.id === client.id) {
      notify('driver:second:same', 'error');
    } else if (selected.some(availability => ! millimesFromInput(priceOf(availability)))) {
      notify('contract:price:invalid', 'error');
    } else if (! sourceInput(source, total)) {
      setSourceIsInvalid(true);
      notify('contract:broker:invalid', 'error');
    } else {
      save.mutate();
    }
  };

  const total = selected.reduce((sum, availability) =>
    sum + (millimesFromInput(priceOf(availability)) ?? 0) * slotDays(availability) + extrasPrice(extras, slotDays(availability)), 0);

  return (
    <Page title='common:reservation:create'>
      <Section>
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
          <DateTimeInput label='contract:starts_at' value={startsAt} onChange={date => changePeriod(date, endsAt)} />
          <DateTimeInput label='contract:ends_at' value={endsAt} onChange={date => changePeriod(startsAt, date)} min={startsAt} />
          <TextField
            placeholder={t('common:search')}
            value={searchValue}
            onChange={event => { setSearchValue(event.target.value); debouncedSetSearch(event.target.value); }}
            slotProps={{ input: { startAdornment: <InputAdornment position='start'><Search /></InputAdornment> } }}
          />
        </Stack>
        {endsAt <= startsAt && <Typography color='error'>{t('contract:dates:invalid')}</Typography>}
      </Section>

      <Typography variant='h6' sx={{ mb: 1 }}>{t('common:car:availability')}</Typography>
      {isLoading ? <Loading /> : ! cars?.length ? <Empty /> :
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {cars.map(car => <Grid key={car.id} size={{ xs: 12, md: 6, lg: 4 }}>
            <CarAvailability car={car} searched={[ period.starts_at, period.ends_at ]} selected={selected.filter(availability => availability.car.id === car.id)} onPick={picked => onPick(car, picked)} />
          </Grid>)}
        </Grid>
      }

      {selected.length > 0 && <Section title='reservation:save'>
        {selected.map(availability => {
          const dailyPrice = millimesFromInput(priceOf(availability));
          return (
            <Stack key={slotKey(availability)} sx={{ gap: 1, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <CarName data={availability.car} withPlate link />
              <Typography>{formatDateTime(availability.period[0]) + arrow(isRtl) + formatDateTime(availability.period[1])} · {t('client:days_rented', { days: slotDays(availability) })}{dailyPrice ? ' · ' + money(dailyPrice * slotDays(availability)) : ''}</Typography>
              <TextField
                label={t('contract:daily_price')}
                value={priceOf(availability)}
                onChange={event => setPrices({ ...prices, [slotKey(availability)]: event.target.value })}
                error={! dailyPrice}
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                sx={{ maxWidth: 240 }}
              />
              <QuoteHint data={quotes[slotKey(availability)]} />
            </Stack>
          );
        })}

        <ClientPicker value={client} onChange={newClient => { setClient(newClient); setClientIsMissing(false); }} error={clientIsMissing} />
        <ClientWarning clientId={client?.id} />
        <ClientPicker label='driver:second' value={trip.secondDriver} onChange={driver => changeTrip({ secondDriver: driver })} onClear={() => changeTrip({ secondDriver: null })} />
        <ClientWarning clientId={trip.secondDriver?.id} withBadge={false} />
        {/* Delivered at the airport usually means collected there too: the return place follows until changed. */}
        <LocationField
          label='location:pickup'
          value={trip.pickupLocation}
          onChange={location => changeTrip({ pickupLocation: location, ...(trip.returnLocation === trip.pickupLocation ? { returnLocation: location } : {}) })}
          locations={rules?.locations ?? []}
        />
        <LocationField label='location:return' value={trip.returnLocation} onChange={location => changeTrip({ returnLocation: location })} locations={rules?.locations ?? []} />
        <ExtrasField value={extras} onChange={setExtras} catalogue={rules?.extras ?? []} days={selected.reduce((sum, availability) => sum + slotDays(availability), 0)} />
        <SourceField value={source} onChange={setSource} error={sourceIsInvalid} />
        <TextField label={t('contract:note')} value={note} onChange={event => setNote(event.target.value)} multiline minRows={2} />
        <Typography variant='h6' component='p'>{t('reservation:total', { price: money(total) })}</Typography>
        <Box><Button variant='contained' size='large' startIcon={<Save />} onClick={onSave} loading={save.isPending}>{t('reservation:save')}</Button></Box>
      </Section>}
    </Page>
  );
}
