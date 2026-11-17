import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Grid, Typography } from '@mui/material';
import { index } from '../src/api/contract';
import Contract, { STATUS_OUT } from '../src/classes/Contract';
import { useT } from '../src/store/Store';
import { todayBounds } from '../src/support/day';
import { ContractRow } from '../src/components/contract';
import { Empty, Loading, Page } from '../src/components/common';

// Cars handed over and not back yet: overdue first, then due back today, then later.
export default function RentedPage() {
  const t = useT();
  const { isLoading, data } = useQuery({ queryKey: [ 'contract.index', { status: [ STATUS_OUT ], orderBy: 'ends_at' } ], queryFn: index });
  const now = Date.now() / 1000;
  const [ , todayEnd ] = todayBounds();
  const group = (test: (contract: Contract) => boolean) => (data ?? []).filter(test);
  const sections = [
    { title: 'rented:overdue', data: group(contract => contract.ends_at < now) },
    { title: 'rented:today', data: group(contract => contract.ends_at >= now && contract.ends_at < todayEnd) },
    { title: 'rented:later', data: group(contract => contract.ends_at >= todayEnd) },
  ].filter(section => section.data.length);

  return (
    <Page title='common:rented_cars'>
      {isLoading ? <Loading /> : ! sections.length ? <Empty text='rented:none' /> : sections.map(section =>
        <React.Fragment key={section.title}>
          <Typography variant='h6' sx={{ mt: 1, mb: 1 }}>{t(section.title, { count: section.data.length })}</Typography>
          <Grid container spacing={2}>
            {section.data.map(contract => <Grid key={contract.id} size={{ xs: 12, md: 6 }}>
              <ContractRow data={contract} timeLabel='contract:ends_at:value' time={contract.ends_at} location={contract.return_location} isLate={contract.ends_at < now} />
            </Grid>)}
          </Grid>
        </React.Fragment>
      )}
    </Page>
  );
}
