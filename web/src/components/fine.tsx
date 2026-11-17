import React from 'react';
import { Card, CardContent, Stack, Typography } from '@mui/material';
import Fine from '../classes/Fine';
import { useT } from '../store/Store';
import { formatDateTime, plate } from '../support/utils';
import { Tone } from '../constants';
import { Badge, ClientLink, EntityLink, OpenArea, useMoney } from './common';

// Unpaid, paid by the client, from the deposit, paid by the agency.
const STATUS_TONES: Record<number, Tone> = { 1: 'danger', 2: 'ok', 3: 'ok', 4: 'muted' };

export function FineStatus({ status }: { status: number }) {
  return <Badge label={'fine:status:' + status} tone={STATUS_TONES[status]} />;
}

export function FineRow({ data, href }: { data: Fine, href?: string }) {
  const t = useT();
  const money = useMoney();
  const client = data.contract?.client ?? data.client; // the rental's, or the renter named for a rental kept on paper
  const content = (
    <CardContent>
      <Stack sx={{ gap: 0.5 }}>
        <Stack direction='row' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <FineStatus status={data.status} />
          <Typography sx={{ fontWeight: 700 }}>{money(data.amount)}</Typography>
        </Stack>
        {data.car && <Typography><EntityLink href={'/cars/' + data.car.id}>{plate(data.car.licence_plate)} · {data.car.manufacturer} {data.car.model_name}</EntityLink></Typography>}
        <Typography>{formatDateTime(data.committed_at)}{data.reference ? ' · ' + data.reference : ''}</Typography>
        {client && <Typography><ClientLink data={client} /></Typography>}
        {! data.contract_id && <Typography sx={{ color: 'warning.dark' }}>{t('fine:no_contract')}</Typography>}
        {!! data.paid_out_at && <Typography variant='body2' color='text.secondary'>{t('fine:payout:line', { date: formatDateTime(data.paid_out_at) })}</Typography>}
        {!! data.note && <Typography variant='body2' sx={{ fontStyle: 'italic' }}>{data.note}</Typography>}
      </Stack>
    </CardContent>
  );
  return <Card sx={{ mb: 1.5 }}>{href ? <OpenArea href={href}>{content}</OpenArea> : content}</Card>;
}
