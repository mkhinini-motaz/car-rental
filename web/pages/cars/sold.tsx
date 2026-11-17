import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card, List, ListItemButton, ListItemText, Typography } from '@mui/material';
import { soldCars } from '../../src/api/money';
import { useT } from '../../src/store/Store';
import { formatDate, plate } from '../../src/support/utils';
import { Empty, Loading, Page, useMoney } from '../../src/components/common';

// Cars that left the fleet (owner): open one to see what it finally returned.
export default function SoldCarsPage() {
  const t = useT();
  const money = useMoney();
  const { isLoading, data } = useQuery({ queryKey: ['car.sold'], queryFn: soldCars });

  return (
    <Page title='car:sold:label'>
      {isLoading ? <Loading /> : ! data?.length ? <Empty text='car:sold:none' /> :
        <Card>
          <List disablePadding>
            {data.map(car =>
              <ListItemButton key={car.id} component={Link} href={'/cars/' + car.id} divider>
                <ListItemText
                  primary={plate(car.licence_plate)}
                  secondary={car.manufacturer + ' ' + car.model_name + ' · ' + t('car:sold:on', { date: formatDate(car.sold_at!) })}
                />
                {car.sale_price ? <Typography sx={{ fontWeight: 700 }}>{money(car.sale_price)}</Typography> : null}
              </ListItemButton>
            )}
          </List>
        </Card>
      }
    </Page>
  );
}
