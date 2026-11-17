import { TouchableOpacity } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAgency } from '../../api/agency';
import { invalidateContractQueries, markCleaned, update } from '../../api/contract';
import { staffName } from '../../classes/Agency';
import Contract, { STATUS_CLOSED, STATUS_RESERVED, STATUS_RETURNED } from '../../classes/Contract';
import { useLang } from '../../store/hooks';
import { alertRequestError } from '../../support/alert';
import ChipsField from '../Form/ChipsField';
import LangAwareView from '../common/LangAwareView';
import TranslatableText from '../common/TranslatableText';
import Card from '../ui/Card';
import Icon from '../ui/Icon';
import { useColors } from '../../store/ThemeContext';

// Who hands the car over and who takes it back (and cleans it): saved on tap, and pushed to them.
// After the return, the tick that the car is clean.
export default function TasksSection({ data }: { data: Contract }): React.JSX.Element {
  const COLORS = useColors();
  const { selectedLang } = useLang();
  const queryClient = useQueryClient();
  const { data: agency } = useAgency();
  const onSuccess = () => invalidateContractQueries(queryClient);
  const onError = (error: Error) => alertRequestError(selectedLang, error);
  const assign = useMutation({ mutationFn: (change: Partial<Pick<Contract, 'pickup_user_id' | 'return_user_id'>>) => update(data.id, change), onSuccess, onError });
  const clean = useMutation({ mutationFn: (cleaned: boolean) => markCleaned(data.id, cleaned), onSuccess, onError });

  const isBack = data.status === STATUS_RETURNED || data.status === STATUS_CLOSED;
  // A branch manager only works on their branch's cars.
  const staff = (agency?.staff ?? []).filter(user => ! user.branch_id || user.branch_id === data.car?.branch_id);
  const options = [ { label: 'task:nobody', value: null as number|null }, ...staff.map(user => ({ label: staffName(user), value: user.id as number|null })) ];

  return (
    <Card>
      {data.status === STATUS_RESERVED &&
        <ChipsField label='task:pickup_user' value={data.pickup_user_id} options={options} onChange={pickup_user_id => assign.mutate({ pickup_user_id })} />}
      {data.status !== STATUS_CLOSED &&
        <ChipsField label='task:return_user' value={data.return_user_id} options={options} onChange={return_user_id => assign.mutate({ return_user_id })} />}
      {isBack && <TouchableOpacity disabled={clean.isPending} onPress={() => clean.mutate(! data.cleaned_at)}>
        <LangAwareView className='gap-x-2 items-center'>
          <Icon name={data.cleaned_at ? 'checkbox-marked' : 'checkbox-blank-outline'} size={24} color={COLORS.primary} />
          <TranslatableText data='task:cleaned' className='text-body text-ink flex-1' />
        </LangAwareView>
      </TouchableOpacity>}
    </Card>
  );
}
