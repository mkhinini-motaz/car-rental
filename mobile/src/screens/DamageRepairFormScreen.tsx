import { useState } from 'react';
import { Text } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { repairDamage } from '../api/car';
import { MONEY_QUERIES } from '../api/money';
import { useLang } from '../store/hooks';
import { alertMessage, alertRequestError } from '../support/alert';
import { millimesFromInput } from '../support/money';
import DateField from '../components/Form/DateField';
import TextField from '../components/Form/TextField';
import Button from '../components/ui/Button';
import FormScreen from '../components/ui/FormScreen';
import { ScreenProps } from '../navigation/types';

// A damage on the car is repaired: it stops showing at handovers. The cost, if typed, is the car's expense.
export default function DamageRepairFormScreen({ route, navigation }: ScreenProps<'DamageRepairFormScreen'>): React.JSX.Element {
  const { carId, damage } = route.params;
  const { selectedLang } = useLang();
  const queryClient = useQueryClient();
  const [repairedAt, setRepairedAt] = useState<Date|null>(new Date());
  const [amount, setAmount] = useState('');
  const [garage, setGarage] = useState('');

  const save = useMutation({
    mutationFn: () => repairDamage(carId, damage.id, {
      repaired_at: Math.floor((repairedAt ?? new Date()).getTime() / 1000),
      amount: amount.trim() ? millimesFromInput(amount) : null,
      garage: garage.trim() || null,
    }),
    onSuccess: () => {
      [ ...MONEY_QUERIES, 'contract.show', 'client.show' ].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
      navigation.goBack();
    },
    onError: (error) => alertRequestError(selectedLang, error),
  });

  return (
    <FormScreen>
      <Text className='text-title font-semibold text-ink'>{damage.note || '—'}</Text>
      <DateField label='damage:repaired_at' value={repairedAt} onChange={setRepairedAt} maxDate={new Date()} />
      <TextField label='damage:repair:cost' value={amount} onChange={setAmount} keyboardType='decimal-pad' />
      <TextField label='expense:garage' value={garage} onChange={setGarage} />
      <Button
        label='damage:repair'
        icon='check'
        isLoading={save.isPending}
        onPress={() => amount.trim() && ! millimesFromInput(amount) ? alertMessage(selectedLang, 'payment:amount:invalid') : save.mutate()}
      />
    </FormScreen>
  );
}
