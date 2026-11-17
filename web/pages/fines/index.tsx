import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Stack, TextField } from '@mui/material';
import ReceiptLong from '@mui/icons-material/ReceiptLong';
import { index as cars } from '../../src/api/car';
import { index, store } from '../../src/api/fine';
import { useT } from '../../src/store/Store';
import { millimesFromInput } from '../../src/support/money';
import { FineRow } from '../../src/components/fine';
import { useFeedback } from '../../src/components/Feedback';
import { Choice, DateTimeInput, Empty, Loading, Page } from '../../src/components/common';
import { plate } from '../../src/support/utils';

// A fine as written on the PV: the plate, when, how much. The API finds who had the car.
function NewFineDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { notify, requestError } = useFeedback();
  const { data: carList } = useQuery({ queryKey: ['car.index'], queryFn: cars });
  const [carId, setCarId] = useState<number|null>(null);
  const [committedAt, setCommittedAt] = useState(new Date());
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const save = useMutation({
    mutationFn: () => store({
      car_id: carId!,
      committed_at: Math.floor(committedAt.getTime() / 1000),
      amount: millimesFromInput(amount)!,
      reference: reference.trim() || null,
      note: note.trim() || null,
    }),
    onSuccess: (fine) => {
      queryClient.invalidateQueries({ queryKey: ['fine.index'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
      router.push('/fines/' + fine.id);
    },
    onError: requestError,
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth='sm'>
      <DialogTitle>{t('fine:new')}</DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 2.5, pt: 1 }}>
          <Choice label='car:licence_plate' value={carId} onChange={setCarId} options={(carList ?? []).map(car => ({ label: plate(car.licence_plate), value: car.id, raw: true }))} />
          <DateTimeInput label='fine:committed_at' value={committedAt} onChange={setCommittedAt} step={5} />
          <TextField label={t('payment:amount')} value={amount} onChange={event => setAmount(event.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
          <TextField label={t('fine:reference')} value={reference} onChange={event => setReference(event.target.value)} />
          <TextField label={t('contract:note')} value={note} onChange={event => setNote(event.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common:cancel')}</Button>
        <Button variant='contained' loading={save.isPending} onClick={() => carId && millimesFromInput(amount) ? save.mutate() : notify('fine:invalid', 'error')}>{t('fine:save')}</Button>
      </DialogActions>
    </Dialog>
  );
}

// Traffic fines, unpaid first.
export default function FinesPage() {
  const t = useT();
  const [isAdding, setIsAdding] = useState(false);
  const { isLoading, data } = useQuery({ queryKey: ['fine.index'], queryFn: index });

  return (
    <Page title='common:fines' actions={<Button variant='contained' startIcon={<ReceiptLong />} onClick={() => setIsAdding(true)}>{t('fine:new')}</Button>}>
      {isLoading ? <Loading /> : ! data?.length ? <Empty /> :
        <Grid container spacing={2}>
          {data.map(fine => <Grid key={fine.id} size={{ xs: 12, md: 6 }}><FineRow data={fine} href={'/fines/' + fine.id} /></Grid>)}
        </Grid>
      }
      {isAdding && <NewFineDialog onClose={() => setIsAdding(false)} />}
    </Page>
  );
}
