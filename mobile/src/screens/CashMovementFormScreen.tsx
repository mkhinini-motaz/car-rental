import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MOVEMENT_TYPES, MOVEMENT_WITHDRAWAL, storeMovement } from '../api/cashbook';
import { useLang } from '../store/hooks';
import { alertMessage, alertRequestError } from '../support/alert';
import { millimesFromInput } from '../support/money';
import Button from '../components/ui/Button';
import FormScreen from '../components/ui/FormScreen';
import ChipsField from '../components/Form/ChipsField';
import TextField from '../components/Form/TextField';
import { ScreenProps } from '../navigation/types';

// Cash put in the till or taken out by hand (the owner's withdrawal, a bank deposit), now.
export default function CashMovementFormScreen({ navigation }: ScreenProps<'CashMovementFormScreen'>): React.JSX.Element {
  const { selectedLang } = useLang();
  const queryClient = useQueryClient();
  const [type, setType] = useState<number>(MOVEMENT_WITHDRAWAL);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const save = useMutation({
    mutationFn: () => storeMovement({ type, amount: millimesFromInput(amount)!, note: note.trim() || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashbook'] });
      navigation.goBack();
    },
    onError: (error) => alertRequestError(selectedLang, error),
  });

  return (
    <FormScreen>
          <ChipsField label='cash:movement:type' value={type} onChange={setType} options={MOVEMENT_TYPES.map(value => ({ label: 'cash:movement:' + value, value }))} />
          <TextField label='payment:amount' value={amount} onChange={setAmount} keyboardType='decimal-pad' />
          <TextField label='contract:note' value={note} onChange={setNote} />
          <Button
            label='common:save'
            onPress={() => millimesFromInput(amount) ? save.mutate() : alertMessage(selectedLang, 'payment:amount:invalid')}
            isLoading={save.isPending}
            icon='check'
          />
        </FormScreen>
  );
}
