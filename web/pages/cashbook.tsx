import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton, Stack, TextField, Typography } from '@mui/material';
import Add from '@mui/icons-material/Add';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import SwapVert from '@mui/icons-material/SwapVert';
import { CashLine, destroyMovement, MOVEMENT_TYPES, MOVEMENT_WITHDRAWAL, show, storeMovement } from '../src/api/cashbook';
import { index as staff } from '../src/api/user';
import { useT } from '../src/store/Store';
import { millimesFromInput } from '../src/support/money';
import { formatDate, formatTime, plate } from '../src/support/utils';
import { toDateInput } from '../src/support/day';
import { useFeedback } from '../src/components/Feedback';
import ExpenseDialog from '../src/components/ExpenseDialog';
import { bareButton, Choice, Figure, Loading, Page, Section, useMoney } from '../src/components/common';

// Cash put in the till or taken out by hand (the owner's withdrawal, a bank deposit), now.
function MovementDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const queryClient = useQueryClient();
  const { notify, requestError } = useFeedback();
  const [type, setType] = useState<number>(MOVEMENT_WITHDRAWAL);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const save = useMutation({
    mutationFn: () => storeMovement({ type, amount: millimesFromInput(amount)!, note: note.trim() || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashbook'] });
      onClose();
    },
    onError: requestError,
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth='xs'>
      <DialogTitle>{t('cash:movement:add')}</DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 2.5, pt: 1 }}>
          <Choice label='cash:movement:type' value={type} onChange={setType} options={MOVEMENT_TYPES.map(value => ({ label: 'cash:movement:' + value, value }))} />
          <TextField label={t('payment:amount')} value={amount} onChange={event => setAmount(event.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
          <TextField label={t('contract:note')} value={note} onChange={event => setNote(event.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common:cancel')}</Button>
        <Button variant='contained' loading={save.isPending} onClick={() => millimesFromInput(amount) ? save.mutate() : notify('payment:amount:invalid', 'error')}>{t('common:save')}</Button>
      </DialogActions>
    </Dialog>
  );
}

// The till for one day: what came in and went out in cash, and the balance; card, transfer and
// cheque payments are summed apart. Filtered by staff member, it shows what they handled.
export default function CashBookPage() {
  const t = useT();
  const money = useMoney();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { confirm, requestError } = useFeedback();
  const [day, setDay] = useState(() => new Date());
  const [userId, setUserId] = useState<number|null>(null);
  const [dialog, setDialog] = useState<'movement'|'expense'|null>(null);
  const { isLoading, data } = useQuery({ queryKey: [ 'cashbook', { date: toDateInput(day), user_id: userId ?? undefined } ], queryFn: show });
  const { data: users } = useQuery({ queryKey: ['user.index'], queryFn: staff });
  const shift = (days: number) => setDay(new Date(day.getFullYear(), day.getMonth(), day.getDate() + days));

  const remove = useMutation({
    mutationFn: destroyMovement,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cashbook'] }),
    onError: requestError,
  });

  const lineLabel = (line: CashLine) => {
    const kind = line.kind === 'movement' ? 'cash:movement:' + line.type :
      line.kind === 'expense' ? 'expense:category:' + line.category :
      line.kind === 'fine' ? 'cash:fine:client' :
      line.kind === 'fine_payout' ? 'cash:fine:agency' :
      line.kind === 'income' ? 'income:category:' + line.category :
      line.kind === 'salary' ? 'cash:salary:' + line.type :
      'cash:' + line.kind;
    return t(kind) + (line.label ? ' · ' + plate(line.label) : ''); // a plate or a note
  };
  const onLineClick = async (line: CashLine) => {
    if (line.contract_id) {
      router.push('/contracts/' + line.contract_id);
    } else if (line.car_id) {
      router.push('/cars/' + line.car_id);
    } else if (line.kind === 'car_sale') {
      router.push('/cars/' + line.id);
    } else if (line.kind === 'salary') {
      router.push('/payroll/' + line.id);
    } else if (line.kind === 'fine' || line.kind === 'fine_payout') {
      router.push('/fines/' + line.id);
    } else if (line.kind === 'movement' && await confirm('cash:movement:delete:confirm')) {
      remove.mutate(line.id!);
    }
  };

  return (
    <Page title='common:cash_book' actions={<>
      <Button variant='outlined' startIcon={<SwapVert />} onClick={() => setDialog('movement')}>{t('cash:movement:add')}</Button>
      <Button variant='outlined' startIcon={<Add />} onClick={() => setDialog('expense')}>{t('expense:add')}</Button>
    </>}>
      <Stack direction='row' sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        <IconButton aria-label={t('common:previous')} onClick={() => shift(-1)}><ChevronLeft /></IconButton>
        <Button onClick={() => setDay(new Date())} sx={{ fontSize: 18 }}>{formatDate(day.getTime() / 1000)}</Button>
        <IconButton aria-label={t('common:next')} onClick={() => shift(1)}><ChevronRight /></IconButton>
        <Box sx={{ flex: 1 }} />
        <Choice value={userId} onChange={setUserId} options={[ { label: 'cash:everyone', value: null }, ...(users ?? []).map(user => ({ label: user.first_name, value: user.id as number|null, raw: true })) ]} />
      </Stack>

      {isLoading || ! data ? <Loading /> :
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Section>
              {data.opening !== null && <Figure label='cash:opening' amount={data.opening} />}
              <Figure label='cash:in' amount={data.cash_in} color='success.main' />
              <Figure label='cash:out' amount={data.cash_out} color='error.main' />
              {data.closing !== null && <Figure label='cash:closing' amount={data.closing} color='primary.main' />}
              {data.opening === null && <Typography variant='body2' color='text.secondary'>{t('cash:filtered')}</Typography>}
              {new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime() / 1000 <= data.since && <Typography variant='body2' color='warning.main'>{t('cash:since', { date: formatDate(data.since) })}</Typography>}
            </Section>
            {data.payments_by_method.length > 0 && <Section title='cash:payments'>
              {data.payments_by_method.map(item => <Figure key={item.method} label={'payment:method:' + item.method} amount={item.amount} />)}
            </Section>}
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            <Section title='cash:lines'>
              {data.lines.length === 0 && <Typography color='text.secondary'>{t('common:no_data')}</Typography>}
              {data.lines.map((line, index) => {
                const isClickable = !! line.contract_id || !! line.car_id || [ 'movement', 'fine', 'fine_payout', 'car_sale', 'salary' ].includes(line.kind);
                return (
                  <Stack key={index} direction='row' {...(isClickable ? { component: 'button', type: 'button', onClick: () => onLineClick(line) } : {})} sx={{ ...(isClickable ? bareButton : {}), width: '100%', gap: 1.5, alignItems: 'center', py: 0.75, borderBottom: '1px solid', borderColor: 'divider', '&:hover': isClickable ? { bgcolor: 'action.hover' } : {} }}>
                    <Typography variant='body2' color='text.secondary'>{formatTime(line.at)}</Typography>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant='body2'>{lineLabel(line)}</Typography>
                      {line.user && <Typography variant='caption' color='text.secondary'>{line.user.first_name} {line.user.last_name}</Typography>}
                    </Box>
                    <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap' }} color={line.amount < 0 ? 'error' : 'success'}>{(line.amount > 0 ? '+' : '') + money(line.amount)}</Typography>
                  </Stack>
                );
              })}
            </Section>
          </Grid>
        </Grid>
      }
      {dialog === 'movement' && <MovementDialog onClose={() => setDialog(null)} />}
      <ExpenseDialog open={dialog === 'expense'} onClose={() => setDialog(null)} />
    </Page>
  );
}
