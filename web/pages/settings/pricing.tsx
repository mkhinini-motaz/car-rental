import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Button, Checkbox, FormControlLabel, IconButton, Stack, TextField, Typography } from '@mui/material';
import Add from '@mui/icons-material/Add';
import DeleteOutline from '@mui/icons-material/DeleteOutlined';
import { pricing, updatePricing } from '../../src/api/agency';
import { useT } from '../../src/store/Store';
import { validationErrors } from '../../src/support/alert';
import { millimesFromInput, priceInputFromMillimes } from '../../src/support/money';
import { useFeedback } from '../../src/components/Feedback';
import { Choice, Loading, Page, Section } from '../../src/components/common';

// Numbers are kept as typed until saving.
interface Rules {
  seasons: { name: string, from: string, to: string, percent: string }[],
  discounts: { min_days: string, percent: string }[],
  extras: { name: string, price: string, per: 'rental'|'day' }[],
  locations: { name: string, fee: string }[],
  second_driver_price: string,
  charge_extra_km: boolean,
  km_per_day: string,
  extra_km_price: string,
  late_grace_hours: string,
  late_per: 'none'|'hour'|'day',
  late_hour_price: string,
  washing_price: string,
}

const LATE_OPTIONS = [ 'none', 'hour', 'day' ] as const;
type List = 'seasons'|'discounts'|'extras'|'locations';

// Seasons, discounts for long rentals, extras, delivery places and return charges. The reservation
// page suggests prices from them; staff can always change a contract's price.
export default function PricingPage() {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { notify, requestError } = useFeedback();
  const { isLoading, data } = useQuery({ queryKey: ['agency.pricing'], queryFn: pricing });
  const [rules, setRules] = useState<Rules|null>(null);
  useEffect(() => {
    if (data) {
      setRules({
        seasons: data.seasons.map(season => ({ ...season, percent: String(season.percent) })),
        discounts: data.discounts.map(discount => ({ min_days: String(discount.min_days), percent: String(discount.percent) })),
        extras: data.extras.map(extra => ({ name: extra.name, per: extra.per, price: priceInputFromMillimes(extra.price) })),
        locations: data.locations.map(location => ({ name: location.name, fee: priceInputFromMillimes(location.fee) })),
        second_driver_price: priceInputFromMillimes(data.second_driver_price),
        charge_extra_km: data.charge_extra_km,
        km_per_day: String(data.km_per_day),
        extra_km_price: priceInputFromMillimes(data.extra_km_price),
        late_grace_hours: String(data.late_grace_hours),
        late_per: data.late_per,
        late_hour_price: priceInputFromMillimes(data.late_hour_price),
        washing_price: priceInputFromMillimes(data.washing_price),
      });
    }
  }, [data]);

  // Empty or 0 means free (a free price loads as '0'); anything unreadable is sent as -1 so the API refuses it.
  const amount = (value: string) => ! value.trim() || Number(value.trim().replace(',', '.')) === 0 ? 0 : millimesFromInput(value) ?? -1;
  const save = useMutation({
    mutationFn: () => updatePricing({
      seasons: rules!.seasons.map(season => ({ name: season.name.trim(), from: season.from.trim(), to: season.to.trim(), percent: Number.parseInt(season.percent, 10) })),
      discounts: rules!.discounts.map(discount => ({ min_days: Number.parseInt(discount.min_days, 10), percent: Number.parseInt(discount.percent, 10) })),
      extras: rules!.extras.map(extra => ({ name: extra.name.trim(), price: millimesFromInput(extra.price) ?? -1, per: extra.per })),
      locations: rules!.locations.map(location => ({ name: location.name.trim(), fee: amount(location.fee) })),
      second_driver_price: amount(rules!.second_driver_price),
      charge_extra_km: rules!.charge_extra_km,
      km_per_day: Number.parseInt(rules!.km_per_day || '0', 10),
      extra_km_price: amount(rules!.extra_km_price),
      late_grace_hours: Number.parseInt(rules!.late_grace_hours || '0', 10),
      late_per: rules!.late_per,
      late_hour_price: amount(rules!.late_hour_price),
      washing_price: amount(rules!.washing_price),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency.pricing'] });
      notify('pricing:saved', 'success');
      router.push('/settings');
    },
    onError: (error) => Object.keys(validationErrors(error)).length ? notify('pricing:invalid', 'error') : requestError(error),
  });

  if (isLoading || ! rules) {
    return <Loading />;
  }

  const update = (list: List, change: (rows: any[]) => any[]) => setRules(current => current && { ...current, [list]: change(current[list]) });
  const set = (list: List, index: number, field: string, value: string) => update(list, rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  const remove = (list: List, index: number) => update(list, rows => rows.filter((_row, rowIndex) => rowIndex !== index));
  const add = (list: List, row: object) => update(list, rows => [ ...rows, row ]);
  const setRule = (field: keyof Rules, value: string|boolean) => setRules(current => current && { ...current, [field]: value });
  const input = (value: string, onChange: (text: string) => void, placeholder: string, width?: number) =>
    <TextField value={value} onChange={event => onChange(event.target.value)} placeholder={t(placeholder)} sx={width ? { width, flexShrink: 0 } : undefined} />;
  const removeButton = (list: List, index: number) => <IconButton color='error' aria-label={t('common:remove')} onClick={() => remove(list, index)}><DeleteOutline /></IconButton>;
  const row = (children: React.ReactNode, key: number) => <Stack key={key} direction='row' sx={{ gap: 1, alignItems: 'center' }}>{children}</Stack>;
  const addButton = (label: string, onClick: () => void) => <Box><Button startIcon={<Add />} onClick={onClick}>{t(label)}</Button></Box>;

  return (
    <Page title='pricing:label'>
      <Box sx={{ maxWidth: 820 }}>
        <Section title='pricing:seasons'>
          <Typography variant='body2' color='text.secondary'>{t('pricing:seasons:hint')}</Typography>
          {rules.seasons.map((season, index) => row(<>
            {input(season.name, text => set('seasons', index, 'name', text), 'pricing:season:name')}
            {input(season.from, text => set('seasons', index, 'from', text), 'dd/mm', 90)}
            {input(season.to, text => set('seasons', index, 'to', text), 'dd/mm', 90)}
            {input(season.percent, text => set('seasons', index, 'percent', text), '%', 70)}
            <Typography>%</Typography>
            {removeButton('seasons', index)}
          </>, index))}
          {addButton('pricing:season:add', () => add('seasons', { name: '', from: '01/07', to: '31/08', percent: '20' }))}
        </Section>

        <Section title='pricing:discounts'>
          <Typography variant='body2' color='text.secondary'>{t('pricing:discounts:hint')}</Typography>
          {rules.discounts.map((discount, index) => row(<>
            {input(discount.min_days, text => set('discounts', index, 'min_days', text), 'pricing:discount:days', 90)}
            <Typography>{t('pricing:discount:days')}</Typography>
            {input(discount.percent, text => set('discounts', index, 'percent', text), '%', 70)}
            <Typography>%</Typography>
            {removeButton('discounts', index)}
          </>, index))}
          {addButton('pricing:discount:add', () => add('discounts', { min_days: '7', percent: '10' }))}
        </Section>

        <Section title='extra:label'>
          {rules.extras.map((extra, index) => row(<>
            {input(extra.name, text => set('extras', index, 'name', text), 'pricing:extra:name')}
            {input(extra.price, text => set('extras', index, 'price', text), 'TND', 90)}
            <Typography>TND</Typography>
            <Box sx={{ flexShrink: 0 }}><Choice value={extra.per} onChange={per => set('extras', index, 'per', per)} options={[ { label: 'extra:per:day', value: 'day' }, { label: 'extra:per:rental', value: 'rental' } ]} /></Box>
            {removeButton('extras', index)}
          </>, index))}
          {addButton('pricing:extra:add', () => add('extras', { name: '', price: '', per: 'day' }))}
          <Stack direction='row' sx={{ gap: 1, alignItems: 'center', mt: 1 }}>
            <Typography sx={{ flex: 1 }}>{t('pricing:second_driver')}</Typography>
            {input(rules.second_driver_price, text => setRule('second_driver_price', text), '0', 90)}
            <Typography>{t('pricing:tnd_per_day')}</Typography>
          </Stack>
        </Section>

        <Section title='pricing:locations'>
          <Typography variant='body2' color='text.secondary'>{t('pricing:locations:hint')}</Typography>
          {rules.locations.map((location, index) => row(<>
            {input(location.name, text => set('locations', index, 'name', text), 'pricing:location:name')}
            {input(location.fee, text => set('locations', index, 'fee', text), '0', 90)}
            <Typography>TND</Typography>
            {removeButton('locations', index)}
          </>, index))}
          {addButton('pricing:location:add', () => add('locations', { name: '', fee: '' }))}
        </Section>

        <Section title='pricing:return'>
          <Typography variant='body2' color='text.secondary'>{t('pricing:return:hint')}</Typography>
          <FormControlLabel control={<Checkbox checked={rules.charge_extra_km} onChange={() => setRule('charge_extra_km', ! rules.charge_extra_km)} />} label={t('pricing:charge_extra_km')} />
          {rules.charge_extra_km && <>
            <Stack direction='row' sx={{ gap: 1, alignItems: 'center' }}>
              <Typography sx={{ flex: 1 }}>{t('pricing:km_per_day')}</Typography>
              {input(rules.km_per_day, text => setRule('km_per_day', text), '0', 90)}
              <Typography>km</Typography>
            </Stack>
            <Stack direction='row' sx={{ gap: 1, alignItems: 'center' }}>
              <Typography sx={{ flex: 1 }}>{t('pricing:extra_km_price')}</Typography>
              {input(rules.extra_km_price, text => setRule('extra_km_price', text), '0.200', 90)}
              <Typography>TND</Typography>
            </Stack>
          </>}
          <Choice label='pricing:late' value={rules.late_per} onChange={value => setRule('late_per', value)} options={LATE_OPTIONS.map(option => ({ label: 'pricing:late:' + option, value: option }))} />
          {rules.late_per !== 'none' && <Stack direction='row' sx={{ gap: 1, alignItems: 'center' }}>
            <Typography sx={{ flex: 1 }}>{t('pricing:late:grace')}</Typography>
            {input(rules.late_grace_hours, text => setRule('late_grace_hours', text), '2', 90)}
            <Typography>{t('pricing:hours')}</Typography>
          </Stack>}
          {rules.late_per === 'hour' && <Stack direction='row' sx={{ gap: 1, alignItems: 'center' }}>
            <Typography sx={{ flex: 1 }}>{t('pricing:late:hour_price')}</Typography>
            {input(rules.late_hour_price, text => setRule('late_hour_price', text), 'TND', 90)}
            <Typography>TND</Typography>
          </Stack>}
          <Stack direction='row' sx={{ gap: 1, alignItems: 'center' }}>
            <Typography sx={{ flex: 1 }}>{t('pricing:washing')}</Typography>
            {input(rules.washing_price, text => setRule('washing_price', text), '20', 90)}
            <Typography>TND</Typography>
          </Stack>
        </Section>

        <Button variant='contained' size='large' loading={save.isPending} onClick={() => save.mutate()}>{t('common:save')}</Button>
      </Box>
    </Page>
  );
}
