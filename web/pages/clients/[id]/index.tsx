import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useQuery } from '@tanstack/react-query';
import { Button, Typography } from '@mui/material';
import Edit from '@mui/icons-material/Edit';
import { show } from '../../../src/api/clients';
import { clientName } from '../../../src/classes/Client';
import { CLIENT_DOCUMENTS } from '../../../src/classes/Document';
import { useT } from '../../../src/store/Store';
import { ClientDetails, ClientStatsCard } from '../../../src/components/client';
import { ContractCard } from '../../../src/components/contract';
import { Documents } from '../../../src/components/documents';
import { Empty, Loading, Page } from '../../../src/components/common';

export default function ClientPage() {
  const t = useT();
  const clientId = Number(useRouter().query.id);
  const { isLoading, data } = useQuery({ queryKey: ['client.show', { id: clientId }], queryFn: show });

  if (isLoading) {
    return <Loading />;
  }
  if (! data) {
    return <Page title='common:clients'><Empty /></Page>;
  }

  return (
    <Page titleText={clientName(data)} actions={<Button variant='outlined' startIcon={<Edit />} component={Link} href={'/clients/' + clientId + '/edit'}>{t('common:edit')}</Button>}>
      <ClientDetails data={data} />
      <Documents owner='client' ownerId={clientId} documents={data.documents ?? []} types={CLIENT_DOCUMENTS} hint='document:private' />
      <ClientStatsCard data={data} />
      <Typography variant='h6' sx={{ mb: 1 }}>{t('client:history')}</Typography>
      {data.contracts?.length ? data.contracts.map(contract => <ContractCard key={contract.id} data={contract} href={'/contracts/' + contract.id} />) : <Empty />}
    </Page>
  );
}
