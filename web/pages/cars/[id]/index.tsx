import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Button, Grid, List, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material';
import Edit from '@mui/icons-material/Edit';
import Build from '@mui/icons-material/Build';
import Payments from '@mui/icons-material/Payments';
import AddCard from '@mui/icons-material/AddCard';
import Handshake from '@mui/icons-material/Handshake';
import Undo from '@mui/icons-material/Undo';
import CarCrash from '@mui/icons-material/CarCrash';
import HistoryEdu from '@mui/icons-material/HistoryEdu';
import { show } from '../../../src/api/car';
import { MONEY_QUERIES, undoSale } from '../../../src/api/money';
import { clientName } from '../../../src/classes/Client';
import { ContractDamage, STAGE_PICKUP } from '../../../src/classes/Inspection';
import { CAR_DOCUMENTS, CIRCULATION_TAX, INSURANCE, TECHNICAL_CONTROL } from '../../../src/classes/Document';
import { useIsOwner, useLang, useT } from '../../../src/store/Store';
import { arrow, formatDate, formatDateTime } from '../../../src/support/utils';
import { CarDetails, CarMoneyCards, CarMoneyLists } from '../../../src/components/car';
import { ContractStatus } from '../../../src/components/contract';
import { Documents } from '../../../src/components/documents';
import { Badge, Empty, Loading, Page, Section } from '../../../src/components/common';
import { useFeedback } from '../../../src/components/Feedback';
import ExpenseDialog from '../../../src/components/ExpenseDialog';
import { CarDamageDialog, DamageRepairDialog, IncomeDialog, PastRentalDialog, SaleDialog } from '../../../src/components/moneyDialogs';

// A car: who has it, its papers and maintenance, what it cost and earned (owner), its rentals.
export default function CarPage() {
  const t = useT();
  const { isRtl } = useLang();
  const router = useRouter();
  const carId = Number(router.query.id);
  const isOwner = useIsOwner();
  const queryClient = useQueryClient();
  const { confirm, requestError } = useFeedback();
  const [dialog, setDialog] = useState<'expense'|'income'|'sale'|'damage'|'past'|null>(null);
  const [repairing, setRepairing] = useState<ContractDamage|null>(null);
  const { isLoading, data } = useQuery({ queryKey: ['car.show', { id: carId }], queryFn: show });
  const unsell = useMutation({
    mutationFn: () => undoSale(carId),
    onSuccess: () => MONEY_QUERIES.forEach(key => queryClient.invalidateQueries({ queryKey: [key] })),
    onError: requestError,
  });

  if (isLoading) {
    return <Loading />;
  }
  if (! data) {
    return <Page title='common:cars'><Empty /></Page>;
  }
  const purchase = () => router.push('/cars/' + carId + '/purchase');
  // Red when expired, orange within a month.
  const now = Date.now() / 1000;
  const paper = (expiresAt: number) => ({ date: formatDate(expiresAt), tone: expiresAt < now ? 'danger' as const : expiresAt < now + 30 * 24 * 3600 ? 'warn' as const : undefined });

  return (
    <Page
      titleText={data.manufacturer + ' ' + data.model_name}
      actions={<>
        {isOwner && ! data.sold_at && <Button variant='outlined' startIcon={<Edit />} component={Link} href={'/cars/' + carId + '/edit'}>{t('common:edit')}</Button>}
        <Button variant='outlined' startIcon={<Build />} onClick={() => setDialog('expense')}>{t('expense:add')}</Button>
        {isOwner && <Button variant='outlined' startIcon={<Payments />} onClick={purchase}>{t('car:purchase')}</Button>}
        {isOwner && <Button variant='outlined' startIcon={<AddCard />} onClick={() => setDialog('income')}>{t('income:add')}</Button>}
        {isOwner && (data.sold_at ?
          <Button variant='outlined' color='error' startIcon={<Undo />} loading={unsell.isPending} onClick={async () => await confirm('car:sale:undo:confirm') && unsell.mutate()}>{t('car:sale:undo')}</Button> :
          <Button variant='outlined' startIcon={<Handshake />} onClick={() => setDialog('sale')}>{t('car:sell')}</Button>)}
        {/* Old data: the scratches it came with, the rentals in the notebook. */}
        {! data.sold_at && <Button variant='outlined' startIcon={<CarCrash />} onClick={() => setDialog('damage')}>{t('damage:mark')}</Button>}
        {! data.sold_at && <Button variant='outlined' startIcon={<HistoryEdu />} onClick={() => setDialog('past')}>{t('contract:past:add')}</Button>}
      </>}
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <CarDetails data={data} />
          <Box sx={{ mt: 2 }}>
            <Documents owner='car' ownerId={carId} documents={data.documents ?? []} types={CAR_DOCUMENTS} dates={{
              [INSURANCE]: paper(data.insurance_ends_at),
              [CIRCULATION_TAX]: paper(data.circulation_tax_ends_at),
              [TECHNICAL_CONTROL]: paper(data.technical_control_ends_at),
            }} />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          {isOwner && <CarMoneyCards data={data} onEditPurchase={purchase} />}
          <CarMoneyLists data={data} />
          {!! data.damages?.length && <Section title='damage:history'>
            <List disablePadding>
              {data.damages.map(damage => {
                const contract = data.contracts?.find(item => item.id === damage.contract_id);
                return <ListItem key={damage.id} divider disablePadding>
                  <ListItemButton disabled={!! damage.repaired_at} onClick={() => setRepairing(damage)} sx={{ '&.Mui-disabled': { opacity: 1 } }}>
                    <ListItemText
                      primary={damage.note || '—'}
                      secondary={[ t(damage.stage === null ? 'damage:on_car' : damage.stage === STAGE_PICKUP ? 'inspection:damages:pickup' : 'inspection:damages:return'), contract?.client && clientName(contract.client), formatDate(damage.created_at) ].filter(Boolean).join(' · ')}
                    />
                    {damage.repaired_at ?
                      <Badge label='damage:repaired:on' params={{ date: formatDate(damage.repaired_at) }} /> :
                      <Badge label='damage:open' tone='warn' />}
                  </ListItemButton>
                </ListItem>;
              })}
            </List>
          </Section>}
          {! data.damages?.length && ! data.sold_at && ! data.contracts?.some(contract => contract.picked_up_at) && <Section title='damage:history'>
            <Typography color='text.secondary'>{t('damage:no_inspection')}</Typography>
          </Section>}
          <Section title='car:contracts'>
            {data.contracts?.length ? <List disablePadding>
              {data.contracts.map(contract =>
                <ListItemButton key={contract.id} component={Link} href={'/contracts/' + contract.id} divider>
                  <ListItemText primary={contract.client ? clientName(contract.client) : '—'} secondary={formatDateTime(contract.starts_at) + arrow(isRtl) + formatDateTime(contract.ends_at)} />
                  <ContractStatus status={contract.status} />
                </ListItemButton>
              )}
            </List> : <Empty />}
          </Section>
        </Grid>
      </Grid>
      <ExpenseDialog open={dialog === 'expense'} onClose={() => setDialog(null)} carId={carId} />
      {dialog === 'income' && <IncomeDialog carId={carId} onClose={() => setDialog(null)} />}
      {dialog === 'sale' && <SaleDialog carId={carId} onClose={() => setDialog(null)} />}
      {dialog === 'damage' && <CarDamageDialog car={data} onClose={() => setDialog(null)} />}
      {dialog === 'past' && <PastRentalDialog car={data} onClose={() => setDialog(null)} />}
      {repairing && <DamageRepairDialog carId={carId} damage={repairing} onClose={() => setRepairing(null)} />}
    </Page>
  );
}
