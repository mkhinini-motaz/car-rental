import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Button, Checkbox, FormControlLabel, IconButton, Stack, TextField, Typography } from '@mui/material';
import DeleteOutline from '@mui/icons-material/DeleteOutlined';
import Payments from '@mui/icons-material/Payments';
import TaskAlt from '@mui/icons-material/TaskAlt';
import WhatsApp from '@mui/icons-material/WhatsApp';
import Description from '@mui/icons-material/DescriptionOutlined';
import ReceiptLong from '@mui/icons-material/ReceiptLongOutlined';
import Share from '@mui/icons-material/Share';
import { useAgency } from '../api/agency';
import { checkinLink, close, destroyPayment, invalidateContractQueries, markCleaned, sign, storePayment, update } from '../api/contract';
import { staffName } from '../classes/Agency';
import Activity from '../classes/Activity';
import Contract, { Extra, remainingRent, STATUS_CLOSED, STATUS_RESERVED, STATUS_RETURNED } from '../classes/Contract';
import { METHOD_CASH, METHOD_DEPOSIT, METHODS } from '../classes/Payment';
import { useIsOwner, useLang, useT } from '../store/Store';
import { validationErrors } from '../support/alert';
import { millimesFromInput } from '../support/money';
import { arrow, formatDate, formatDateTime } from '../support/utils';
import { messagesFor, messageText, whatsappUrl } from '../support/whatsapp';
import { openPdf, pdfLang, sharePdf } from '../support/pdf';
import { SignatureField } from './signature';
import { useFeedback } from './Feedback';
import { Choice, DateTimeInput, Section, useMoney } from './common';

const HOUR = 60 * 60;

// What happened at pickup and return: times, odometer, deposit, lateness, charges.
export function HandoverSummary({ data }: { data: Contract }) {
  const t = useT();
  const money = useMoney();
  if (! data.picked_up_at) {
    return null;
  }
  const lateUntil = data.returned_at ?? Math.floor(Date.now() / 1000);
  const lateHours = Math.ceil((lateUntil - data.ends_at) / HOUR);

  return (
    <Section>
      {/* A rental from the notebook may have no odometer readings. */}
      <Typography>{t(data.pickup_mileage === null ? 'handover:picked_up:no_km' : 'handover:picked_up', { date: formatDateTime(data.picked_up_at), km: data.pickup_mileage })}</Typography>
      {data.deposit > 0 && <Typography>{t('deposit:taken', { amount: money(data.deposit), method: t('payment:method:' + data.deposit_method) })}</Typography>}
      {data.returned_at && <>
        <Typography>{t(data.return_mileage === null ? 'handover:returned:no_km' : 'handover:returned', { date: formatDateTime(data.returned_at), km: data.return_mileage })}</Typography>
        {data.pickup_mileage !== null && data.return_mileage !== null && <Typography sx={{ fontWeight: 600 }}>{t('handover:driven', { km: data.return_mileage - data.pickup_mileage })}</Typography>}
      </>}
      {lateHours > 0 && <Typography color='error' sx={{ fontWeight: 700 }}>{t('handover:late', { hours: lateHours })}</Typography>}
      {data.charges.map(charge =>
        <Typography key={charge.type} color='error' sx={{ fontWeight: 600 }}>
          {t('charge:' + charge.type + (charge.unit ? ':' + charge.unit : ''), { quantity: charge.quantity, amount: money(charge.amount) })}
        </Typography>
      )}
      {(data.fines_from_deposit ?? 0) > 0 && <Typography>{t('deposit:fines', { amount: money(data.fines_from_deposit!) })}</Typography>}
      {data.status === STATUS_CLOSED && data.deposit > 0 && <>
        {data.deposit_kept > 0 && <Typography>{t('deposit:kept', { amount: money(data.deposit_kept), reason: data.deposit_kept_reason })}</Typography>}
        <Typography>{t('deposit:returned', { amount: money(data.deposit_returned ?? 0) })}</Typography>
      </>}
    </Section>
  );
}

// Who hands the car over and who takes it back (and cleans it): saved on click, and pushed to their
// phone. After the return, the tick that the car is clean.
export function TasksSection({ data }: { data: Contract }) {
  const t = useT();
  const queryClient = useQueryClient();
  const { requestError } = useFeedback();
  const { data: agency } = useAgency();
  const onSuccess = () => invalidateContractQueries(queryClient);
  const assign = useMutation({ mutationFn: (change: Partial<Pick<Contract, 'pickup_user_id' | 'return_user_id'>>) => update(data.id, change), onSuccess, onError: requestError });
  const clean = useMutation({ mutationFn: (cleaned: boolean) => markCleaned(data.id, cleaned), onSuccess, onError: requestError });
  // A branch manager only works on their branch's cars.
  const staff = (agency?.staff ?? []).filter(user => ! user.branch_id || user.branch_id === data.car?.branch_id);
  const options = [ { label: 'task:nobody', value: null as number|null }, ...staff.map(user => ({ label: staffName(user), value: user.id as number|null, raw: true })) ];

  return (
    <Section>
      {data.status === STATUS_RESERVED && <Choice label='task:pickup_user' value={data.pickup_user_id} options={options} onChange={pickup_user_id => assign.mutate({ pickup_user_id })} />}
      {data.status !== STATUS_CLOSED && <Choice label='task:return_user' value={data.return_user_id} options={options} onChange={return_user_id => assign.mutate({ return_user_id })} />}
      {(data.status === STATUS_RETURNED || data.status === STATUS_CLOSED) &&
        <FormControlLabel control={<Checkbox checked={!! data.cleaned_at} disabled={clean.isPending} onChange={event => clean.mutate(event.target.checked)} />} label={t('task:cleaned')} />}
    </Section>
  );
}

// Settles a returned contract: how much of the deposit is kept, and why (the owner only;
// managers give it all back).
export function CloseSection({ data }: { data: Contract }) {
  const t = useT();
  const money = useMoney();
  const isOwner = useIsOwner();
  const queryClient = useQueryClient();
  const { notify, confirm, requestError } = useFeedback();
  const [kept, setKept] = useState('');
  const [reason, setReason] = useState('');
  const keptMillimes = kept.trim() ? millimesFromInput(kept) : 0;
  const available = data.deposit_available ?? 0; // fines and charges may already have come out of it

  const closeContract = useMutation({
    mutationFn: () => close(data.id, { deposit_kept: keptMillimes ?? 0, deposit_kept_reason: reason.trim() || null }),
    onSuccess: () => {
      invalidateContractQueries(queryClient);
      notify('contract:closed', 'success');
    },
    onError: (error) => validationErrors(error).payments ? notify('contract:unpaid', 'error') : requestError(error),
  });

  const onClose = async () => {
    if (keptMillimes === null || keptMillimes > available) {
      notify('deposit:kept:invalid', 'error');
      return;
    }
    if (keptMillimes > 0 && ! reason.trim()) {
      notify('deposit:reason:required', 'error');
      return;
    }
    if (await confirm('contract:close:confirm')) {
      closeContract.mutate();
    }
  };

  return (
    <Section title='contract:close'>
      {available > 0 && <>
        {isOwner && <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
          <TextField label={t('deposit:kept:amount')} value={kept} onChange={event => setKept(event.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
          <TextField label={t('deposit:kept:reason')} value={reason} onChange={event => setReason(event.target.value)} />
        </Stack>}
        <Typography sx={{ fontWeight: 600 }}>{t('deposit:returned', { amount: money(available - (keptMillimes ?? 0)) })}</Typography>
      </>}
      <Box><Button variant='contained' startIcon={<TaskAlt />} onClick={onClose} loading={closeContract.isPending}>{t('contract:close')}</Button></Box>
    </Section>
  );
}

// Rent due, paid and still owed, the payments so far, and a form to record one.
export function PaymentsSection({ data }: { data: Contract }) {
  const t = useT();
  const money = useMoney();
  const isOwner = useIsOwner();
  const queryClient = useQueryClient();
  const { notify, confirm, requestError } = useFeedback();
  const { selectedLang } = useLang(); // receipts come in its paper language
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<number>(METHOD_CASH);
  const [paidAt, setPaidAt] = useState<Date|null>(null); // null: now
  // Ended more than a day ago: maybe a rental from the notebook, paid back then.
  const isPast = data.ends_at < Date.now() / 1000 - 24 * 3600;
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
      notify('payment:deposit:unavailable', 'error') :
      requestError(error),
  });
  const remove = useMutation({
    mutationFn: (paymentId: number) => destroyPayment(data.id, paymentId),
    onSuccess: () => invalidateContractQueries(queryClient),
    onError: requestError,
  });

  return (
    <Section title='payment:label'>
      <Typography>{t('payment:due', { amount: money(data.total_price) })}</Typography>
      <Typography color='success'>{t('payment:paid', { amount: money(data.paid ?? 0) })}</Typography>
      {remaining > 0 && <Typography color='error' sx={{ fontWeight: 700 }}>{t('payment:remaining:value', { amount: money(remaining) })}</Typography>}

      {data.payments?.map(payment =>
        <Stack key={payment.id} direction='row' sx={{ gap: 2, alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider', py: 0.5 }}>
          <Typography>{formatDate(payment.paid_at)}</Typography>
          <Typography sx={{ fontWeight: 600 }}>{money(payment.amount)}</Typography>
          <Typography sx={{ flex: 1 }}>{t('payment:method:' + payment.method)}</Typography>
          <IconButton size='small' color='primary' aria-label={t('papers:receipt')} onClick={() => openPdf(data.id, 'receipt', pdfLang(selectedLang), payment.id).catch(requestError)}>
            <ReceiptLong fontSize='small' />
          </IconButton>
          {! isClosed && isOwner && <IconButton size='small' color='error' aria-label={t('common:delete')} onClick={async () => await confirm('payment:delete:confirm') && remove.mutate(payment.id)}>
            <DeleteOutline fontSize='small' />
          </IconButton>}
        </Stack>
      )}

      {! isClosed && <Stack sx={{ gap: 2, mt: 1 }}>
        <TextField label={t('payment:amount')} value={amount} onChange={event => setAmount(event.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} sx={{ maxWidth: 240 }} />
        <Choice
          label='payment:method'
          value={method}
          onChange={setMethod}
          // The deposit held can pay the rest (return charges, a late return).
          options={[ ...METHODS, ...((data.deposit_available ?? 0) > 0 ? [ METHOD_DEPOSIT ] : []) ].map(value => ({ label: 'payment:method:' + value, value }))}
        />
        {isPast && <Box sx={{ maxWidth: 280 }}><DateTimeInput label='payment:paid_at' value={paidAt ?? new Date()} onChange={setPaidAt} step={5} /></Box>}
        <Box>
          <Button variant='outlined' startIcon={<Payments />} loading={add.isPending} onClick={() => millimesFromInput(amount) ? add.mutate() : notify('payment:amount:invalid', 'error')}>
            {t('payment:add')}
          </Button>
        </Box>
      </Stack>}
    </Section>
  );
}

const MONEY_FIELDS = [ 'daily_price', 'deposit', 'deposit_kept', 'amount', 'charges', 'commission' ];
const TIME_FIELDS = [ 'starts_at', 'ends_at' ];

// Who did what to the contract and its payments, newest first.
export function ActivityLog({ activities }: { activities?: Activity[] }) {
  const t = useT();
  const { isRtl } = useLang();
  const money = useMoney();
  if (! activities?.length) {
    return null;
  }

  const format = (field: string, value: any): string => {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    if (MONEY_FIELDS.includes(field)) {
      return money(value);
    }
    if (TIME_FIELDS.includes(field)) {
      return formatDateTime(value);
    }
    if (field === 'method') {
      return t('payment:method:' + value);
    }
    if (field === 'role') {
      return t('staff:role:' + value);
    }
    if (field === 'source') {
      return t('contract:source:' + value);
    }
    if (field === 'extras') {
      return (value as Extra[]).map(extra => extra.name).join(', ') || '—';
    }
    return field === 'mileage' ? value + ' km' : String(value);
  };
  const label = (field: string) => t('activity:field:' + field);
  const details = (activity: Activity): string[] => Object.entries(activity.changes ?? {})
    .filter(([ field, value ]) => ! (field === 'charges' && ! value) && ! (field === 'deposit_kept' && ! value) && field !== 'deposit_kept_reason')
    .map(([ field, value ]) => activity.action === 'updated' ?
      label(field) + ' : ' + format(field, value[0]) + arrow(isRtl) + format(field, value[1]) :
      label(field) + ' : ' + format(field, value) + (field === 'deposit_kept' && activity.changes?.deposit_kept_reason ? ' (' + activity.changes.deposit_kept_reason + ')' : ''));

  return (
    <Section title='activity:label'>
      {activities.map(activity =>
        <Box key={activity.id} sx={{ borderLeft: '3px solid', borderColor: 'divider', pl: 1.5 }}>
          <Typography variant='body2' sx={{ fontWeight: 600 }}>
            {t('activity:by', { action: t('activity:' + activity.action), user: activity.user ? activity.user.first_name + ' ' + activity.user.last_name : '—', date: formatDateTime(activity.created_at) })}
          </Typography>
          {details(activity).map((line, index) => <Typography key={index} variant='body2' color='text.secondary'>{line}</Typography>)}
        </Box>
      )}
    </Section>
  );
}

// The booking confirmation, the check-in link and the pickup or return reminder, ready to send from WhatsApp.
export function WhatsAppSection({ data }: { data: Contract }) {
  const t = useT();
  const money = useMoney();
  const { requestError } = useFeedback();
  const { data: agency } = useAgency();
  const kinds = messagesFor(data);
  if (! data.client || ! kinds.length) {
    return null;
  }
  // The check-in link is made on click; the WhatsApp tab opens at once or the browser blocks it.
  const sendCheckin = () => {
    const tab = window.open('', '_blank');
    checkinLink(data.id)
      .then(link => {
        const url = whatsappUrl(data.client!.phone, messageText('checkin', data, agency, t, money, link));
        tab ? tab.location.href = url : window.location.href = url;
      })
      .catch(error => {
        tab?.close();
        requestError(error);
      });
  };

  return (
    <Section title='whatsapp:title'>
      <Stack direction='row' sx={{ gap: 1, flexWrap: 'wrap' }}>
        {kinds.map(kind => kind === 'checkin' ?
          <Button key={kind} variant='outlined' startIcon={<WhatsApp />} onClick={sendCheckin}>{t('whatsapp:send:' + kind)}</Button> :
          <Button key={kind} variant='outlined' startIcon={<WhatsApp />} href={whatsappUrl(data.client!.phone, messageText(kind, data, agency, t, money))} target='_blank' rel='noopener'>
            {t('whatsapp:send:' + kind)}
          </Button>)}
      </Stack>
    </Section>
  );
}

// The contract and its invoice as PDF, in French or Arabic (open to print, or send the link to the
// client), and the client's signature when it wasn't taken at pickup.
export function PapersSection({ data }: { data: Contract }) {
  const t = useT();
  const { selectedLang } = useLang();
  const queryClient = useQueryClient();
  const { notify, requestError } = useFeedback();
  const [lang, setLang] = useState<'fr'|'ar'>(pdfLang(selectedLang));
  const signContract = useMutation({
    mutationFn: (signature: string) => sign(data.id, signature),
    onSuccess: () => invalidateContractQueries(queryClient),
    onError: requestError,
  });
  const open = (kind: 'contract'|'invoice') => openPdf(data.id, kind, lang)
    .then(() => kind === 'invoice' && invalidateContractQueries(queryClient)) // it has a number now
    .catch(requestError);
  const share = (kind: 'contract'|'invoice') => sharePdf(data.id, kind, lang)
    .then(result => result === 'copied' && notify('papers:copied', 'success'))
    .catch(requestError);

  return (
    <Section title='papers:title'>
      <Choice value={lang} onChange={setLang} options={[ { label: 'papers:lang:fr', value: 'fr' as const }, { label: 'papers:lang:ar', value: 'ar' as const } ]} />
      {([ 'contract', 'invoice' ] as const).map(kind =>
        <Stack key={kind} direction='row' sx={{ gap: 1, alignItems: 'center' }}>
          <Button startIcon={kind === 'contract' ? <Description /> : <ReceiptLong />} onClick={() => open(kind)}>{t('papers:' + kind)}</Button>
          {kind === 'invoice' && data.invoice_number && <Typography color='text.secondary'>{data.invoice_number}</Typography>}
          <IconButton color='primary' onClick={() => share(kind)} aria-label={t('papers:share')}><Share /></IconButton>
        </Stack>
      )}
      {data.status !== STATUS_CLOSED && <SignatureField value={data.signature} onChange={signature => signContract.mutate(signature)} />}
    </Section>
  );
}
