import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MONEY_QUERIES, sell } from '../api/money';
import { METHOD_TRANSFER, METHODS } from '../classes/Payment';
import { useLang } from '../store/hooks';
import { alertConfirm, alertMessage, alertRequestError, validationErrors } from '../support/alert';
import { millimesFromInput } from '../support/money';
import ChipsField from '../components/Form/ChipsField';
import DateField from '../components/Form/DateField';
import PhoneField from '../components/Form/PhoneField';
import TextField from '../components/Form/TextField';
import TranslatableText from '../components/common/TranslatableText';
import Button from '../components/ui/Button';
import FormScreen from '../components/ui/FormScreen';
import { ScreenProps } from '../navigation/types';

// Sells the car (owner): it leaves the fleet, the planning and booking, and keeps its history.
export default function CarSaleFormScreen({ route, navigation }: ScreenProps<'CarSaleFormScreen'>): React.JSX.Element {
  const { carId } = route.params;
  const { selectedLang } = useLang();
  const queryClient = useQueryClient();
  const [price, setPrice] = useState('');
  const [buyer, setBuyer] = useState('');
  const [phone, setPhone] = useState('+216 ');
  const [method, setMethod] = useState<number>(METHOD_TRANSFER);
  const [soldAt, setSoldAt] = useState<Date|null>(new Date());

  const save = useMutation({
    mutationFn: () => {
      const buyerPhone = phone.replaceAll(' ', '');
      return sell(carId, {
        sale_price: millimesFromInput(price)!,
        buyer_name: buyer.trim(),
        buyer_phone: buyerPhone.length > 4 ? buyerPhone : null,
        sale_method: method,
        sold_at: soldAt ? Math.floor(soldAt.getTime() / 1000) : undefined,
      });
    },
    onSuccess: () => {
      MONEY_QUERIES.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
      queryClient.invalidateQueries({ queryKey: ['planning'] });
      navigation.goBack();
    },
    onError: (error) => validationErrors(error).car ? alertMessage(selectedLang, 'car:sale:busy') : alertRequestError(selectedLang, error),
  });

  const onSavePress = () => {
    if (! millimesFromInput(price) || ! buyer.trim()) {
      alertMessage(selectedLang, 'car:sale:invalid');
      return;
    }
    alertConfirm(selectedLang, 'car:sale:confirm', () => save.mutate());
  };

  return (
    <FormScreen>
      <TranslatableText data='car:sale:hint' className='text-body text-muted' />
      <TextField label='car:sale:price:dinars' value={price} onChange={setPrice} keyboardType='decimal-pad' />
      <TextField label='car:sale:buyer' value={buyer} onChange={setBuyer} />
      <PhoneField label='form:phone:label' value={phone} onChange={setPhone} />
      <ChipsField label='expense:method' value={method} onChange={setMethod} options={METHODS.map(value => ({ label: 'payment:method:' + value, value }))} />
      <DateField label='car:sale:date' value={soldAt} onChange={setSoldAt} maxDate={new Date()} />
      <Button label='car:sell' icon='handshake-outline' onPress={onSavePress} isLoading={save.isPending} />
    </FormScreen>
  );
}
