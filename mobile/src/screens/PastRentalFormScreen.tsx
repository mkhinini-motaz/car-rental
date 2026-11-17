import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { show } from '../api/car';
import { invalidateContractQueries, storePast } from '../api/contract';
import Client from '../classes/Client';
import { METHOD_CASH, METHODS } from '../classes/Payment';
import { useLang, useMoney } from '../store/hooks';
import { alertMessage, alertRequestError } from '../support/alert';
import { millimesFromInput, priceInputFromMillimes } from '../support/money';
import { diffInDays } from '../support/utils';
import ChipsField from '../components/Form/ChipsField';
import DateTimeField from '../components/Form/DateTimeField';
import TextField from '../components/Form/TextField';
import ClientPicker from '../components/client/ClientPicker';
import TranslatableText from '../components/common/TranslatableText';
import Button from '../components/ui/Button';
import FormScreen from '../components/ui/FormScreen';
import { ScreenProps } from '../navigation/types';

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Math.floor((Date.now() - days * DAY) / 3600000) * 3600000);

// A rental from the paper notebook, entered in one go on this car: no inspection, no papers asked.
// Paid in full it is closed; otherwise it stays returned with the rest owed.
export default function PastRentalFormScreen({ route, navigation }: ScreenProps<'PastRentalFormScreen'>): React.JSX.Element {
  const { carId } = route.params;
  const { selectedLang } = useLang();
  const money = useMoney();
  const queryClient = useQueryClient();
  const { data: car } = useQuery({ queryKey: ['car.show', { id: carId }], queryFn: show });
  const [client, setClient] = useState<Client|null>(null);
  const [startsAt, setStartsAt] = useState(() => daysAgo(7));
  const [endsAt, setEndsAt] = useState(() => daysAgo(4));
  const [price, setPrice] = useState('');
  const [paid, setPaid] = useState(''); // empty: in full
  const [method, setMethod] = useState(METHOD_CASH);
  const [pickupMileage, setPickupMileage] = useState('');
  const [returnMileage, setReturnMileage] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (car) {
      setPrice(current => current || priceInputFromMillimes(car.daily_price));
    }
  }, [car]);

  const from = Math.floor(startsAt.getTime() / 1000);
  const to = Math.floor(endsAt.getTime() / 1000);
  const total = Math.round((millimesFromInput(price) ?? 0) * diffInDays(from, to));
  const mileage = (value: string) => value.trim() ? parseInt(value.replace(/\D/g, ''), 10) : null;

  const save = useMutation({
    mutationFn: () => storePast({
      car_id: carId,
      client_id: client!.id,
      starts_at: from,
      ends_at: to,
      daily_price: millimesFromInput(price)!,
      paid: paid.trim() ? millimesFromInput(paid) : null,
      method,
      pickup_mileage: mileage(pickupMileage),
      return_mileage: mileage(returnMileage),
      note: note.trim() || null,
    }),
    onSuccess: (contract) => {
      invalidateContractQueries(queryClient);
      navigation.replace('ContractScreen', { contractId: contract.id });
    },
    onError: (error) => alertRequestError(selectedLang, error),
  });

  const onSavePress = () => {
    if (! client) {
      alertMessage(selectedLang, 'client:required');
    } else if (! millimesFromInput(price)) {
      alertMessage(selectedLang, 'contract:price:invalid');
    } else if (paid.trim() && millimesFromInput(paid) === null) {
      alertMessage(selectedLang, 'payment:amount:invalid');
    } else if (to <= from || to > Date.now() / 1000) {
      alertMessage(selectedLang, 'contract:past:dates');
    } else {
      save.mutate();
    }
  };

  return (
    <FormScreen>
      <TranslatableText data='contract:past:hint' className='text-body text-muted' />
      <ClientPicker value={client} onChange={setClient} />
      <DateTimeField label='contract:starts_at' value={startsAt} onChange={setStartsAt} maxDate={new Date()} minuteInterval={30} />
      <DateTimeField label='contract:ends_at' value={endsAt} onChange={setEndsAt} minDate={startsAt} maxDate={new Date()} minuteInterval={30} />
      <TextField label='contract:daily_price' value={price} onChange={setPrice} keyboardType='decimal-pad' />
      <TranslatableText data='reservation:total' params={{ price: money(total) }} className='text-title font-semibold text-ink' />
      <TextField label='contract:past:paid' value={paid} onChange={setPaid} keyboardType='decimal-pad' />
      <ChipsField label='expense:method' value={method} onChange={setMethod} options={METHODS.map(value => ({ label: 'payment:method:' + value, value }))} />
      <TextField label='contract:past:mileage:pickup' value={pickupMileage} onChange={setPickupMileage} keyboardType='number-pad' />
      <TextField label='contract:past:mileage:return' value={returnMileage} onChange={setReturnMileage} keyboardType='number-pad' />
      <TextField label='contract:note' value={note} onChange={setNote} multiline />
      <Button label='contract:past:save' icon='check' isLoading={save.isPending} onPress={onSavePress} />
    </FormScreen>
  );
}
