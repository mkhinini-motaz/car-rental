import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { index as cars } from '../api/car';
import { store } from '../api/fine';
import { useLang } from '../store/hooks';
import { alertMessage, alertRequestError } from '../support/alert';
import { millimesFromInput } from '../support/money';
import Button from '../components/ui/Button';
import FormScreen from '../components/ui/FormScreen';
import ChipsField from '../components/Form/ChipsField';
import DateTimeField from '../components/Form/DateTimeField';
import TextField from '../components/Form/TextField';
import { ScreenProps } from '../navigation/types';
import { plate } from '../support/utils';

// A fine as written on the PV: the plate, when, how much. The API finds who had the car.
export default function FineFormScreen({ navigation }: ScreenProps<'FineFormScreen'>): React.JSX.Element {
  const { selectedLang } = useLang();
  const queryClient = useQueryClient();
  const { data: carList } = useQuery({ queryKey: ['car.index'], queryFn: cars });
  const [carId, setCarId] = useState<number|null>(null);
  const [committedAt, setCommittedAt] = useState(new Date());
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');

  const save = useMutation({
    mutationFn: () => store({
      car_id: carId!,
      committed_at: Math.floor(committedAt.getTime() / 1000),
      amount: millimesFromInput(amount)!,
      reference: reference.trim() || null,
      note: note.trim() || null,
    }),
    onSuccess: (fine) => {
      queryClient.invalidateQueries({ queryKey: ['fine.index'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
      navigation.replace('FineScreen', { fineId: fine.id });
    },
    onError: (error) => alertRequestError(selectedLang, error),
  });

  return (
    <FormScreen>
          <ChipsField label='car:licence_plate' value={carId} onChange={setCarId} options={(carList ?? []).map(car => ({ label: plate(car.licence_plate), value: car.id }))} />
          <DateTimeField label='fine:committed_at' value={committedAt} onChange={setCommittedAt} minuteInterval={5} />
          <TextField label='payment:amount' value={amount} onChange={setAmount} keyboardType='decimal-pad' />
          <TextField label='fine:reference' value={reference} onChange={setReference} />
          <TextField label='contract:note' value={note} onChange={setNote} />
          <Button
            label='fine:save'
            isLoading={save.isPending}
            onPress={() => carId && millimesFromInput(amount) ? save.mutate() : alertMessage(selectedLang, 'fine:invalid')}
            icon='magnify'
          />
        </FormScreen>
  );
}
