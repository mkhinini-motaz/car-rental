import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { show } from '../api/car';
import { MONEY_QUERIES, updatePurchase } from '../api/money';
import { useLang } from '../store/hooks';
import { alertMessage, alertRequestError } from '../support/alert';
import { millimesFromInput, priceInputFromMillimes } from '../support/money';
import DateField from '../components/Form/DateField';
import TextField from '../components/Form/TextField';
import FullScreenLoader from '../components/common/FullScreenLoader';
import TranslatableText from '../components/common/TranslatableText';
import Button from '../components/ui/Button';
import FormScreen from '../components/ui/FormScreen';
import { ScreenProps } from '../navigation/types';

const MONEY = [ 'purchase_price', 'purchase_fees', 'advance', 'instalment_amount', 'expected_sale_price', 'earned_before' ] as const;
const toDate = (timestamp: number|null|undefined) => timestamp ? new Date(timestamp * 1000) : null;
const toTimestamp = (date: Date|null) => date ? Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9).getTime() / 1000) : null;

// What the car cost and how it's paid for (owner): price, fees, supplier, a credit or leasing,
// and what it should fetch when it leaves the fleet.
export default function CarPurchaseFormScreen({ route, navigation }: ScreenProps<'CarPurchaseFormScreen'>): React.JSX.Element {
  const { carId } = route.params;
  const { selectedLang } = useLang();
  const queryClient = useQueryClient();
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
      navigation.goBack();
    },
    onError: (error) => alertRequestError(selectedLang, error),
  });

  if (! value) {
    return <FullScreenLoader />;
  }

  const field = (name: string, label: string, keyboardType: 'decimal-pad'|'number-pad'|'default' = 'decimal-pad') =>
    <TextField label={label} value={value[name]} onChange={text => setValue({ ...value, [name]: text })} keyboardType={keyboardType} />;
  const onSavePress = () => {
    const hasCredit = value.instalment_amount.trim() || value.instalment_months.trim();
    const isInvalid = MONEY.some(name => value[name].trim() && millimesFromInput(value[name]) === null)
      || (hasCredit && (! millimesFromInput(value.instalment_amount) || ! /^\d+$/.test(value.instalment_months.trim())))
      || ! /^\d*$/.test(value.instalments_paid_before.trim());
    if (isInvalid) {
      alertMessage(selectedLang, 'car:purchase:invalid');
      return;
    }
    save.mutate();
  };

  return (
    <FormScreen>
      {field('purchase_price', 'car:purchase_price:dinars')}
      <DateField label='car:bought_at' value={boughtAt} onChange={setBoughtAt} maxDate={new Date()} />
      {field('purchase_fees', 'car:purchase_fees:dinars')}
      {field('supplier', 'car:supplier', 'default')}
      <TranslatableText data='car:financing' className='text-title font-semibold text-ink mt-2' />
      <TranslatableText data='car:financing:hint' className='text-meta text-muted' />
      {field('advance', 'car:advance')}
      {field('instalment_amount', 'car:financing:instalment:dinars')}
      {field('instalment_months', 'car:financing:months', 'number-pad')}
      <DateField label='car:financing:first' value={firstInstalmentAt} onChange={setFirstInstalmentAt} />
      {field('instalments_paid_before', 'car:financing:paid_before', 'number-pad')}
      {field('lender', 'car:lender', 'default')}
      <TranslatableText data='car:before_app' className='text-title font-semibold text-ink mt-2' />
      <TranslatableText data='car:before_app:hint' className='text-meta text-muted' />
      {field('earned_before', 'car:earned_before:dinars')}
      <TranslatableText data='car:fleet_deadline' className='text-title font-semibold text-ink mt-2' />
      {field('expected_sale_price', 'car:expected_sale_price:dinars')}
      <Button label='common:save' icon='check' onPress={onSavePress} isLoading={save.isPending} />
    </FormScreen>
  );
}
