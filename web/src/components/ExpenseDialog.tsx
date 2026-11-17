import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import { index as cars } from '../api/car';
import { store } from '../api/expense';
import { branches, employees, MONEY_QUERIES } from '../api/money';
import { employeeName } from '../classes/Employee';
import { AGENCY_CATEGORIES, CAR_CATEGORIES, CATEGORY_OIL_CHANGE, CATEGORY_PHONE, CATEGORY_RENT, CATEGORY_REPAIR, MAINTENANCE_CATEGORIES } from '../classes/Expense';
import { METHOD_CASH, METHODS } from '../classes/Payment';
import { useIsOwner, useT } from '../store/Store';
import { millimesFromInput } from '../support/money';
import { useFeedback } from './Feedback';
import { Choice, DateInput } from './common';
import { plate } from '../support/utils';

const AGENCY = 0; // "not a car": the agency's own cost
const FROM_CONTRACT = -1; // the API takes the car from the rental

// Records a car cost (`carId`, from its page; `contractId`: a repair counted against that rental's
// client) or an agency cost (for a branch, or phone credit for an employee).
export default function ExpenseDialog({ open, onClose, carId: presetCarId, contractId = null }: { open: boolean, onClose: () => void, carId?: number, contractId?: number|null }) {
  const t = useT();
  const isOwner = useIsOwner();
  const queryClient = useQueryClient();
  const { notify, requestError } = useFeedback();
  const isFixedCar = !! presetCarId || !! contractId;
  const { data: carList } = useQuery({ queryKey: ['car.index'], queryFn: cars, enabled: open && ! isFixedCar });
  const { data: branchList } = useQuery({ queryKey: ['branch.index'], queryFn: branches, enabled: open && isOwner && ! isFixedCar });
  const { data: employeeList } = useQuery({ queryKey: ['employee.index'], queryFn: employees, enabled: open && isOwner && ! isFixedCar });
  const initialTarget = presetCarId ?? (contractId ? FROM_CONTRACT : null);
  const [carId, setCarId] = useState<number|null>(initialTarget);
  const [category, setCategory] = useState<number>(contractId ? CATEGORY_REPAIR : CATEGORY_OIL_CHANGE);
  const [branchId, setBranchId] = useState(0);
  const [employeeId, setEmployeeId] = useState(0);
  const [amount, setAmount] = useState('');
  const [spentAt, setSpentAt] = useState<Date|null>(new Date());
  const [mileage, setMileage] = useState('');
  const [garage, setGarage] = useState('');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState<number>(METHOD_CASH);
  const isAgency = carId === AGENCY;
  const isMaintenance = MAINTENANCE_CATEGORIES.includes(category);
  useEffect(() => {
    if (open) {
      setCarId(initialTarget);
      setCategory(contractId ? CATEGORY_REPAIR : CATEGORY_OIL_CHANGE);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeTarget = (target: number|null) => {
    setCarId(target);
    setCategory(target === AGENCY ? CATEGORY_RENT : CATEGORY_OIL_CHANGE);
  };

  const save = useMutation({
    mutationFn: () => store({
      car_id: isAgency || contractId ? null : carId,
      contract_id: contractId,
      branch_id: isAgency && branchId ? branchId : null,
      employee_id: isAgency && category === CATEGORY_PHONE && employeeId ? employeeId : null,
      category,
      amount: millimesFromInput(amount)!,
      spent_at: Math.floor(spentAt!.getTime() / 1000),
      mileage: isMaintenance && mileage.trim() ? Number(mileage) : null,
      garage: garage.trim() || null,
      note: note.trim() || null,
      method: method as 1,
    }),
    onSuccess: () => {
      MONEY_QUERIES.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
      queryClient.invalidateQueries({ queryKey: ['client.show'] });
      setAmount('');
      setMileage('');
      setGarage('');
      setNote('');
      onClose();
    },
    onError: requestError,
  });

  const onSave = () => {
    if (carId === null || ! millimesFromInput(amount) || ! spentAt || (mileage.trim() && ! /^\d+$/.test(mileage.trim()))) {
      notify('expense:invalid', 'error');
      return;
    }
    save.mutate();
  };
  const categories = isAgency ? AGENCY_CATEGORIES : CAR_CATEGORIES;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth='sm'>
      <DialogTitle>{t(contractId ? 'contract:repair' : 'expense:add')}</DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 2.5, pt: 1 }}>
          {! isFixedCar && <Choice
            label='expense:for'
            value={carId}
            onChange={changeTarget}
            options={[ { label: 'expense:agency', value: AGENCY }, ...(carList ?? []).map(car => ({ label: plate(car.licence_plate), value: car.id, raw: true })) ]}
          />}
          <Choice label='expense:category' value={category} onChange={setCategory} options={categories.map(value => ({ label: 'expense:category:' + value, value }))} />
          <TextField label={t('payment:amount')} value={amount} onChange={event => setAmount(event.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
          <DateInput label='expense:date' value={spentAt} onChange={setSpentAt} max={new Date()} />
          <Choice label='expense:method' value={method} onChange={setMethod} options={METHODS.map(value => ({ label: 'payment:method:' + value, value }))} />
          {isAgency && !! branchList?.length && <Choice
            label='expense:branch'
            value={branchId}
            onChange={setBranchId}
            options={[ { label: 'expense:branch:none', value: 0 }, ...branchList.map(branch => ({ label: branch.name, value: branch.id, raw: true })) ]}
          />}
          {isAgency && category === CATEGORY_PHONE && !! employeeList?.length && <Choice
            label='expense:employee'
            value={employeeId}
            onChange={setEmployeeId}
            options={[ { label: 'expense:branch:none', value: 0 }, ...employeeList.filter(employee => employee.active).map(employee => ({ label: employeeName(employee), value: employee.id, raw: true })) ]}
          />}
          {isMaintenance && <>
            <TextField label={t('handover:mileage')} value={mileage} onChange={event => setMileage(event.target.value)} slotProps={{ htmlInput: { inputMode: 'numeric' } }} />
            <TextField label={t('expense:garage')} value={garage} onChange={event => setGarage(event.target.value)} />
          </>}
          <TextField label={t('contract:note')} value={note} onChange={event => setNote(event.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common:cancel')}</Button>
        <Button variant='contained' onClick={onSave} loading={save.isPending}>{t('common:save')}</Button>
      </DialogActions>
    </Dialog>
  );
}
