import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography } from '@mui/material';
import DeleteOutline from '@mui/icons-material/DeleteOutlined';
import { repairDamage, storeDamages } from '../api/car';
import { invalidateContractQueries, storePast } from '../api/contract';
import Car from '../classes/Car';
import Client from '../classes/Client';
import { MONEY_QUERIES, paySalary, sell, storeIncome } from '../api/money';
import Employee, { employeeName, TYPE_SALARY, TYPES } from '../classes/Employee';
import { CATEGORIES, CATEGORY_INSURANCE_PAYOUT } from '../classes/Income';
import { ContractDamage } from '../classes/Inspection';
import { METHOD_CASH, METHOD_TRANSFER, METHODS } from '../classes/Payment';
import { PHONE_REGEX } from '../constants';
import { useT } from '../store/Store';
import { validationErrors } from '../support/alert';
import { millimesFromInput, priceInputFromMillimes } from '../support/money';
import { diffInDays } from '../support/utils';
import { COLORS } from '../constants';
import { ClientPicker } from './client';
import { useFeedback } from './Feedback';
import { CarOutline, DamageList, DamageMark } from './inspection';
import { Choice, DateInput, DateTimeInput, useMoney } from './common';

const methodOptions = METHODS.map(value => ({ label: 'payment:method:' + value, value }));

function useSaved(onClose: () => void, extra: string[] = []) {
  const queryClient = useQueryClient();
  return () => {
    [ ...MONEY_QUERIES, ...extra ].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
    onClose();
  };
}

function Frame({ title, onClose, onSave, isSaving, saveLabel = 'common:save', children }: { title: string, onClose: () => void, onSave: () => void, isSaving: boolean, saveLabel?: string, children: React.ReactNode }) {
  const t = useT();
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth='sm'>
      <DialogTitle>{t(title)}</DialogTitle>
      <DialogContent><Stack sx={{ gap: 2.5, pt: 1 }}>{children}</Stack></DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common:cancel')}</Button>
        <Button variant='contained' onClick={onSave} loading={isSaving}>{t(saveLabel)}</Button>
      </DialogActions>
    </Dialog>
  );
}

// Money received that isn't rent (owner): an insurance payout, parts sold... on a car or not.
export function IncomeDialog({ carId = null, onClose }: { carId?: number|null, onClose: () => void }) {
  const t = useT();
  const { notify, requestError } = useFeedback();
  const [category, setCategory] = useState<number>(CATEGORY_INSURANCE_PAYOUT);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<number>(METHOD_CASH);
  const [receivedAt, setReceivedAt] = useState<Date|null>(new Date());
  const [note, setNote] = useState('');
  const save = useMutation({
    mutationFn: () => storeIncome({
      car_id: carId, category, amount: millimesFromInput(amount)!, method: method as 1, note: note.trim() || null,
      received_at: receivedAt ? Math.floor(receivedAt.getTime() / 1000) : undefined,
    }),
    onSuccess: useSaved(onClose),
    onError: requestError,
  });

  return (
    <Frame title='income:add' onClose={onClose} isSaving={save.isPending} onSave={() => millimesFromInput(amount) ? save.mutate() : notify('payment:amount:invalid', 'error')}>
      <Choice label='income:category' value={category} onChange={setCategory} options={CATEGORIES.map(value => ({ label: 'income:category:' + value, value }))} />
      <TextField label={t('payment:amount')} value={amount} onChange={event => setAmount(event.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
      <Choice label='income:method' value={method} onChange={setMethod} options={methodOptions} />
      <DateInput label='income:date' value={receivedAt} onChange={setReceivedAt} max={new Date()} />
      <TextField label={t('contract:note')} value={note} onChange={event => setNote(event.target.value)} />
    </Frame>
  );
}

// A damage on the car is repaired: it stops showing at handovers. The cost, if typed, is the car's expense.
export function DamageRepairDialog({ carId, damage, onClose }: { carId: number, damage: ContractDamage, onClose: () => void }) {
  const t = useT();
  const { notify, requestError } = useFeedback();
  const [repairedAt, setRepairedAt] = useState<Date|null>(new Date());
  const [amount, setAmount] = useState('');
  const [garage, setGarage] = useState('');
  const save = useMutation({
    mutationFn: () => repairDamage(carId, damage.id, {
      repaired_at: Math.floor((repairedAt ?? new Date()).getTime() / 1000),
      amount: amount.trim() ? millimesFromInput(amount) : null,
      garage: garage.trim() || null,
    }),
    onSuccess: useSaved(onClose, [ 'contract.show', 'client.show' ]),
    onError: requestError,
  });

  return (
    <Frame title='damage:repair' saveLabel='damage:repair' onClose={onClose} isSaving={save.isPending} onSave={() => amount.trim() && ! millimesFromInput(amount) ? notify('payment:amount:invalid', 'error') : save.mutate()}>
      <Typography sx={{ fontWeight: 600 }}>{damage.note || '—'}</Typography>
      <DateInput label='damage:repaired_at' value={repairedAt} onChange={setRepairedAt} max={new Date()} />
      <TextField label={t('damage:repair:cost')} value={amount} onChange={event => setAmount(event.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
      <TextField label={t('expense:garage')} value={garage} onChange={event => setGarage(event.target.value)} />
    </Frame>
  );
}

// The damage a car already has, marked on its outline outside a handover (a car that came into the
// app with its scratches): nobody is charged for it, and its next handovers show it until repaired.
export function CarDamageDialog({ car, onClose }: { car: Car, onClose: () => void }) {
  const t = useT();
  const queryClient = useQueryClient();
  const { notify, requestError } = useFeedback();
  const open = car.damages?.filter(damage => ! damage.repaired_at) ?? [];
  const [damages, setDamages] = useState<(DamageMark & { note: string })[]>([]);
  const save = useMutation({
    mutationFn: () => storeDamages(car.id, damages.map(damage => ({ x: damage.x, y: damage.y, note: damage.note.trim() || null }))),
    onSuccess: () => {
      [ 'car.show', 'contract.show' ].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
      onClose();
    },
    onError: requestError,
  });

  return (
    <Frame title='damage:mark' onClose={onClose} isSaving={save.isPending} onSave={() => damages.length ? save.mutate() : notify('damage:mark:none', 'error')}>
      <Typography color='text.secondary'>{t('damage:mark:hint')}</Typography>
      <CarOutline older={open} marks={damages} onMark={mark => setDamages(current => [ ...current, { ...mark, note: '' } ])} />
      {open.length > 0 && <Box>
        <Typography sx={{ fontWeight: 600, color: COLORS.warn }}>{t('inspection:damages:open')}</Typography>
        <DamageList damages={open} amounts={false} />
      </Box>}
      {damages.map((damage, index) =>
        <Stack key={index} direction='row' sx={{ gap: 1, alignItems: 'center' }}>
          <Typography sx={{ fontWeight: 700 }}>{index + 1}.</Typography>
          <TextField
            value={damage.note}
            onChange={event => setDamages(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, note: event.target.value } : item))}
            placeholder='...'
            sx={{ flex: 1 }}
            slotProps={{ htmlInput: { 'aria-label': (index + 1) + '. ' + t('contract:note') } }}
          />
          <IconButton color='error' aria-label={t('common:remove')} onClick={() => setDamages(current => current.filter((_item, itemIndex) => itemIndex !== index))}><DeleteOutline /></IconButton>
        </Stack>
      )}
    </Frame>
  );
}

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Math.floor((Date.now() - days * DAY) / 3600000) * 3600000);

// A rental from the paper notebook, entered in one go on this car: no inspection, no papers asked.
// Paid in full it is closed; otherwise it stays returned with the rest owed.
export function PastRentalDialog({ car, onClose }: { car: Car, onClose: () => void }) {
  const t = useT();
  const money = useMoney();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { notify, requestError } = useFeedback();
  const [client, setClient] = useState<Client|null>(null);
  const [startsAt, setStartsAt] = useState(() => daysAgo(7));
  const [endsAt, setEndsAt] = useState(() => daysAgo(4));
  const [price, setPrice] = useState(() => priceInputFromMillimes(car.daily_price));
  const [paid, setPaid] = useState(''); // empty: in full
  const [method, setMethod] = useState<number>(METHOD_CASH);
  const [pickupMileage, setPickupMileage] = useState('');
  const [returnMileage, setReturnMileage] = useState('');
  const [note, setNote] = useState('');
  const from = Math.floor(startsAt.getTime() / 1000);
  const to = Math.floor(endsAt.getTime() / 1000);
  const total = Math.round((millimesFromInput(price) ?? 0) * diffInDays(from, to));
  const mileage = (value: string) => value.trim() ? parseInt(value.replace(/\D/g, ''), 10) : null;
  const save = useMutation({
    mutationFn: () => storePast({
      car_id: car.id, client_id: client!.id, starts_at: from, ends_at: to, daily_price: millimesFromInput(price)!,
      paid: paid.trim() ? millimesFromInput(paid) : null, method,
      pickup_mileage: mileage(pickupMileage), return_mileage: mileage(returnMileage), note: note.trim() || null,
    }),
    onSuccess: (contract) => {
      invalidateContractQueries(queryClient);
      router.push('/contracts/' + contract.id);
    },
    onError: requestError,
  });
  const onSave = () => {
    if (! client) {
      notify('client:required', 'error');
    } else if (! millimesFromInput(price)) {
      notify('contract:price:invalid', 'error');
    } else if (paid.trim() && millimesFromInput(paid) === null) {
      notify('payment:amount:invalid', 'error');
    } else if (to <= from || to > Date.now() / 1000) {
      notify('contract:past:dates', 'error');
    } else {
      save.mutate();
    }
  };

  return (
    <Frame title='contract:past:add' saveLabel='contract:past:save' onClose={onClose} isSaving={save.isPending} onSave={onSave}>
      <Typography color='text.secondary'>{t('contract:past:hint')}</Typography>
      <ClientPicker value={client} onChange={setClient} />
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
        <DateTimeInput label='contract:starts_at' value={startsAt} onChange={setStartsAt} max={new Date()} />
        <DateTimeInput label='contract:ends_at' value={endsAt} onChange={setEndsAt} min={startsAt} max={new Date()} />
      </Stack>
      <TextField label={t('contract:daily_price')} value={price} onChange={event => setPrice(event.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
      <Typography sx={{ fontWeight: 600 }}>{t('reservation:total', { price: money(total) })}</Typography>
      <TextField label={t('contract:past:paid')} value={paid} onChange={event => setPaid(event.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
      <Choice label='expense:method' value={method} onChange={setMethod} options={methodOptions} />
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
        <TextField label={t('contract:past:mileage:pickup')} value={pickupMileage} onChange={event => setPickupMileage(event.target.value)} slotProps={{ htmlInput: { inputMode: 'numeric' } }} />
        <TextField label={t('contract:past:mileage:return')} value={returnMileage} onChange={event => setReturnMileage(event.target.value)} slotProps={{ htmlInput: { inputMode: 'numeric' } }} />
      </Stack>
      <TextField label={t('contract:note')} value={note} onChange={event => setNote(event.target.value)} multiline minRows={2} />
    </Frame>
  );
}

// Sells the car (owner): it leaves the fleet, the planning and booking, and keeps its history.
export function SaleDialog({ carId, onClose }: { carId: number, onClose: () => void }) {
  const t = useT();
  const { notify, confirm, requestError } = useFeedback();
  const [price, setPrice] = useState('');
  const [buyer, setBuyer] = useState('');
  const [phone, setPhone] = useState('+216 ');
  const [method, setMethod] = useState<number>(METHOD_TRANSFER);
  const [soldAt, setSoldAt] = useState<Date|null>(new Date());
  const save = useMutation({
    mutationFn: () => {
      const buyerPhone = phone.replaceAll(' ', '');
      return sell(carId, {
        sale_price: millimesFromInput(price)!, buyer_name: buyer.trim(), buyer_phone: buyerPhone.length > 4 ? buyerPhone : null,
        sale_method: method, sold_at: soldAt ? Math.floor(soldAt.getTime() / 1000) : undefined,
      });
    },
    onSuccess: useSaved(onClose, [ 'planning' ]),
    onError: (error) => validationErrors(error).car ? notify('car:sale:busy', 'error') : requestError(error),
  });
  const onSave = async () => {
    const buyerPhone = phone.replaceAll(' ', '');
    if (! millimesFromInput(price) || ! buyer.trim() || (buyerPhone.length > 4 && ! PHONE_REGEX.test(buyerPhone))) {
      notify('car:sale:invalid', 'error');
    } else if (await confirm('car:sale:confirm')) {
      save.mutate();
    }
  };

  return (
    <Frame title='car:sell' saveLabel='car:sell' onClose={onClose} isSaving={save.isPending} onSave={onSave}>
      <Typography color='text.secondary'>{t('car:sale:hint')}</Typography>
      <TextField label={t('car:sale:price:dinars')} value={price} onChange={event => setPrice(event.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
      <TextField label={t('car:sale:buyer')} value={buyer} onChange={event => setBuyer(event.target.value)} />
      <TextField label={t('form:phone:label')} value={phone} onChange={event => setPhone(event.target.value)} type='tel' />
      <Choice label='expense:method' value={method} onChange={setMethod} options={methodOptions} />
      <DateInput label='car:sale:date' value={soldAt} onChange={setSoldAt} max={new Date()} />
    </Frame>
  );
}

// Pays an employee for this month: a salary, an advance or a bonus, in cash (the cash book) or by bank.
export function SalaryDialog({ employee, type: presetType, amount: presetAmount, onClose }: { employee: Employee, type?: number, amount?: number, onClose: () => void }) {
  const t = useT();
  const { notify, requestError } = useFeedback();
  const [type, setType] = useState<number>(presetType ?? TYPE_SALARY);
  const [amount, setAmount] = useState(presetAmount ? priceInputFromMillimes(presetAmount) : '');
  const [method, setMethod] = useState<number>(METHOD_CASH);
  const [note, setNote] = useState('');
  const save = useMutation({
    mutationFn: () => paySalary(employee.id, { type: type as 1, amount: millimesFromInput(amount)!, method: method as 1, note: note.trim() || null }),
    onSuccess: useSaved(onClose),
    onError: requestError,
  });

  return (
    <Frame title='payroll:pay' onClose={onClose} isSaving={save.isPending} onSave={() => millimesFromInput(amount) ? save.mutate() : notify('payment:amount:invalid', 'error')}>
      <Typography variant='h6'>{t('payroll:paying', { name: employeeName(employee) })}</Typography>
      <Choice label='payroll:type' value={type} onChange={setType} options={TYPES.map(value => ({ label: 'payroll:type:' + value + ':short', value }))} />
      <TextField label={t('payment:amount')} value={amount} onChange={event => setAmount(event.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
      <Choice label='expense:method' value={method} onChange={setMethod} options={methodOptions} />
      <TextField label={t('contract:note')} value={note} onChange={event => setNote(event.target.value)} />
    </Frame>
  );
}

// "Paid how?" before paying an instalment or a bill from the Today page: nothing is paid by itself.
export function PayHowDialog({ title, onPay, onClose }: { title: string, onPay: (method: number) => void, onClose: () => void }) {
  const t = useT();
  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent><Typography>{t('today:pay:how')}</Typography></DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common:cancel')}</Button>
        <Button variant='outlined' onClick={() => onPay(METHOD_TRANSFER)}>{t('payment:method:' + METHOD_TRANSFER)}</Button>
        <Button variant='contained' onClick={() => onPay(METHOD_CASH)}>{t('payment:method:' + METHOD_CASH)}</Button>
      </DialogActions>
    </Dialog>
  );
}
