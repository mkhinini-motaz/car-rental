import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItemButton, ListItemText, Stack, TextField, Typography } from '@mui/material';
import Add from '@mui/icons-material/Add';
import { bills, branches, destroyBill, saveBill } from '../src/api/money';
import { RecurringBill } from '../src/classes/Branch';
import { AGENCY_CATEGORIES, CATEGORY_RENT } from '../src/classes/Expense';
import { COLORS } from '../src/constants';
import { useT } from '../src/store/Store';
import { millimesFromInput, priceInputFromMillimes } from '../src/support/money';
import { formatDate } from '../src/support/utils';
import { useFeedback } from '../src/components/Feedback';
import { Choice, DateInput, Empty, Loading, Page, useMoney } from '../src/components/common';

const EVERY = [ 1, 2, 3, 6, 12 ];

// Adds a recurring bill, or edits or removes `bill`.
function BillDialog({ bill, onClose }: { bill: RecurringBill|null, onClose: () => void }) {
  const t = useT();
  const queryClient = useQueryClient();
  const { notify, confirm, requestError } = useFeedback();
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
    onClose();
  };
  const save = useMutation({
    mutationFn: () => {
      const day = nextDueAt!;
      return saveBill({
        category, amount: millimesFromInput(amount)!, every_months: every, note: note.trim() || null, branch_id: branchId || null,
        next_due_at: Math.floor(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9).getTime() / 1000),
      }, bill?.id);
    },
    onSuccess,
    onError: requestError,
  });
  const remove = useMutation({ mutationFn: () => destroyBill(bill!.id), onSuccess, onError: requestError });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth='sm'>
      <DialogTitle>{t('bill:label')}</DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 2.5, pt: 1 }}>
          <Choice label='expense:category' value={category} onChange={setCategory} options={AGENCY_CATEGORIES.map(value => ({ label: 'expense:category:' + value, value }))} />
          <TextField label={t('payment:amount')} value={amount} onChange={event => setAmount(event.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
          <Choice label='bill:every_label' value={every} onChange={setEvery} options={EVERY.map(value => ({ label: 'bill:every:' + value, value }))} />
          <DateInput label='bill:next_label' value={nextDueAt} onChange={setNextDueAt} />
          {!! branchList?.length && <Choice
            label='expense:branch'
            value={branchId}
            onChange={setBranchId}
            options={[ { label: 'expense:branch:none', value: 0 }, ...branchList.map(branch => ({ label: branch.name, value: branch.id, raw: true })) ]}
          />}
          <TextField label={t('contract:note')} value={note} onChange={event => setNote(event.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        {bill && <Button color='error' loading={remove.isPending} onClick={async () => await confirm('bill:delete:confirm') && remove.mutate()} sx={{ mr: 'auto' }}>{t('bill:delete')}</Button>}
        <Button onClick={onClose}>{t('common:cancel')}</Button>
        <Button variant='contained' loading={save.isPending} onClick={() => millimesFromInput(amount) && nextDueAt ? save.mutate() : notify('payment:amount:invalid', 'error')}>{t('common:save')}</Button>
      </DialogActions>
    </Dialog>
  );
}

// Bills that come back (owner): the Today page shows them a week before they are due.
export default function BillsPage() {
  const t = useT();
  const money = useMoney();
  const [editing, setEditing] = useState<RecurringBill|null|undefined>(undefined); // null: a new one
  const { isLoading, data } = useQuery({ queryKey: ['bill.index'], queryFn: bills });
  const soon = Date.now() / 1000 + 7 * 24 * 3600;

  return (
    <Page title='bill:label' actions={<Button variant='contained' startIcon={<Add />} onClick={() => setEditing(null)}>{t('bill:add')}</Button>}>
      <Typography color='text.secondary' sx={{ mb: 2 }}>{t('bill:hint')}</Typography>
      {isLoading ? <Loading /> : ! data?.length ? <Empty text='bill:none' /> :
        <Card>
          <List disablePadding>
            {data.map(bill =>
              <ListItemButton key={bill.id} divider onClick={() => setEditing(bill)}>
                <ListItemText
                  primary={t('expense:category:' + bill.category)}
                  secondary={[ t('bill:next', { date: formatDate(bill.next_due_at) }), t('bill:every', { months: bill.every_months }), bill.branch?.name, bill.note ].filter(Boolean).join(' · ')}
                  slotProps={{ secondary: { sx: { color: bill.next_due_at < soon ? COLORS.warn : undefined } } }}
                />
                <Typography sx={{ fontWeight: 700 }}>{money(bill.amount)}</Typography>
              </ListItemButton>
            )}
          </List>
        </Card>
      }
      {editing !== undefined && <BillDialog bill={editing} onClose={() => setEditing(undefined)} />}
    </Page>
  );
}
