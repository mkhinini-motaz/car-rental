import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { storeBlock } from '../api/car';
import Car from '../classes/Car';
import { REASON_MAINTENANCE, REASONS } from '../classes/CarBlock';
import { useLang } from '../store/hooks';
import { alertMessage, alertRequestError } from '../support/alert';
import Button from '../components/ui/Button';
import FormScreen from '../components/ui/FormScreen';
import ChipsField from '../components/Form/ChipsField';
import DateTimeField from '../components/Form/DateTimeField';
import TextField from '../components/Form/TextField';
import { Text } from 'react-native';
import { ScreenProps } from '../navigation/types';
import { plate } from '../support/utils';

const HOUR = 60 * 60 * 1000;

// Takes a car off the planning (garage, the owner's own use) from the day tapped, 08:00 to
// 18:00 by default. Bookings can't use those days; the API refuses a period already taken.
export default function BlockFormScreen({ route, navigation }: ScreenProps<'BlockFormScreen'>): React.JSX.Element {
  const car: Car = route.params.car;
  const day = new Date(route.params.startsAt * 1000);
  const { selectedLang } = useLang();
  const queryClient = useQueryClient();
  const [startsAt, setStartsAt] = useState(() => new Date(day.getTime() + 8 * HOUR));
  const [endsAt, setEndsAt] = useState(() => new Date(day.getTime() + 18 * HOUR));
  const [reason, setReason] = useState<number>(REASON_MAINTENANCE);
  const [note, setNote] = useState('');

  const save = useMutation({
    mutationFn: () => storeBlock(car.id, {
      starts_at: Math.floor(startsAt.getTime() / 1000),
      ends_at: Math.floor(endsAt.getTime() / 1000),
      reason: reason as 1,
      note: note.trim() || null,
    }),
    onSuccess: () => {
      for (const key of [ 'planning', 'car.index.search', 'dashboard' ]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      navigation.goBack();
    },
    onError: (error) => alertRequestError(selectedLang, error), // an overlap says the car is taken
  });

  return (
    <FormScreen>
          <Text className='text-title font-semibold text-ink'>{plate(car.licence_plate)} · {car.manufacturer} {car.model_name}</Text>
          <DateTimeField label='contract:starts_at' value={startsAt} onChange={setStartsAt} minuteInterval={30} />
          <DateTimeField label='contract:ends_at' value={endsAt} onChange={setEndsAt} minuteInterval={30} minDate={startsAt} />
          <ChipsField label='block:reason' value={reason} onChange={setReason} options={REASONS.map(value => ({ label: 'block:reason:' + value, value }))} />
          <TextField label='contract:note' value={note} onChange={setNote} />
          <Button
            label='common:save'
            onPress={() => endsAt > startsAt ? save.mutate() : alertMessage(selectedLang, 'contract:dates:invalid')}
            isLoading={save.isPending}
            icon='calendar-lock-outline'
          />
        </FormScreen>
  );
}
