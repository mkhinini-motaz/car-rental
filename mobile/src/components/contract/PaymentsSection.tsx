import { useState } from 'react';
import { Text, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { destroyPayment, invalidateContractQueries, storePayment } from '../../api/contract';
import Contract, { remainingRent, STATUS_CLOSED } from '../../classes/Contract';
import { METHOD_CASH, METHOD_DEPOSIT, METHODS } from '../../classes/Payment';
import { useIsOwner, useLang } from '../../store/hooks';
import { alertConfirm, alertMessage, alertRequestError, validationErrors } from '../../support/alert';
import { millimesFromInput } from '../../support/money';
import { formatDate, formatMoneyDisplay } from '../../support/utils';
import RadioField from '../Form/RadioField';
import Button from '../ui/Button';
import InfoRow from '../ui/InfoRow';
import ListRow from '../ui/ListRow';
import TextField from '../Form/TextField';
import DateTimeField from '../Form/DateTimeField';
import Card from '../ui/Card';
import TranslatableText from '../common/TranslatableText';
import LangAwareView from '../common/LangAwareView';
import Icon from '../ui/Icon';
import Tappable from '../ui/Tappable';
import { usePdf } from '../../support/pdf';
import { useColors } from '../../store/ThemeContext';

// Rent due, paid and still owed, the payments so far, and a form to record one.
export default function PaymentsSection({ data }: { data: Contract }): React.JSX.Element {
  const COLORS = useColors();
  const { selectedLang } = useLang();
  const isOwner = useIsOwner();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState(METHOD_CASH);
  const [paidAt, setPaidAt] = useState<Date|null>(null); // null: now
  // Ended more than a day ago: maybe a rental from the notebook, paid back then.
  const isPast = data.ends_at < Date.now() / 1000 - 24 * 3600;
  const money = (millimes: number) => formatMoneyDisplay(millimes, selectedLang);
  const openPdf = usePdf(data.id); // a receipt per payment
  const remaining = remainingRent(data);
  const isClosed = data.status === STATUS_CLOSED;

  const add = useMutation({
    mutationFn: () => storePayment(data.id, { amount: millimesFromInput(amount)!, method: method as 1, ...(paidAt ? { paid_at: Math.floor(paidAt.getTime() / 1000) } : {}) }),
    onSuccess: () => {
      setAmount('');
      setPaidAt(null);
      invalidateContractQueries(queryClient);
    },
    onError: (error) => validationErrors(error).amount?.includes('payment:deposit:unavailable') ?
      alertMessage(selectedLang, 'payment:deposit:unavailable') :
      alertRequestError(selectedLang, error),
  });
  const remove = useMutation({
    mutationFn: (paymentId: number) => destroyPayment(data.id, paymentId),
    onSuccess: () => invalidateContractQueries(queryClient),
    onError: (error) => alertRequestError(selectedLang, error),
  });

  return (
    <Card>
      <TranslatableText data='payment:label' className='text-title font-semibold text-ink' />
      <InfoRow label='payment:due:label' value={money(data.total_price)} />
      <InfoRow label='payment:paid:label' value={money(data.paid ?? 0)} tone='ok' />
      {remaining > 0 && <InfoRow label='payment:remaining:label' value={money(remaining)} tone='danger' bold />}

      {!! data.payments?.length && <View className='border border-line rounded-lg overflow-hidden'>
        {data.payments.map(payment => <ListRow
          key={payment.id}
          icon={payment.method === METHOD_CASH ? 'cash' : 'credit-card-outline'}
          title={<TranslatableText data={'payment:method:' + payment.method} className='text-body text-ink' />}
          subtitle={formatDate(payment.paid_at)}
          meta={<LangAwareView style={{ alignItems: 'center', gap: 12 }}>
            <Text className='text-body font-semibold text-ink'>{money(payment.amount)}</Text>
            <Tappable onPress={() => openPdf('receipt', { paymentId: payment.id })}><Icon name='receipt-text-outline' size={22} color={COLORS.primary} /></Tappable>
          </LangAwareView>}
          onPress={! isClosed && isOwner ? () => alertConfirm(selectedLang, 'payment:delete:confirm', () => remove.mutate(payment.id)) : undefined}
          chevron={false}
        />)}
      </View>}

      {! isClosed && <>
        <TextField label='payment:amount' value={amount} onChange={setAmount} keyboardType='decimal-pad' />
        <RadioField
          label='payment:method'
          value={method}
          onChange={setMethod}
          // The deposit held can pay the rest (return charges, a late return).
          options={[ ...METHODS, ...((data.deposit_available ?? 0) > 0 ? [ METHOD_DEPOSIT ] : []) ].map(value => ({ label: 'payment:method:' + value, value }))}
        />
        {isPast && <DateTimeField label='payment:paid_at' value={paidAt ?? new Date()} onChange={setPaidAt} maxDate={new Date()} minuteInterval={5} />}
        <Button
          label='payment:add'
          variant='secondary'
          isLoading={add.isPending}
          onPress={() => millimesFromInput(amount) ? add.mutate() : alertMessage(selectedLang, 'payment:amount:invalid')}
          icon='cash-plus'
        />
      </>}
    </Card>
  );
}
