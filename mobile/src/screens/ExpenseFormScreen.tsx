import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { index as cars } from '../api/car';
import { store } from '../api/expense';
import { branches, employees, MONEY_QUERIES } from '../api/money';
import { employeeName } from '../classes/Employee';
import { AGENCY_CATEGORIES, CAR_CATEGORIES, CATEGORY_OIL_CHANGE, CATEGORY_PHONE, CATEGORY_RENT, CATEGORY_REPAIR, MAINTENANCE_CATEGORIES } from '../classes/Expense';
import { METHOD_CASH, METHODS } from '../classes/Payment';
import { useIsOwner, useLang } from '../store/hooks';
import { alertMessage, alertRequestError } from '../support/alert';
import { millimesFromInput } from '../support/money';
import ChipsField from '../components/Form/ChipsField';
import DateField from '../components/Form/DateField';
import TextField from '../components/Form/TextField';
import Button from '../components/ui/Button';
import FormScreen from '../components/ui/FormScreen';
import { ScreenProps } from '../navigation/types';
import { plate } from '../support/utils';

const AGENCY = 0; // "not a car": the agency's own cost

// Records a car cost (`carId`, from its page; `contractId`: a repair counted against that rental's
// client) or an agency cost (for a branch, or phone credit for an employee).
export default function ExpenseFormScreen({ route, navigation }: ScreenProps<'ExpenseFormScreen'>): React.JSX.Element {
  const presetCarId = route.params?.carId;
  const contractId = route.params?.contractId ?? null;
  const { selectedLang } = useLang();
  const isOwner = useIsOwner();
  const queryClient = useQueryClient();
  const isFixedCar = !! presetCarId || !! contractId;
  const { data: carList } = useQuery({ queryKey: ['car.index'], queryFn: cars, enabled: ! isFixedCar });
  const { data: branchList } = useQuery({ queryKey: ['branch.index'], queryFn: branches, enabled: isOwner && ! isFixedCar });
  const { data: employeeList } = useQuery({ queryKey: ['employee.index'], queryFn: employees, enabled: isOwner && ! isFixedCar });
  const FROM_CONTRACT = -1; // the API takes the car from the rental
  const [carId, setCarId] = useState<number|null>(presetCarId ?? (contractId ? FROM_CONTRACT : null));
  const [category, setCategory] = useState<number>(contractId ? CATEGORY_REPAIR : CATEGORY_OIL_CHANGE);
  const [branchId, setBranchId] = useState<number>(0);
  const [employeeId, setEmployeeId] = useState<number>(0);
  const [amount, setAmount] = useState('');
  const [spentAt, setSpentAt] = useState<Date|null>(new Date());
  const [mileage, setMileage] = useState('');
  const [garage, setGarage] = useState('');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState<number>(METHOD_CASH);
  const isAgency = carId === AGENCY;
  const isMaintenance = MAINTENANCE_CATEGORIES.includes(category);

  const changeTarget = (target: number) => {
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
      navigation.goBack();
    },
    onError: (error) => alertRequestError(selectedLang, error),
  });

  const onSavePress = () => {
    if (carId === null || ! millimesFromInput(amount) || ! spentAt || (mileage.trim() && ! /^\d+$/.test(mileage.trim()))) {
      alertMessage(selectedLang, 'expense:invalid');
      return;
    }
    save.mutate();
  };

  const categories = isAgency ? AGENCY_CATEGORIES : CAR_CATEGORIES;

  return (
    <FormScreen>
      {! isFixedCar && <ChipsField
        label='expense:for'
        value={carId}
        onChange={changeTarget}
        options={[ { label: 'expense:agency', value: AGENCY }, ...(carList ?? []).map(car => ({ label: plate(car.licence_plate), value: car.id })) ]}
      />}
      <ChipsField label='expense:category' value={category} onChange={setCategory} options={categories.map(value => ({ label: 'expense:category:' + value, value }))} />
      <TextField label='payment:amount' value={amount} onChange={setAmount} keyboardType='decimal-pad' />
      <DateField label='expense:date' value={spentAt} onChange={setSpentAt} maxDate={new Date()} />
      <ChipsField label='expense:method' value={method} onChange={setMethod} options={METHODS.map(value => ({ label: 'payment:method:' + value, value }))} />
      {isAgency && !! branchList?.length && <ChipsField
        label='expense:branch'
        value={branchId}
        onChange={setBranchId}
        options={[ { label: 'expense:branch:none', value: 0 }, ...branchList.map(branch => ({ label: branch.name, value: branch.id })) ]}
      />}
      {isAgency && category === CATEGORY_PHONE && !! employeeList?.length && <ChipsField
        label='expense:employee'
        value={employeeId}
        onChange={setEmployeeId}
        options={[ { label: 'expense:branch:none', value: 0 }, ...employeeList.filter(employee => employee.active).map(employee => ({ label: employeeName(employee), value: employee.id })) ]}
      />}
      {isMaintenance && <>
        <TextField label='handover:mileage' value={mileage} onChange={setMileage} keyboardType='number-pad' />
        <TextField label='expense:garage' value={garage} onChange={setGarage} />
      </>}
      <TextField label='contract:note' value={note} onChange={setNote} />
      <Button label='common:save' icon='check' onPress={onSavePress} isLoading={save.isPending} />
    </FormScreen>
  );
}
