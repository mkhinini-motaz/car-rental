import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { branches, destroyBill, saveBill } from '../api/money';
import { RecurringBill } from '../classes/Branch';
import { AGENCY_CATEGORIES, CATEGORY_RENT } from '../classes/Expense';
import { useLang } from '../store/hooks';
import { alertConfirm, alertMessage, alertRequestError } from '../support/alert';
import { millimesFromInput, priceInputFromMillimes } from '../support/money';
import ChipsField from '../components/Form/ChipsField';
import DateField from '../components/Form/DateField';
import TextField from '../components/Form/TextField';
import Button from '../components/ui/Button';
import FormScreen from '../components/ui/FormScreen';
import { ScreenProps } from '../navigation/types';

const EVERY = [ 1, 2, 3, 6, 12 ];

// Adds a recurring bill, or edits or removes the one passed as `bill`.
export default function BillFormScreen({ route, navigation }: ScreenProps<'BillFormScreen'>): React.JSX.Element {
  const bill: RecurringBill|undefined = route.params?.bill;
  const { selectedLang } = useLang();
  const queryClient = useQueryClient();
  const { data: branchList } = useQuery({ queryKey: ['branch.index'], queryFn: branches });
  const [category, setCategory] = useState<number>(bill?.category ?? CATEGORY_RENT);
  const [amount, setAmount] = useState(bill ? priceInputFromMillimes(bill.amount) : '');
  const [every, setEvery] = useState<number>(bill?.every_months ?? 1);
  const [nextDueAt, setNextDueAt] = useState<Date|null>(bill ? new Date(bill.next_due_at * 1000) : new Date());
  const [branchId, setBranchId] = useState<number>(bill?.branch_id ?? 0);
  const [note, setNote] = useState(bill?.note ?? '');
  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['bill.index'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    navigation.goBack();
  };
  const onError = (error: any) => alertRequestError(selectedLang, error);
  const save = useMutation({
    mutationFn: () => {
      const day = nextDueAt!;
      return saveBill({
        category, amount: millimesFromInput(amount)!, every_months: every, note: note.trim() || null, branch_id: branchId || null,
        next_due_at: Math.floor(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9).getTime() / 1000),
      }, bill?.id);
    },
    onSuccess,
    onError,
  });
  const remove = useMutation({ mutationFn: () => destroyBill(bill!.id), onSuccess, onError });

  return (
    <FormScreen>
      <ChipsField label='expense:category' value={category} onChange={setCategory} options={AGENCY_CATEGORIES.map(value => ({ label: 'expense:category:' + value, value }))} />
      <TextField label='payment:amount' value={amount} onChange={setAmount} keyboardType='decimal-pad' />
      <ChipsField label='bill:every_label' value={every} onChange={setEvery} options={EVERY.map(value => ({ label: 'bill:every:' + value, value }))} />
      <DateField label='bill:next_label' value={nextDueAt} onChange={setNextDueAt} />
      {!! branchList?.length && <ChipsField
        label='expense:branch'
        value={branchId}
        onChange={setBranchId}
        options={[ { label: 'expense:branch:none', value: 0 }, ...branchList.map(branch => ({ label: branch.name, value: branch.id })) ]}
      />}
      <TextField label='contract:note' value={note} onChange={setNote} />
      <Button label='common:save' icon='check' isLoading={save.isPending} onPress={() => millimesFromInput(amount) && nextDueAt ? save.mutate() : alertMessage(selectedLang, 'payment:amount:invalid')} />
      {bill && <Button label='bill:delete' variant='danger' icon='delete-outline' isLoading={remove.isPending} onPress={() => alertConfirm(selectedLang, 'bill:delete:confirm', () => remove.mutate())} />}
    </FormScreen>
  );
}
