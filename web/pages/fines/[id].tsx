import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Button, Grid, Stack, Typography } from '@mui/material';
import Person from '@mui/icons-material/Person';
import Savings from '@mui/icons-material/Savings';
import Storefront from '@mui/icons-material/Storefront';
import Undo from '@mui/icons-material/Undo';
import AccountBalance from '@mui/icons-material/AccountBalance';
import DeleteOutline from '@mui/icons-material/DeleteOutlined';
import { invalidateContractQueries } from '../../src/api/contract';
import { destroy, payOut, setClient, settle, show, undoPayOut } from '../../src/api/fine';
import { STATUS_CLOSED, STATUS_OUT, STATUS_RETURNED } from '../../src/classes/Contract';
import Fine, { STATUS_FROM_DEPOSIT, STATUS_PAID_BY_AGENCY, STATUS_PAID_BY_CLIENT, STATUS_UNPAID } from '../../src/classes/Fine';
import { METHOD_CASH, METHODS } from '../../src/classes/Payment';
import { useIsOwner, useT } from '../../src/store/Store';
import { validationErrors } from '../../src/support/alert';
import { formatDateTime } from '../../src/support/utils';
import { ContractRow } from '../../src/components/contract';
import { FineRow } from '../../src/components/fine';
import { ClientPicker } from '../../src/components/client';
import { useFeedback } from '../../src/components/Feedback';
import { Choice, Empty, Loading, Page, Section } from '../../src/components/common';

const DIRECT = 0; // the client paid the authority, no money through the agency

// A fine, the rental it was matched to, and its two sides: the agency paying the authority, and
// the client paying (the agency back, or the authority directly).
export default function FinePage() {
  const t = useT();
  const router = useRouter();
  const fineId = Number(router.query.id);
  const isOwner = useIsOwner();
  const queryClient = useQueryClient();
  const { notify, confirm, requestError } = useFeedback();
  const { isLoading, data } = useQuery({ queryKey: ['fine.show', { id: fineId }], queryFn: show });
  const [method, setMethod] = useState<number>(METHOD_CASH); // how the client paid
  const [payoutMethod, setPayoutMethod] = useState<number>(METHOD_CASH); // how the agency paid the authority

  const onError = (error: unknown) => {
    const message = validationErrors(error).status?.[0];
    message ? notify(message, 'error') : requestError(error);
  };
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
      router.replace('/fines');
    },
    onError,
  });

  if (isLoading) {
    return <Loading />;
  }
  if (! data) {
    return <Page title='fine:label'><Empty /></Page>;
  }

  const contract = data.contract;
  const depositIsHeld = !! contract && contract.deposit > 0 && [ STATUS_OUT, STATUS_RETURNED ].includes(contract.status);
  const isLocked = data.status === STATUS_FROM_DEPOSIT && contract?.status === STATUS_CLOSED;
  const methodOptions = METHODS.map(value => ({ label: 'payment:method:' + value, value }));
  const action = (label: string, status: number, icon: React.ReactNode) => data.status !== status &&
    <Button key={status} variant='outlined' startIcon={icon} loading={update.isPending && update.variables === status} onClick={() => update.mutate(status)}>{t(label)}</Button>;

  return (
    <Page title='fine:label'>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <FineRow data={data} />
          {contract && <ContractRow data={contract} timeLabel='contract:ends_at:value' time={contract.ends_at} />}
          {! data.contract_id && <Section title='fine:renter'>
            <Typography variant='body2' color='text.secondary' sx={{ mb: 1.5 }}>{t('fine:renter:hint')}</Typography>
            <ClientPicker value={data.client ?? null} onChange={client => renter.mutate(client.id)} onClear={data.client ? () => renter.mutate(undefined) : undefined} />
          </Section>}
          {isLocked && <Section><Typography>{t('fine:deposit:settled')}</Typography></Section>}
        </Grid>
        {! isLocked && <Grid size={{ xs: 12, md: 6 }}>
          <Section title='fine:client_side'>
            <Choice label='fine:method' value={method} onChange={setMethod} options={[ ...methodOptions, { label: 'fine:method:direct', value: DIRECT } ]} />
            <Stack direction='row' sx={{ gap: 1, flexWrap: 'wrap', mt: 1 }}>
              {action('fine:settle:client', STATUS_PAID_BY_CLIENT, <Person />)}
              {depositIsHeld && action('fine:settle:deposit', STATUS_FROM_DEPOSIT, <Savings />)}
              {action('fine:settle:agency', STATUS_PAID_BY_AGENCY, <Storefront />)}
              {action('fine:settle:unpaid', STATUS_UNPAID, <Undo />)}
            </Stack>
          </Section>
          <Section title='fine:payout'>
            {data.paid_out_at ? <>
              <Typography>{t('fine:payout:done', { date: formatDateTime(data.paid_out_at), method: t('payment:method:' + data.paid_out_method) })}</Typography>
              {data.status !== STATUS_PAID_BY_AGENCY && <Box><Button variant='outlined' startIcon={<Undo />} loading={undoPayout.isPending} onClick={() => undoPayout.mutate(undefined)}>{t('fine:payout:undo')}</Button></Box>}
            </> : <>
              <Typography color='text.secondary'>{t('fine:payout:hint')}</Typography>
              <Choice label='fine:payout:method' value={payoutMethod} onChange={setPayoutMethod} options={methodOptions} />
              <Box><Button variant='outlined' startIcon={<AccountBalance />} loading={payout.isPending} onClick={() => payout.mutate(undefined)}>{t('fine:payout:record')}</Button></Box>
            </>}
          </Section>
          {isOwner && <Button color='error' variant='outlined' startIcon={<DeleteOutline />} loading={remove.isPending} onClick={async () => await confirm('fine:delete:confirm') && remove.mutate()}>
            {t('fine:delete')}
          </Button>}
        </Grid>}
      </Grid>
    </Page>
  );
}
