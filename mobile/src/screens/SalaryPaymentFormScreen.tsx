import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MONEY_QUERIES, paySalary } from '../api/money';
import Employee, { employeeName, TYPE_SALARY, TYPES } from '../classes/Employee';
import { METHOD_CASH, METHODS } from '../classes/Payment';
import { useLang } from '../store/hooks';
import { alertMessage, alertRequestError } from '../support/alert';
import { millimesFromInput, priceInputFromMillimes } from '../support/money';
import ChipsField from '../components/Form/ChipsField';
import TextField from '../components/Form/TextField';
import TranslatableText from '../components/common/TranslatableText';
import Button from '../components/ui/Button';
import FormScreen from '../components/ui/FormScreen';
import { ScreenProps } from '../navigation/types';

// Pays an employee for this month: a salary, an advance or a bonus, in cash (the cash book) or
// by bank. Opened pre-filled from the employee's page or the Today screen.
export default function SalaryPaymentFormScreen({ route, navigation }: ScreenProps<'SalaryPaymentFormScreen'>): React.JSX.Element {
  const employee: Employee = route.params.employee;
  const { selectedLang } = useLang();
  const queryClient = useQueryClient();
  const [type, setType] = useState<number>(route.params.type ?? TYPE_SALARY);
  const [amount, setAmount] = useState(route.params.amount ? priceInputFromMillimes(route.params.amount) : '');
  const [method, setMethod] = useState<number>(METHOD_CASH);
  const [note, setNote] = useState('');

  const save = useMutation({
    mutationFn: () => paySalary(employee.id, { type: type as 1, amount: millimesFromInput(amount)!, method: method as 1, note: note.trim() || null }),
    onSuccess: () => {
      MONEY_QUERIES.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
      navigation.goBack();
    },
    onError: (error) => alertRequestError(selectedLang, error),
  });

  return (
    <FormScreen>
      <TranslatableText data='payroll:paying' params={{ name: employeeName(employee) }} className='text-title font-semibold text-ink' />
      <ChipsField label='payroll:type' value={type} onChange={setType} options={TYPES.map(value => ({ label: 'payroll:type:' + value + ':short', value }))} />
      <TextField label='payment:amount' value={amount} onChange={setAmount} keyboardType='decimal-pad' />
      <ChipsField label='expense:method' value={method} onChange={setMethod} options={METHODS.map(value => ({ label: 'payment:method:' + value, value }))} />
      <TextField label='contract:note' value={note} onChange={setNote} />
      <Button label='common:save' icon='check' isLoading={save.isPending} onPress={() => millimesFromInput(amount) ? save.mutate() : alertMessage(selectedLang, 'payment:amount:invalid')} />
    </FormScreen>
  );
}
