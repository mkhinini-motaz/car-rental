import { Text, View } from 'react-native';
import KeyboardScroll from '../components/ui/KeyboardScroll';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { index, quote, Quote } from '../api/car';
import { pricing, useAgency } from '../api/agency';
import Agency, { atTime } from '../classes/Agency';
import { invalidateContractQueries, store } from '../api/contract';
import DateTimeField from '../components/Form/DateTimeField';
import TextField from '../components/Form/TextField';
import { useEffect, useRef, useState } from 'react';
import { periodsAreEqual, formatDateTime, occursInPeriod, diffInDays, formatMoneyDisplay, plate } from '../support/utils';
import { millimesFromInput, priceInputFromMillimes } from '../support/money';
import { default as CarClass } from '../classes/Car';
import Client from '../classes/Client';
import { Extra, extrasPrice } from '../classes/Contract';
import { alertMessage, alertOccursInPeriod, alertRequestError, isOverlapError } from '../support/alert';
import { useLang } from '../store/hooks';
import { default as AvailabilityClass } from '../classes/Availability';
import AvailableCar from '../components/car/AvailableCar';
import LangAwareView from '../components/common/LangAwareView';
import FullScreenLoader from '../components/common/FullScreenLoader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Screen from '../components/ui/Screen';import ClientPicker from '../components/client/ClientPicker';
import ClientWarning from '../components/client/ClientWarning';
import TranslatableText from '../components/common/TranslatableText';
import ExtrasField from '../components/contract/ExtrasField';
import LocationField from '../components/contract/LocationField';
import SourceField, { emptySource, sourceInput, SourceValue } from '../components/contract/SourceField';
import { syncAutoExtras } from '../support/extras';
import { ScreenProps } from '../navigation/types';

const HOUR = 60 * 60 * 1000;

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

const slotKey = (availability: AvailabilityClass) => availability.car.id + '-' + availability.period[0];

// Why the suggested price differs from the car's: the season and the long-rental discount.
function QuoteHint({ data }: { data?: Quote }) {
  const { selectedLang } = useLang();
  if (! data || (! data.seasons.length && ! data.discount_percent)) {
    return null;
  }
  const details = [ ...data.seasons, data.discount_percent ? '-' + data.discount_percent + '%' : '' ].filter(Boolean).join(', ');
  return <TranslatableText
    data='reservation:quote'
    params={{ base: formatMoneyDisplay(data.base_price, selectedLang), details }}
    className='text-meta text-muted'
  />;
}

// From the planning, `route.params` holds the car and the day tapped: the slot is picked already.
export default function CreateReservationScreen({ route, navigation }: ScreenProps<'CreateReservation'>): React.JSX.Element {
  const { selectedLang } = useLang();
  const queryClient = useQueryClient();
  const [selectedAvailabilities, setSelectedAvailabilities] = useState<AvailabilityClass[]>([]);
  const [startsAt, setStartsAt] = useState(() => defaultPeriod()[0]);
  const [endsAt, setEndsAt] = useState(() => defaultPeriod()[1]);
  const [client, setClient] = useState<Client|null>(null);
  const [clientIsMissing, setClientIsMissing] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({}); // dinars as typed, per slot
  const [quotes, setQuotes] = useState<Record<string, Quote>>({}); // suggested by the pricing rules, per slot
  const [note, setNote] = useState('');
  const [secondDriver, setSecondDriver] = useState<Client|null>(null);
  const [pickupLocation, setPickupLocation] = useState<string|null>(null);
  const [returnLocation, setReturnLocation] = useState<string|null>(null);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [source, setSource] = useState<SourceValue>(emptySource);
  const [sourceIsInvalid, setSourceIsInvalid] = useState(false);
  const { data: rules } = useQuery({ queryKey: ['agency.pricing'], queryFn: pricing });
  const { data: agency } = useAgency();
  const periodIsTouched = useRef(false);
  const searched: [number, number] = [ ~~(startsAt.getTime() / 1000), ~~(endsAt.getTime() / 1000) ];
  const queryKey = ['car.index.search', { starts_at: searched[0], ends_at: searched[1] }];
  const { data: availableCars, isLoading: isSearching } = useQuery({ queryKey, queryFn: index });

  // A new period drops the slots picked for the old one.
  const changePeriod = (from: Date, to: Date) => {
    periodIsTouched.current = true;
    setStartsAt(from);
    setEndsAt(to);
    setSelectedAvailabilities([]);
  };

  // Once the agency is known, a period nobody changed moves to its usual times.
  useEffect(() => {
    if (agency && ! periodIsTouched.current && ! route.params?.car) {
      const [ from, to ] = defaultPeriod(agency);
      setStartsAt(from);
      setEndsAt(to);
    }
  }, [agency, route.params]);

  // The planning's empty cell: that car, that day at the usual pickup time to the next day's return time.
  const preset = route.params;
  useEffect(() => {
    if (! preset?.car) {
      return;
    }
    const from = new Date(preset.startsAt! * 1000); // the planning sends both
    const to = agency ? atTime(new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1), agency.return_time) : new Date(from.getTime() + 24 * HOUR);
    periodIsTouched.current = true;
    setStartsAt(from);
    setEndsAt(to);
    const slot = { car: preset.car, period: [ from.getTime() / 1000, to.getTime() / 1000 ] as [number, number] };
    setSelectedAvailabilities([ slot ]);
    fetchQuote(slot);
  }, [preset, agency]); // again once the agency's return time is known

  const priceOf = (availability: AvailabilityClass) =>
    prices[slotKey(availability)] ?? priceInputFromMillimes(availability.car.daily_price);

  // Prefills the slot's price from the agency's pricing rules, unless staff already typed one.
  const fetchQuote = (availability: AvailabilityClass) => {
    const key = slotKey(availability);
    quote(availability.car.id, availability.period[0], availability.period[1])
      .then(suggested => {
        setQuotes(current => ({ ...current, [key]: suggested }));
        setPrices(current => key in current ? current : { ...current, [key]: priceInputFromMillimes(suggested.daily_price) });
      })
      .catch(() => {}); // the car's own price stays
  };

  const reset = () => {
    setSelectedAvailabilities([]);
    setClient(null);
    setPrices({});
    setQuotes({});
    setNote('');
    setSecondDriver(null);
    setPickupLocation(null);
    setReturnLocation(null);
    setExtras([]);
    setSource(emptySource);
    navigation.setParams({ car: undefined, startsAt: undefined });
  };

  const changeTrip = (change: Partial<{ secondDriver: Client|null, pickupLocation: string|null, returnLocation: string|null }>) => {
    const trip = { secondDriver, pickupLocation, returnLocation, ...change };
    setSecondDriver(trip.secondDriver);
    setPickupLocation(trip.pickupLocation);
    setReturnLocation(trip.returnLocation);
    setExtras(current => syncAutoExtras(current, rules, selectedLang, trip));
  };

  const save = useMutation({
    mutationFn: () => store({
      client_id: client!.id,
      second_driver_id: secondDriver?.id ?? null,
      pickup_location: pickupLocation?.trim() || null,
      return_location: returnLocation?.trim() || null,
      extras,
      note: note.trim() || undefined,
      ...sourceInput(source, total / selectedAvailabilities.length), // a percentage is of each car's rental
      contracts: selectedAvailabilities.map(availability => ({
        car_id: availability.car.id,
        starts_at: availability.period[0],
        ends_at: availability.period[1],
        daily_price: millimesFromInput(priceOf(availability))!,
      })),
    }),
    onSuccess: () => {
      invalidateContractQueries(queryClient);
      reset();
      alertMessage(selectedLang, 'reservation:saved');
      navigation.navigate('Tabs', { screen: 'Today' });
    },
    onError: (error) => {
      alertRequestError(selectedLang, error);
      if (isOverlapError(error)) {
        // Someone booked one of these cars meanwhile: show fresh availability.
        setSelectedAvailabilities([]);
        invalidateContractQueries(queryClient);
      }
    },
  });

  const onSavePress = () => {
    if (! client) {
      setClientIsMissing(true);
      alertMessage(selectedLang, 'client:required');
      return;
    }
    if (secondDriver && secondDriver.id === client.id) {
      alertMessage(selectedLang, 'driver:second:same');
      return;
    }
    if (selectedAvailabilities.some(availability => ! millimesFromInput(priceOf(availability)))) {
      alertMessage(selectedLang, 'contract:price:invalid');
      return;
    }
    if (! sourceInput(source, total)) {
      setSourceIsInvalid(true);
      alertMessage(selectedLang, 'contract:broker:invalid');
      return;
    }
    save.mutate();
  };

  const onAvailabilityPress = (car: CarClass, selectedAvailability: [number, number]) => {
    if (selectedAvailabilities.length === 0) {
      setSelectedAvailabilities([{ car, period: selectedAvailability }]);
      fetchQuote({ car, period: selectedAvailability });
      return;
    }

    let alreadySelected = false;
    const availabilities = [ ];
    for (const availability of selectedAvailabilities) {
      if (periodsAreEqual(availability.period, selectedAvailability)) {
        if (availability.car.id === car.id) {
          alreadySelected = true;
          continue;
        }
        alertOccursInPeriod(selectedLang);
        return;
      }

      if (occursInPeriod(selectedAvailability, availability.period)) {
        alertOccursInPeriod(selectedLang);
        return;
      }

      availabilities.push(availability);
    }

    if (! alreadySelected) {
      availabilities.push({ car, period: selectedAvailability });
      fetchQuote({ car, period: selectedAvailability });
    }

    availabilities.sort((availability1, availability2) => availability1.period[0] - availability2.period[0]);
    setSelectedAvailabilities(availabilities);
  };

  const slotDays = (availability: AvailabilityClass) => diffInDays(availability.period[0], availability.period[1]);
  const total = selectedAvailabilities.reduce(
    (sum, availability) => sum + (millimesFromInput(priceOf(availability)) ?? 0) * slotDays(availability) + extrasPrice(extras, slotDays(availability)),
    0,
  );

  return (
    <Screen>
      <KeyboardScroll contentContainerStyle={{ paddingBottom: 32 }}>
        <Card>
          <LangAwareView style={{ gap: 8 }}>
            <DateTimeField label='contract:starts_at' value={startsAt} onChange={(date) => changePeriod(date, endsAt)} minuteInterval={30} />
            <DateTimeField label='contract:ends_at' value={endsAt} onChange={(date) => changePeriod(startsAt, date)} minuteInterval={30} minDate={startsAt} />
          </LangAwareView>
        </Card>

        <TranslatableText data='reservation:available' params={{ count: availableCars?.length ?? 0 }} className='text-title font-semibold text-ink mx-4 mt-3 mb-1' />
        {isSearching ? <FullScreenLoader /> :
          availableCars?.length ? availableCars.map(car => <AvailableCar
            key={car.id}
            data={car}
            searched={searched}
            selected={selectedAvailabilities.filter(availability => availability.car.id === car.id)}
            onPress={(period) => onAvailabilityPress(car, period)}
          />) :
          <EmptyState icon='car-off' label='reservation:none' />
        }

        {selectedAvailabilities.length > 0 && <Card>
          <TranslatableText data='reservation:selected' className='text-title font-semibold text-ink' />
          {selectedAvailabilities.map(availability => {
            const dailyPrice = millimesFromInput(priceOf(availability));
            return (
              <View key={slotKey(availability)} style={{ gap: 6, paddingVertical: 4 }}>
                <Text className='text-body font-semibold text-ink'>{plate(availability.car.licence_plate)} · {availability.car.model_name}</Text>
                <Text className='text-meta text-muted'>{formatDateTime(availability.period[0])} → {formatDateTime(availability.period[1])} · {slotDays(availability)} j</Text>
                <TextField
                  label='contract:daily_price'
                  value={priceOf(availability)}
                  onChange={(price) => setPrices({ ...prices, [slotKey(availability)]: price })}
                  keyboardType='decimal-pad'
                  error={! dailyPrice}
                />
                <QuoteHint data={quotes[slotKey(availability)]} />
              </View>
            );
          })}
        </Card>}

        {selectedAvailabilities.length > 0 && <Card>
          <ClientPicker
            value={client}
            onChange={(newClient) => {
              setClient(newClient);
              setClientIsMissing(false);
            }}
            error={clientIsMissing}
          />
          <ClientWarning clientId={client?.id} />
          <ClientPicker label='driver:second' value={secondDriver} onChange={(driver) => changeTrip({ secondDriver: driver })} onClear={() => changeTrip({ secondDriver: null })} />
          <ClientWarning clientId={secondDriver?.id} withBadge={false} />
          {/* Delivered at the airport usually means collected there too: the return place follows until changed. */}
          <LocationField
            label='location:pickup'
            value={pickupLocation}
            onChange={(location) => changeTrip({ pickupLocation: location, ...(returnLocation === pickupLocation ? { returnLocation: location } : {}) })}
            locations={rules?.locations ?? []}
          />
          <LocationField label='location:return' value={returnLocation} onChange={(location) => changeTrip({ returnLocation: location })} locations={rules?.locations ?? []} />
          <ExtrasField value={extras} onChange={setExtras} catalogue={rules?.extras ?? []} days={selectedAvailabilities.reduce((sum, availability) => sum + slotDays(availability), 0)} />
          <SourceField value={source} onChange={setSource} error={sourceIsInvalid} />
          <TextField label='contract:note' value={note} onChange={setNote} multiline />
          <TranslatableText data='reservation:total' params={{ price: formatMoneyDisplay(total, selectedLang) }} className='text-title font-semibold text-ink' />
          <Button label='reservation:save' onPress={onSavePress} isLoading={save.isPending} icon='check' />
        </Card>}
      </KeyboardScroll>
    </Screen>
  );
};
