import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MONEY_QUERIES, storeIncome } from '../api/money';
import { CATEGORIES, CATEGORY_INSURANCE_PAYOUT } from '../classes/Income';
import { METHOD_CASH, METHODS } from '../classes/Payment';
import { useLang } from '../store/hooks';
import { alertMessage, alertRequestError } from '../support/alert';
import { millimesFromInput } from '../support/money';
import ChipsField from '../components/Form/ChipsField';
import DateField from '../components/Form/DateField';
import TextField from '../components/Form/TextField';
import Button from '../components/ui/Button';
import FormScreen from '../components/ui/FormScreen';
import { ScreenProps } from '../navigation/types';

// Money received that isn't rent (owner): an insurance payout, parts sold... on a car (`carId`) or not.
export default function IncomeFormScreen({ route, navigation }: ScreenProps<'IncomeFormScreen'>): React.JSX.Element {
  const carId = route.params?.carId ?? null;
  const { selectedLang } = useLang();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<number>(CATEGORY_INSURANCE_PAYOUT);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<number>(METHOD_CASH);
  const [receivedAt, setReceivedAt] = useState<Date|null>(new Date());
  const [note, setNote] = useState('');

  const save = useMutation({
    mutationFn: () => storeIncome({
      car_id: carId, category, amount: millimesFromInput(amount)!, method: method as 1, note: note.trim() || null,
      received_at: receivedAt ? Math.floor(receivedAt.getTime() / 1000) : undefined,
    }),
    onSuccess: () => {
      MONEY_QUERIES.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
      navigation.goBack();
    },
    onError: (error) => alertRequestError(selectedLang, error),
  });

  return (
    <FormScreen>
      <ChipsField label='income:category' value={category} onChange={setCategory} options={CATEGORIES.map(value => ({ label: 'income:category:' + value, value }))} />
      <TextField label='payment:amount' value={amount} onChange={setAmount} keyboardType='decimal-pad' />
      <ChipsField label='income:method' value={method} onChange={setMethod} options={METHODS.map(value => ({ label: 'payment:method:' + value, value }))} />
      <DateField label='income:date' value={receivedAt} onChange={setReceivedAt} maxDate={new Date()} />
      <TextField label='contract:note' value={note} onChange={setNote} />
      <Button label='common:save' icon='check' isLoading={save.isPending} onPress={() => millimesFromInput(amount) ? save.mutate() : alertMessage(selectedLang, 'payment:amount:invalid')} />
    </FormScreen>
  );
}
