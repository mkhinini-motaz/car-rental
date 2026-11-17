import { useState } from 'react';
import { View } from 'react-native';
import KeyboardScroll from '../components/ui/KeyboardScroll';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateContractQueries } from '../api/contract';
import { destroy, payOut, setClient, settle, show, undoPayOut } from '../api/fine';
import { STATUS_CLOSED, STATUS_OUT, STATUS_RETURNED } from '../classes/Contract';
import Fine, { STATUS_FROM_DEPOSIT, STATUS_PAID_BY_AGENCY, STATUS_PAID_BY_CLIENT, STATUS_UNPAID } from '../classes/Fine';
import { METHOD_CASH, METHODS } from '../classes/Payment';
import { translate } from '../i18n';
import { useIsOwner, useLang, useNetworkErrorAlert } from '../store/hooks';
import { alertConfirm, alertMessage, alertRequestError, validationErrors } from '../support/alert';
import { formatDateTime } from '../support/utils';
import ChipsField from '../components/Form/ChipsField';
import FullScreenLoader from '../components/common/FullScreenLoader';
import Card from '../components/ui/Card';
import TranslatableText from '../components/common/TranslatableText';
import Button from '../components/ui/Button';
import ErrorState from '../components/ui/ErrorState';
import { IconName } from '../components/ui/Icon';
import Screen from '../components/ui/Screen';
import ContractRow from '../components/contract/ContractRow';
import FineRow from '../components/fine/FineRow';
import ClientPicker from '../components/client/ClientPicker';
import { ScreenProps } from '../navigation/types';

const DIRECT = 0; // the client paid the authority, no money through the agency

// A fine, the rental it was matched to, and its two sides: the agency paying the authority, and
// the client paying (the agency back, or the authority directly).
export default function FineScreen({ route, navigation }: ScreenProps<'FineScreen'>): React.JSX.Element {
  const { fineId } = route.params;
  const { selectedLang } = useLang();
  const isOwner = useIsOwner();
  const queryClient = useQueryClient();
  const { isLoading, error, data } = useQuery({ queryKey: ['fine.show', { id: fineId }], queryFn: show });
  useNetworkErrorAlert(error);

  const onError = (requestError: any) => {
    const message = validationErrors(requestError).status?.[0];
    message ? alertMessage(selectedLang, message) : alertRequestError(selectedLang, requestError);
  };
  const [method, setMethod] = useState<number>(METHOD_CASH); // how the client paid
  const [payoutMethod, setPayoutMethod] = useState<number>(METHOD_CASH); // how the agency paid the authority
  const mutation = (mutationFn: (value?: number) => Promise<Fine>) => ({
    mutationFn,
    onSuccess: () => invalidateContractQueries(queryClient), // also refreshes fines, the cash book, the report and deposits
    onError,
  });
  const update = useMutation(mutation((status?: number) => settle(fineId, status!, method === DIRECT ? null : method, payoutMethod)));
  const payout = useMutation(mutation(() => payOut(fineId, payoutMethod)));
  const undoPayout = useMutation(mutation(() => undoPayOut(fineId)));
  const renter = useMutation(mutation((clientId?: number) => setClient(fineId, clientId ?? null)));
  const remove = useMutation({
    mutationFn: () => destroy(fineId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['fine.show', { id: fineId }] });
      invalidateContractQueries(queryClient);
      navigation.goBack();
    },
    onError,
  });

  if (isLoading || ! data) {
    return isLoading ? <FullScreenLoader /> : <ErrorState error={error} onRetry={() => queryClient.invalidateQueries({ queryKey: ['fine.show'] })} />;
  }

  const contract = data.contract;
  const depositIsHeld = !! contract && contract.deposit > 0 && [ STATUS_OUT, STATUS_RETURNED ].includes(contract.status);
  const isLocked = data.status === STATUS_FROM_DEPOSIT && contract?.status === STATUS_CLOSED;
  const action = (label: string, status: number, icon: IconName) => data.status !== status && <Button
    key={status}
    label={label}
    variant='secondary'
    isLoading={update.isPending && update.variables === status}
    onPress={() => update.mutate(status)}
    icon={icon}
  />;
  const methodOptions = METHODS.map(value => ({ label: 'payment:method:' + value, value }));

  return (
    <Screen>
      <KeyboardScroll>
        <FineRow data={data} />
        {! data.contract_id && <Card>
          <TranslatableText data='fine:renter' className='text-title font-semibold text-ink' />
          <TranslatableText data='fine:renter:hint' className='text-meta text-muted' />
          <ClientPicker value={data.client ?? null} onChange={client => renter.mutate(client.id)} onClear={data.client ? () => renter.mutate(undefined) : undefined} />
        </Card>}
        {contract && <ContractRow
          data={contract}
          timeLabel='contract:ends_at:value'
          time={contract.ends_at}
          onPress={() => navigation.navigate('ContractScreen', { contractId: contract.id })}
        />}
        {! isLocked && <>
          <Card>
            <TranslatableText data='fine:client_side' className='text-title font-semibold text-ink' />
            <ChipsField label='fine:method' value={method} onChange={setMethod} options={[ ...methodOptions, { label: 'fine:method:direct', value: DIRECT } ]} />
            {action('fine:settle:client', STATUS_PAID_BY_CLIENT, 'account-check-outline')}
            {depositIsHeld && action('fine:settle:deposit', STATUS_FROM_DEPOSIT, 'piggy-bank-outline')}
            {action('fine:settle:agency', STATUS_PAID_BY_AGENCY, 'storefront-outline')}
            {action('fine:settle:unpaid', STATUS_UNPAID, 'undo')}
          </Card>
          <Card>
            <TranslatableText data='fine:payout' className='text-title font-semibold text-ink' />
            {data.paid_out_at ? <>
              <TranslatableText
                data='fine:payout:done'
                params={{ date: formatDateTime(data.paid_out_at), method: translate('payment:method:' + data.paid_out_method, selectedLang) }}
                className='text-body'
              />
              {data.status !== STATUS_PAID_BY_AGENCY && <Button
                label='fine:payout:undo'
                variant='secondary'
                isLoading={undoPayout.isPending}
                onPress={() => undoPayout.mutate(undefined)}
                icon='undo'
              />}
            </> : <>
              <TranslatableText data='fine:payout:hint' className='text-body text-muted' />
              <ChipsField label='fine:payout:method' value={payoutMethod} onChange={setPayoutMethod} options={methodOptions} />
              <Button
                label='fine:payout:record'
                variant='secondary'
                isLoading={payout.isPending}
                onPress={() => payout.mutate(undefined)}
                icon='bank-outline'
              />
            </>}
          </Card>
          {isOwner && <View className='px-3 pb-8'>
            <Button
              label='fine:delete'
              variant='danger'
              isLoading={remove.isPending}
              onPress={() => alertConfirm(selectedLang, 'fine:delete:confirm', () => remove.mutate())}
              icon='delete-outline'
            />
          </View>}
        </>}
      </KeyboardScroll>
    </Screen>
  );
}
