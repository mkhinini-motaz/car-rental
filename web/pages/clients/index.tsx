import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, InputAdornment, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import PersonAdd from '@mui/icons-material/PersonAdd';
import Search from '@mui/icons-material/Search';
import { index } from '../../src/api/clients';
import { useT } from '../../src/store/Store';
import { debounce, formatLocalPhoneNumber } from '../../src/support/utils';
import { ClientLink, Empty, Loading, Page } from '../../src/components/common';

// Clients by name or phone (the API returns 50 at most; search to find the others).
export default function ClientsPage() {
  const t = useT();
  const router = useRouter();
  const [searchValue, setSearchValue] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSetSearch = useMemo(() => debounce(setSearch, 400), []);
  const { isLoading, data } = useQuery({ queryKey: ['client.index', { search }], queryFn: index });

  return (
    <Page title='common:clients' actions={<Button variant='contained' startIcon={<PersonAdd />} component={Link} href='/clients/new'>{t('client:new')}</Button>}>
      <TextField
        placeholder={t('common:search')}
        value={searchValue}
        onChange={event => { setSearchValue(event.target.value); debouncedSetSearch(event.target.value); }}
        sx={{ mb: 2, maxWidth: 420, bgcolor: 'background.paper' }}
        slotProps={{ input: { startAdornment: <InputAdornment position='start'><Search /></InputAdornment> } }}
      />
      {isLoading ? <Loading /> : ! data?.length ? <Empty /> :
        <Card sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('client:label')}</TableCell>
                <TableCell>{t('form:phone:label')}</TableCell>
                <TableCell>{t('form:id_number:label')}</TableCell>
                <TableCell>{t('client:flag')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map(client =>
                <TableRow key={client.id} hover onClick={() => router.push('/clients/' + client.id)} sx={{ cursor: 'pointer' }}>
                  <TableCell><ClientLink data={client} /></TableCell>
                  <TableCell><bdi dir='ltr'>{formatLocalPhoneNumber(client.phone)}</bdi></TableCell>
                  <TableCell>{client.id_number ?? '—'}</TableCell>
                  <TableCell>{client.flag ? <Typography color='error' sx={{ fontWeight: 700 }}>{t('client:flag:' + client.flag)}</Typography> : ''}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      }
    </Page>
  );
}
