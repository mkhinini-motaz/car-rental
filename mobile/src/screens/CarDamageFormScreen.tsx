import { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { show, storeDamages } from '../api/car';
import { useLang } from '../store/hooks';
import { alertMessage, alertRequestError } from '../support/alert';
import { useFieldStyles } from '../components/Form/fieldStyles';
import LangAwareView from '../components/common/LangAwareView';
import TranslatableText from '../components/common/TranslatableText';
import CarOutline, { DamageMark } from '../components/contract/CarOutline';
import { DamageList } from '../components/contract/Inspection';
import Button from '../components/ui/Button';
import FormScreen from '../components/ui/FormScreen';
import Icon from '../components/ui/Icon';
import { ScreenProps } from '../navigation/types';
import { useColors } from '../store/ThemeContext';

// The damage a car already has, marked on its outline outside a handover (a car that came into the
// app with its scratches): nobody is charged for it, and its next handovers show it until repaired.
export default function CarDamageFormScreen({ route, navigation }: ScreenProps<'CarDamageFormScreen'>): React.JSX.Element {
  const COLORS = useColors();
  const { carId } = route.params;
  const { selectedLang, selectedLangWriteFrom } = useLang();
  const fieldStyles = useFieldStyles();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['car.show', { id: carId }], queryFn: show });
  const open = data?.damages?.filter(damage => ! damage.repaired_at) ?? [];
  const [damages, setDamages] = useState<(DamageMark & { note: string })[]>([]);

  const save = useMutation({
    mutationFn: () => storeDamages(carId, damages.map(damage => ({ x: damage.x, y: damage.y, note: damage.note.trim() || null }))),
    onSuccess: () => {
      [ 'car.show', 'contract.show' ].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
      navigation.goBack();
    },
    onError: (error) => alertRequestError(selectedLang, error),
  });

  return (
    <FormScreen>
      <TranslatableText data='damage:mark:hint' className='text-body text-muted' />
      <CarOutline older={open} marks={damages} onPress={(mark) => setDamages(current => [ ...current, { ...mark, note: '' } ])} />
      {open.length > 0 && <View className='gap-y-1'>
        <TranslatableText data='inspection:damages:open' className='text-body font-semibold' style={{ color: COLORS.warn }} />
        <DamageList damages={open} amounts={false} />
      </View>}
      {damages.map((damage, index) =>
        <LangAwareView key={index} className='gap-x-2 items-center'>
          <Text className='text-body font-semibold text-ink'>{index + 1}.</Text>
          <TextInput
            value={damage.note}
            onChangeText={(note) => setDamages(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, note } : item))}
            placeholder='...'
            textAlign={selectedLangWriteFrom}
            style={{ ...fieldStyles.input, flex: 1 }}
          />
          <TouchableOpacity onPress={() => setDamages(current => current.filter((_item, itemIndex) => itemIndex !== index))} hitSlop={8}>
            <Icon name='delete-outline' size={24} color={COLORS.danger} />
          </TouchableOpacity>
        </LangAwareView>
      )}
      <Button
        label='common:save'
        icon='check'
        isLoading={save.isPending}
        onPress={() => damages.length ? save.mutate() : alertMessage(selectedLang, 'damage:mark:none')}
      />
    </FormScreen>
  );
}
