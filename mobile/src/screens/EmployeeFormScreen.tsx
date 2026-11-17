import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MONEY_QUERIES, saveEmployee } from '../api/money';
import Employee from '../classes/Employee';
import { useLang } from '../store/hooks';
import { alertMessage, alertRequestError } from '../support/alert';
import { millimesFromInput, priceInputFromMillimes } from '../support/money';
import ChipsField from '../components/Form/ChipsField';
import DateField from '../components/Form/DateField';
import PhoneField from '../components/Form/PhoneField';
import TextField from '../components/Form/TextField';
import { toMaskedPhone } from '../components/client/clientForm';
import Button from '../components/ui/Button';
import FormScreen from '../components/ui/FormScreen';
import { ScreenProps } from '../navigation/types';

// Adds an employee (a mechanic or a washer needs no login), or edits one passed as `employee`.
export default function EmployeeFormScreen({ route, navigation }: ScreenProps<'EmployeeFormScreen'>): React.JSX.Element {
  const employee: Employee|undefined = route.params?.employee;
  const { selectedLang } = useLang();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState(employee?.first_name ?? '');
  const [lastName, setLastName] = useState(employee?.last_name ?? '');
  const [phone, setPhone] = useState(employee?.phone ? toMaskedPhone(employee.phone) : '+216 ');
  const [role, setRole] = useState(employee?.role_label ?? '');
  const [salary, setSalary] = useState(employee?.monthly_salary ? priceInputFromMillimes(employee.monthly_salary) : '');
  const [hiredAt, setHiredAt] = useState<Date|null>(employee?.hired_at ? new Date(employee.hired_at * 1000) : null);
  const [active, setActive] = useState(employee?.active ?? true);

  const save = useMutation({
    mutationFn: () => {
      const cleanPhone = phone.replaceAll(' ', '');
      return saveEmployee({
        first_name: firstName.trim(), last_name: lastName.trim() || null, phone: cleanPhone.length > 4 ? cleanPhone : null,
        role_label: role.trim() || null, monthly_salary: millimesFromInput(salary) ?? 0,
        hired_at: hiredAt ? Math.floor(hiredAt.getTime() / 1000) : null, active, user_id: employee?.user_id ?? null,
      }, employee?.id);
    },
    onSuccess: () => {
      MONEY_QUERIES.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
      navigation.goBack();
    },
    onError: (error) => alertRequestError(selectedLang, error),
  });

  return (
    <FormScreen>
      <TextField label='form:first_name:label' value={firstName} onChange={setFirstName} />
      <TextField label='form:last_name:label' value={lastName} onChange={setLastName} />
      <PhoneField label='form:phone:label' value={phone} onChange={setPhone} />
      <TextField label='payroll:role' value={role} onChange={setRole} />
      <TextField label='payroll:salary:dinars' value={salary} onChange={setSalary} keyboardType='decimal-pad' />
      <DateField label='payroll:hired_at' value={hiredAt} onChange={setHiredAt} maxDate={new Date()} />
      {employee && <ChipsField label='payroll:status' value={active} onChange={setActive} options={[ { label: 'payroll:active', value: true }, { label: 'payroll:inactive', value: false } ]} />}
      <Button label='common:save' icon='check' isLoading={save.isPending} onPress={() => firstName.trim() ? save.mutate() : alertMessage(selectedLang, 'payroll:invalid')} />
    </FormScreen>
  );
}
