import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button, Grid } from '@mui/material';
import Add from '@mui/icons-material/Add';
import { index } from '../../src/api/car';
import { useIsOwner, useT } from '../../src/store/Store';
import { CarCard } from '../../src/components/car';
import { Empty, Loading, Page } from '../../src/components/common';

// The fleet: plate and model, where the car is now, its daily price.
export default function CarsPage() {
  const t = useT();
  const isOwner = useIsOwner();
  const { isLoading, data } = useQuery({ queryKey: ['car.index'], queryFn: index });

  return (
    <Page title='common:cars' actions={isOwner && <Button variant='contained' startIcon={<Add />} component={Link} href='/cars/new'>{t('car:new')}</Button>}>
      {isLoading ? <Loading /> : ! data?.length ? <Empty text='car:none' /> :
        <Grid container spacing={2}>
          {data.map(car => <Grid key={car.id} size={{ xs: 12, sm: 6, lg: 4 }}><CarCard data={car} href={'/cars/' + car.id} /></Grid>)}
        </Grid>
      }
    </Page>
  );
}
