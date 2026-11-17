import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Button, Card, CardContent, Grid, Stack, TextField, Typography } from '@mui/material';
import Edit from '@mui/icons-material/Edit';
import { CarInput, show, store, update, uploadPhoto } from '../api/car';
import { branches } from '../api/money';
import Car, { STATUS_AVAILABLE, STATUS_MAINTENANCE, STATUS_OUT_OF_SERVICE } from '../classes/Car';
import { useT } from '../store/Store';
import { serverFieldErrors } from '../support/alert';
import { millimesFromInput, priceInputFromMillimes } from '../support/money';
import { parseDmy, toDmy } from '../support/utils';
import { CAR_COLOURS, isSwatch } from './car';
import { useFeedback } from './Feedback';
import { bareButton, Choice, DateInput, Loading, Page, PhotoInput } from './common';

// Numbers are kept as typed; the API validates them.
interface CarFormValue {
  manufacturer: string, model_name: string, model_year: string, licence_plate: string, serial_number: string,
  colour: string|null, daily_price: string, status: number, type: number|null, transmission_type: number|null, fuel_type: number|null,
  fiscal_horse_power: string, number_of_cylinders: string, mileage: string, oil_change_every_km: string, oil_change_every_months: string,
  first_circulation_date: Date|null, insurance_ends_at: Date|null, circulation_tax_ends_at: Date|null, technical_control_ends_at: Date|null,
  branch_id: number, // 0: none
}

const emptyCarForm: CarFormValue = {
  manufacturer: '', model_name: '', model_year: '', licence_plate: '', serial_number: '',
  colour: null, daily_price: '', status: STATUS_AVAILABLE, type: null, transmission_type: null, fuel_type: null,
  fiscal_horse_power: '', number_of_cylinders: '', mileage: '', oil_change_every_km: '10000', oil_change_every_months: '12',
  first_circulation_date: null, insurance_ends_at: null, circulation_tax_ends_at: null, technical_control_ends_at: null, branch_id: 0,
};

const TEXT_FIELDS = [
  [ 'manufacturer', 'car:manufacturer' ], [ 'model_name', 'car:model_name' ], [ 'model_year', 'car:model_year' ],
  [ 'licence_plate', 'car:licence_plate' ], [ 'serial_number', 'car:serial_number' ], [ 'daily_price', 'contract:daily_price' ],
  [ 'fiscal_horse_power', 'car:fiscal_horse_power' ], [ 'number_of_cylinders', 'car:number_of_cylinders' ], [ 'mileage', 'car:mileage' ],
  [ 'oil_change_every_km', 'car:oil_change_every_km' ], [ 'oil_change_every_months', 'car:oil_change_every_months' ],
] as const;
const DATE_FIELDS = [
  [ 'first_circulation_date', 'car:first_circulation_date' ], [ 'insurance_ends_at', 'car:insurance' ],
  [ 'circulation_tax_ends_at', 'car:circulation_tax' ], [ 'technical_control_ends_at', 'car:technical_control' ],
] as const;
const OPTIONAL = [ 'mileage', 'colour', 'branch_id' ];

const fromTimestamp = (timestamp: number) => new Date(timestamp * 1000);
// Expiry dates are sent as the start of the chosen day.
const toTimestamp = (date: Date|null) => date ? Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 1000) : 0;
const toInt = (value: string) => Number.parseInt(value.trim(), 10);

const carToForm = (car: Car): CarFormValue => ({
  manufacturer: car.manufacturer, model_name: car.model_name, model_year: String(car.model_year), licence_plate: car.licence_plate,
  serial_number: car.serial_number, colour: car.colour, daily_price: priceInputFromMillimes(car.daily_price), status: car.status,
  type: car.type, transmission_type: car.transmission_type, fuel_type: car.fuel_type, fiscal_horse_power: String(car.fiscal_horse_power),
  number_of_cylinders: String(car.number_of_cylinders), mileage: car.mileage === null ? '' : String(car.mileage),
  oil_change_every_km: String(car.oil_change_every_km), oil_change_every_months: String(car.oil_change_every_months),
  first_circulation_date: parseDmy(car.first_circulation_date), insurance_ends_at: fromTimestamp(car.insurance_ends_at),
  circulation_tax_ends_at: fromTimestamp(car.circulation_tax_ends_at), technical_control_ends_at: fromTimestamp(car.technical_control_ends_at),
  branch_id: car.branch_id ?? 0,
});

const formToCarInput = (value: CarFormValue): CarInput => ({
  manufacturer: value.manufacturer.trim(), model_name: value.model_name.trim(), model_year: toInt(value.model_year),
  licence_plate: value.licence_plate.trim(), serial_number: value.serial_number.trim(), colour: value.colour,
  daily_price: millimesFromInput(value.daily_price) ?? 0, status: value.status as CarInput['status'], type: value.type as CarInput['type'],
  transmission_type: value.transmission_type as CarInput['transmission_type'], fuel_type: value.fuel_type as CarInput['fuel_type'],
  fiscal_horse_power: toInt(value.fiscal_horse_power), number_of_cylinders: toInt(value.number_of_cylinders),
  mileage: value.mileage.trim() ? toInt(value.mileage) : null, oil_change_every_km: toInt(value.oil_change_every_km),
  oil_change_every_months: toInt(value.oil_change_every_months), first_circulation_date: toDmy(value.first_circulation_date) ?? '',
  insurance_ends_at: toTimestamp(value.insurance_ends_at), circulation_tax_ends_at: toTimestamp(value.circulation_tax_ends_at),
  technical_control_ends_at: toTimestamp(value.technical_control_ends_at),
  branch_id: value.branch_id || null,
});

// A swatch, or for a colour the palette doesn't have ("Vert pomme", "Bordeaux métallisé"), its name.
function ColorField({ value, onChange }: { value: string|null, onChange: (colour: string) => void }) {
  const t = useT();
  const [isNaming, setIsNaming] = useState(false);
  const showsName = isNaming || (!! value && ! isSwatch(value));
  const swatch = (selected: boolean) => ({ ...bareButton, width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', border: selected ? '3px solid' : '1px solid', borderColor: selected ? 'primary.main' : 'text.disabled', display: 'grid', placeItems: 'center' });

  return (
    <Box>
      <Typography variant='subtitle2' color='text.secondary' sx={{ mb: 0.75 }}>{t('car:colour')}</Typography>
      <Stack direction='row' sx={{ flexWrap: 'wrap', gap: 1.5 }}>
        {CAR_COLOURS.map(colour => <Box key={colour} component='button' type='button' aria-label={t('car:colour:' + colour.slice(1))} aria-pressed={value === colour} onClick={() => { setIsNaming(false); onChange(colour); }} sx={{ ...swatch(value === colour), bgcolor: colour }} />)}
        <Box component='button' type='button' aria-label={t('car:colour:name')} aria-pressed={showsName} onClick={() => { setIsNaming(true); onChange(isSwatch(value) ? '' : value ?? ''); }} sx={swatch(showsName)}><Edit fontSize='small' color='primary' /></Box>
      </Stack>
      {showsName && <TextField sx={{ mt: 1.5 }} value={value ?? ''} onChange={event => onChange(event.target.value)} placeholder={t('car:colour:name')} autoFocus={isNaming} slotProps={{ htmlInput: { maxLength: 30 } }} />}
    </Box>
  );
}

// Adds a car, or edits one when `carId` is given; the registration card (carte grise) has everything
// but the price, colour and status. The photo is uploaded once the car is saved.
export default function CarForm({ carId }: { carId?: number }) {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { requestError } = useFeedback();
  const [value, setValue] = useState<CarFormValue>(emptyCarForm);
  const [photo, setPhoto] = useState<File|null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { isLoading, data } = useQuery({ queryKey: ['car.show', { id: carId }], queryFn: show, enabled: !! carId });
  const { data: branchList } = useQuery({ queryKey: ['branch.index'], queryFn: branches }); // the car form is the owner's
  useEffect(() => {
    if (data) {
      setValue(carToForm(data));
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const car = carId ? await update(carId, formToCarInput(value)) : await store(formToCarInput(value));
      if (photo) {
        // The car is saved either way: a failed upload must not make a retry create it twice.
        try {
          return await uploadPhoto(car.id, photo);
        } catch (uploadError) {
          requestError(uploadError);
        }
      }
      return car;
    },
    onSuccess: (car) => {
      for (const key of [ 'car.index', 'car.index.search', 'car.show', 'contract.index', 'dashboard', 'planning', 'report' ]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      router.replace('/cars/' + car.id);
    },
    onError: (error) => {
      const fieldErrors = serverFieldErrors(error);
      setErrors(fieldErrors);
      if (! Object.keys(fieldErrors).length) {
        requestError(error);
      }
    },
  });

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const missing: Record<string, string> = {};
    for (const [ field, fieldValue ] of Object.entries(value)) {
      if (! OPTIONAL.includes(field) && (fieldValue === null || fieldValue === '')) {
        missing[field] = 'validation:required';
      }
    }
    setErrors(missing);
    if (! Object.keys(missing).length) {
      save.mutate();
    }
  };

  if (carId && isLoading) {
    return <Loading />;
  }
  const set = (field: keyof CarFormValue) => (fieldValue: any) => setValue(current => ({ ...current, [field]: fieldValue }));
  const options = (prefix: string, values: number[]) => values.map(option => ({ label: prefix + option, value: option }));
  const error = (field: string) => errors[field] && <Typography variant='caption' color='error'>{t(errors[field])}</Typography>;

  return (
    <Page title={carId ? 'car:edit' : 'car:new'}>
      <Card>
        <CardContent component='form' onSubmit={onSubmit} noValidate>
          <Stack sx={{ gap: 3 }}>
            <PhotoInput label='car:photo' currentUrl={data?.photo_url} value={photo} onChange={setPhoto} />
            <Grid container spacing={2}>
              {TEXT_FIELDS.map(([ field, label ]) =>
                <Grid key={field} size={{ xs: 12, sm: 6, md: 4 }}>
                  <TextField
                    label={t(label)}
                    value={value[field]}
                    onChange={event => set(field)(event.target.value)}
                    required={! OPTIONAL.includes(field)}
                    error={!! errors[field]}
                    helperText={errors[field] && t(errors[field])}
                  />
                </Grid>
              )}
              {DATE_FIELDS.map(([ field, label ]) =>
                <Grid key={field} size={{ xs: 12, sm: 6, md: 3 }}>
                  <DateInput label={label} value={value[field]} onChange={set(field)} required max={field === 'first_circulation_date' ? new Date() : undefined} error={!! errors[field]} helperText={errors[field] && t(errors[field])} />
                </Grid>
              )}
            </Grid>
            <ColorField value={value.colour} onChange={set('colour')} />
            <Box><Choice label='car:status' value={value.status} onChange={set('status')} options={options('car:status:', [ STATUS_AVAILABLE, STATUS_MAINTENANCE, STATUS_OUT_OF_SERVICE ])} /></Box>
            <Box><Choice label='car:type' value={value.type} onChange={set('type')} options={options('car:type:', [ 1, 2 ])} error={!! errors.type} />{error('type')}</Box>
            <Box><Choice label='car:transmission_type' value={value.transmission_type} onChange={set('transmission_type')} options={options('car:transmission_type:', [ 1, 2 ])} error={!! errors.transmission_type} />{error('transmission_type')}</Box>
            {!! branchList?.length && <Choice label='car:branch' value={value.branch_id} onChange={set('branch_id')} options={[ { label: 'expense:branch:none', value: 0 }, ...branchList.map(branch => ({ label: branch.name, value: branch.id, raw: true })) ]} />}
            <Box><Choice label='car:fuel_type' value={value.fuel_type} onChange={set('fuel_type')} options={options('car:fuel_type:', [ 1, 2 ])} error={!! errors.fuel_type} />{error('fuel_type')}</Box>
            <Box><Button type='submit' variant='contained' size='large' loading={save.isPending}>{t('common:save')}</Button></Box>
          </Stack>
        </CardContent>
      </Card>
    </Page>
  );
}
