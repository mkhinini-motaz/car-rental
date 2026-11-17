import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { destroyBranch, saveBranch } from '../api/money';
import Branch from '../classes/Branch';
import { useLang } from '../store/hooks';
import { alertConfirm, alertMessage, alertRequestError } from '../support/alert';
import { millimesFromInput, priceInputFromMillimes } from '../support/money';
import TextField from '../components/Form/TextField';
import Button from '../components/ui/Button';
import FormScreen from '../components/ui/FormScreen';
import { ScreenProps } from '../navigation/types';

// Adds a branch, or edits or removes the one passed as `branch`.
export default function BranchFormScreen({ route, navigation }: ScreenProps<'BranchFormScreen'>): React.JSX.Element {
  const branch: Branch|undefined = route.params?.branch;
  const { selectedLang } = useLang();
  const queryClient = useQueryClient();
  const [name, setName] = useState(branch?.name ?? '');
  const [address, setAddress] = useState(branch?.address ?? '');
  const [rent, setRent] = useState(branch?.monthly_rent ? priceInputFromMillimes(branch.monthly_rent) : '');
  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['branch.index'] });
    navigation.goBack();
  };
  const onError = (error: any) => alertRequestError(selectedLang, error);
  const save = useMutation({ mutationFn: () => saveBranch({ name: name.trim(), address: address.trim() || null, monthly_rent: millimesFromInput(rent) ?? 0 }, branch?.id), onSuccess, onError });
  const remove = useMutation({ mutationFn: () => destroyBranch(branch!.id), onSuccess, onError });

  return (
    <FormScreen>
      <TextField label='branch:name' value={name} onChange={setName} />
      <TextField label='form:address:label' value={address} onChange={setAddress} />
      <TextField label='branch:rent' value={rent} onChange={setRent} keyboardType='decimal-pad' />
      <Button label='common:save' icon='check' isLoading={save.isPending} onPress={() => name.trim() ? save.mutate() : alertMessage(selectedLang, 'branch:invalid')} />
      {branch && <Button label='branch:delete' variant='danger' icon='delete-outline' isLoading={remove.isPending} onPress={() => alertConfirm(selectedLang, 'branch:delete:confirm', () => remove.mutate())} />}
    </FormScreen>
  );
}
