import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import { MONEY_QUERIES, saveEmployee } from '../api/money';
import Employee from '../classes/Employee';
import { PHONE_REGEX } from '../constants';
import { useT } from '../store/Store';
import { millimesFromInput, priceInputFromMillimes } from '../support/money';
import { toMaskedPhone } from '../support/utils';
import { useFeedback } from './Feedback';
import { Choice, DateInput } from './common';

// Adds an employee (a mechanic or a washer needs no login), or edits `employee`.
export default function EmployeeDialog({ employee, onClose }: { employee: Employee|null, onClose: () => void }) {
  const t = useT();
  const queryClient = useQueryClient();
  const { notify, requestError } = useFeedback();
  const [firstName, setFirstName] = useState(employee?.first_name ?? '');
  const [lastName, setLastName] = useState(employee?.last_name ?? '');
  const [phone, setPhone] = useState(employee?.phone ? toMaskedPhone(employee.phone) : '+216 ');
  const [role, setRole] = useState(employee?.role_label ?? '');
  const [salary, setSalary] = useState(employee?.monthly_salary ? priceInputFromMillimes(employee.monthly_salary) : '');
  const [hiredAt, setHiredAt] = useState<Date|null>(employee?.hired_at ? new Date(employee.hired_at * 1000) : null);
  const [active, setActive] = useState(employee?.active ?? true);
  const cleanPhone = phone.replaceAll(' ', '');
  const save = useMutation({
    mutationFn: () => saveEmployee({
      first_name: firstName.trim(), last_name: lastName.trim() || null, phone: cleanPhone.length > 4 ? cleanPhone : null,
      role_label: role.trim() || null, monthly_salary: millimesFromInput(salary) ?? 0,
      hired_at: hiredAt ? Math.floor(hiredAt.getTime() / 1000) : null, active, user_id: employee?.user_id ?? null,
    }, employee?.id),
    onSuccess: () => {
      MONEY_QUERIES.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
      onClose();
    },
    onError: requestError,
  });
  const onSave = () => ! firstName.trim() || (cleanPhone.length > 4 && ! PHONE_REGEX.test(cleanPhone)) ? notify('payroll:invalid', 'error') : save.mutate();

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth='sm'>
      <DialogTitle>{t('payroll:employee')}</DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 2.5, pt: 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
            <TextField label={t('form:first_name:label')} value={firstName} onChange={event => setFirstName(event.target.value)} required />
            <TextField label={t('form:last_name:label')} value={lastName} onChange={event => setLastName(event.target.value)} />
          </Stack>
          <TextField label={t('form:phone:label')} value={phone} onChange={event => setPhone(event.target.value)} type='tel' />
          <TextField label={t('payroll:role')} value={role} onChange={event => setRole(event.target.value)} />
          <TextField label={t('payroll:salary:dinars')} value={salary} onChange={event => setSalary(event.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
          <DateInput label='payroll:hired_at' value={hiredAt} onChange={setHiredAt} max={new Date()} />
          {employee && <Choice label='payroll:status' value={active} onChange={setActive} options={[ { label: 'payroll:active', value: true }, { label: 'payroll:inactive', value: false } ]} />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common:cancel')}</Button>
        <Button variant='contained' loading={save.isPending} onClick={onSave}>{t('common:save')}</Button>
      </DialogActions>
    </Dialog>
  );
}
