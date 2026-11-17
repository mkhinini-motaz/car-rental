import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Button, Card, CardContent, Grid, Stack, TextField, Typography } from '@mui/material';
import { show } from '../../../src/api/car';
import { MONEY_QUERIES, updatePurchase } from '../../../src/api/money';
import { useT } from '../../../src/store/Store';
import { plate } from '../../../src/support/utils';
import { millimesFromInput, priceInputFromMillimes } from '../../../src/support/money';
import { useFeedback } from '../../../src/components/Feedback';
import { DateInput, Loading, Page } from '../../../src/components/common';

const MONEY = [ 'purchase_price', 'purchase_fees', 'advance', 'instalment_amount', 'expected_sale_price', 'earned_before' ] as const;
const toDate = (timestamp: number|null|undefined) => timestamp ? new Date(timestamp * 1000) : null;
const toTimestamp = (date: Date|null) => date ? Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9).getTime() / 1000) : null;

// What the car cost and how it's paid for (owner): price, fees, supplier, a credit or leasing,
// and what it should fetch when it leaves the fleet.
export default function CarPurchasePage() {
  const t = useT();
  const router = useRouter();
  const carId = Number(router.query.id);
  const queryClient = useQueryClient();
  const { notify, requestError } = useFeedback();
  const { data } = useQuery({ queryKey: ['car.show', { id: carId }], queryFn: show });
  const [value, setValue] = useState<Record<string, string>|null>(null);
  const [boughtAt, setBoughtAt] = useState<Date|null>(null);
  const [firstInstalmentAt, setFirstInstalmentAt] = useState<Date|null>(null);
  useEffect(() => {
    if (data && ! value) {
      setValue({
        ...Object.fromEntries(MONEY.map(field => [ field, data[field] ? priceInputFromMillimes(data[field]!) : '' ])),
        instalment_months: data.instalment_months ? String(data.instalment_months) : '',
        instalments_paid_before: data.instalments_paid_before ? String(data.instalments_paid_before) : '',
        supplier: data.supplier ?? '',
        lender: data.lender ?? '',
      });
      setBoughtAt(toDate(data.bought_at));
      setFirstInstalmentAt(toDate(data.first_instalment_at));
    }
  }, [data, value]);

  const save = useMutation({
    mutationFn: () => updatePurchase(carId, {
      purchase_price: millimesFromInput(value!.purchase_price),
      purchase_fees: millimesFromInput(value!.purchase_fees) ?? 0,
      advance: millimesFromInput(value!.advance),
      instalment_amount: millimesFromInput(value!.instalment_amount),
      instalment_months: value!.instalment_months.trim() ? Number(value!.instalment_months) : null,
      instalments_paid_before: Number(value!.instalments_paid_before.trim() || 0),
      expected_sale_price: millimesFromInput(value!.expected_sale_price),
      earned_before: millimesFromInput(value!.earned_before),
      supplier: value!.supplier.trim() || null,
      lender: value!.lender.trim() || null,
      bought_at: toTimestamp(boughtAt),
      first_instalment_at: toTimestamp(firstInstalmentAt),
    }),
    onSuccess: () => {
      MONEY_QUERIES.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
      router.replace('/cars/' + carId);
    },
    onError: requestError,
  });

  if (! value || ! data) {
    return <Loading />;
  }
  const field = (name: string, label: string, numeric = true) =>
    <Grid size={{ xs: 12, sm: 6 }}>
      <TextField label={t(label)} value={value[name]} onChange={event => setValue({ ...value, [name]: event.target.value })} slotProps={numeric ? { htmlInput: { inputMode: 'decimal' } } : undefined} />
    </Grid>;
  const onSave = () => {
    const hasCredit = value.instalment_amount.trim() || value.instalment_months.trim();
    const isInvalid = MONEY.some(name => value[name].trim() && millimesFromInput(value[name]) === null)
      || (hasCredit && (! millimesFromInput(value.instalment_amount) || ! /^\d+$/.test(value.instalment_months.trim())))
      || ! /^\d*$/.test(value.instalments_paid_before.trim());
    isInvalid ? notify('car:purchase:invalid', 'error') : save.mutate();
  };

  return (
    <Page titleText={t('car:purchase') + ' · ' + plate(data.licence_plate)}>
      <Card sx={{ maxWidth: 820 }}>
        <CardContent>
          <Stack sx={{ gap: 2.5 }}>
            <Grid container spacing={2}>
              {field('purchase_price', 'car:purchase_price:dinars')}
              <Grid size={{ xs: 12, sm: 6 }}><DateInput label='car:bought_at' value={boughtAt} onChange={setBoughtAt} max={new Date()} /></Grid>
              {field('purchase_fees', 'car:purchase_fees:dinars')}
              {field('supplier', 'car:supplier', false)}
            </Grid>
            <Box>
              <Typography variant='h6'>{t('car:financing')}</Typography>
              <Typography variant='body2' color='text.secondary'>{t('car:financing:hint')}</Typography>
            </Box>
            <Grid container spacing={2}>
              {field('advance', 'car:advance')}
              {field('instalment_amount', 'car:financing:instalment:dinars')}
              {field('instalment_months', 'car:financing:months')}
              <Grid size={{ xs: 12, sm: 6 }}><DateInput label='car:financing:first' value={firstInstalmentAt} onChange={setFirstInstalmentAt} /></Grid>
              {field('instalments_paid_before', 'car:financing:paid_before')}
              {field('lender', 'car:lender', false)}
            </Grid>
            <Box>
              <Typography variant='h6'>{t('car:before_app')}</Typography>
              <Typography variant='body2' color='text.secondary'>{t('car:before_app:hint')}</Typography>
            </Box>
            <Grid container spacing={2}>{field('earned_before', 'car:earned_before:dinars')}</Grid>
            <Typography variant='h6'>{t('car:fleet_deadline')}</Typography>
            <Grid container spacing={2}>{field('expected_sale_price', 'car:expected_sale_price:dinars')}</Grid>
            <Box><Button variant='contained' size='large' onClick={onSave} loading={save.isPending}>{t('common:save')}</Button></Box>
          </Stack>
        </CardContent>
      </Card>
    </Page>
  );
}
