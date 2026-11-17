import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import KeyboardScroll from '../components/ui/KeyboardScroll';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pricing, updatePricing } from '../api/agency';
import { useLang, useNetworkErrorAlert } from '../store/hooks';
import { alertMessage, alertRequestError, validationErrors } from '../support/alert';
import { millimesFromInput, priceInputFromMillimes } from '../support/money';
import FullScreenLoader from '../components/common/FullScreenLoader';
import LangAwareView from '../components/common/LangAwareView';
import Card from '../components/ui/Card';
import TranslatableText from '../components/common/TranslatableText';
import ChipsField from '../components/Form/ChipsField';
import Button from '../components/ui/Button';
import ErrorState from '../components/ui/ErrorState';
import Icon from '../components/ui/Icon';
import Screen from '../components/ui/Screen';
import { translate } from '../i18n';
import { ScreenProps } from '../navigation/types';
import { useColors } from '../store/ThemeContext';

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

function Input({ value, onChange, placeholder, flex = 1, numeric = false }: { value: string, onChange: (text: string) => void, placeholder: string, flex?: number, numeric?: boolean }) {
  const { selectedLang, selectedLangWriteFrom } = useLang();
  const COLORS = useColors();
  return <TextInput
    value={value}
    onChangeText={onChange}
    placeholder={translate(placeholder, selectedLang)}
    keyboardType={numeric ? 'numbers-and-punctuation' : 'default'}
    textAlign={selectedLangWriteFrom}
    placeholderTextColor={COLORS.muted}
    style={[ styles.input, { flex, color: COLORS.ink, borderColor: COLORS.line } ]}
  />;
}

function Remove({ onPress }: { onPress: () => void }) {
  const COLORS = useColors();
  return <TouchableOpacity onPress={onPress} hitSlop={8}><Icon name='delete-outline' size={22} color={COLORS.danger} /></TouchableOpacity>;
}

// Seasons, discounts for long rentals and extras. The reservation screen suggests prices from them;
// staff can always change a contract's price.
export default function PricingScreen({ navigation }: ScreenProps<'PricingScreen'>): React.JSX.Element {
  const COLORS = useColors();
  const { selectedLang } = useLang();
  const queryClient = useQueryClient();
  const { isLoading, error, data } = useQuery({ queryKey: ['agency.pricing'], queryFn: pricing });
  useNetworkErrorAlert(error);
  const [rules, setRules] = useState<Rules|null>(null);
  useEffect(() => {
    if (data) {
      setRules({
        seasons: data.seasons.map(season => ({ ...season, percent: String(season.percent) })),
        discounts: data.discounts.map(discount => ({ min_days: String(discount.min_days), percent: String(discount.percent) })),
        extras: data.extras.map(extra => ({ ...extra, price: priceInputFromMillimes(extra.price) })),
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
      alertMessage(selectedLang, 'pricing:saved');
      navigation.goBack();
    },
    onError: (requestError) => Object.keys(validationErrors(requestError)).length ?
      alertMessage(selectedLang, 'pricing:invalid') :
      alertRequestError(selectedLang, requestError),
  });

  if (isLoading || ! rules) {
    return isLoading ? <FullScreenLoader /> : <ErrorState error={error} onRetry={() => queryClient.invalidateQueries({ queryKey: ['agency.pricing'] })} />;
  }

  // Updates one field of one row of a list.
  const update = (list: List, change: (rows: any[]) => any[]) => setRules(current => current && { ...current, [list]: change(current[list]) });
  const set = (list: List, index: number, field: string, value: string) =>
    update(list, rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  const remove = (list: List, index: number) => update(list, rows => rows.filter((_row, rowIndex) => rowIndex !== index));
  const add = (list: List, row: any) => update(list, rows => [ ...rows, row ]);
  const setRule = (field: keyof Rules, value: string|boolean) => setRules(current => current && { ...current, [field]: value });

  return (
    <Screen>
      <KeyboardScroll>
        <Card>
          <TranslatableText data='pricing:seasons' className='text-title font-semibold text-ink' />
          <TranslatableText data='pricing:seasons:hint' className='text-meta text-muted' />
          {rules.seasons.map((season, index) =>
            <LangAwareView key={index} className='gap-x-2 items-center'>
              <Input value={season.name} onChange={(text) => set('seasons', index, 'name', text)} placeholder='pricing:season:name' flex={2} />
              <Input value={season.from} onChange={(text) => set('seasons', index, 'from', text)} placeholder='dd/mm' numeric />
              <Input value={season.to} onChange={(text) => set('seasons', index, 'to', text)} placeholder='dd/mm' numeric />
              <Input value={season.percent} onChange={(text) => set('seasons', index, 'percent', text)} placeholder='%' numeric />
              <Text className='text-body text-muted'>%</Text>
              <Remove onPress={() => remove('seasons', index)} />
            </LangAwareView>
          )}
          <Button label='pricing:season:add' variant='secondary' compact onPress={() => add('seasons', { name: '', from: '01/07', to: '31/08', percent: '20' })} icon='weather-sunny' />
        </Card>

        <Card>
          <TranslatableText data='pricing:discounts' className='text-title font-semibold text-ink' />
          <TranslatableText data='pricing:discounts:hint' className='text-meta text-muted' />
          {rules.discounts.map((discount, index) =>
            <LangAwareView key={index} className='gap-x-2 items-center'>
              <Input value={discount.min_days} onChange={(text) => set('discounts', index, 'min_days', text)} placeholder='pricing:discount:days' numeric />
              <TranslatableText data='pricing:discount:days' className='text-body text-ink' />
              <Input value={discount.percent} onChange={(text) => set('discounts', index, 'percent', text)} placeholder='%' numeric />
              <Text className='text-body text-muted'>%</Text>
              <Remove onPress={() => remove('discounts', index)} />
            </LangAwareView>
          )}
          <Button label='pricing:discount:add' variant='secondary' compact onPress={() => add('discounts', { min_days: '7', percent: '10' })} icon='percent' />
        </Card>

        <Card>
          <TranslatableText data='extra:label' className='text-title font-semibold text-ink' />
          {rules.extras.map((extra, index) =>
            <LangAwareView key={index} className='gap-x-2 items-center'>
              <Input value={extra.name} onChange={(text) => set('extras', index, 'name', text)} placeholder='pricing:extra:name' flex={2} />
              <Input value={extra.price} onChange={(text) => set('extras', index, 'price', text)} placeholder='TND' numeric />
              <Text className='text-body text-muted'>TND</Text>
              <TouchableOpacity onPress={() => set('extras', index, 'per', extra.per === 'day' ? 'rental' : 'day')}>
                <TranslatableText data={'extra:per:' + extra.per} style={[ styles.toggle, { color: COLORS.ink, borderColor: COLORS.line } ]} />
              </TouchableOpacity>
              <Remove onPress={() => remove('extras', index)} />
            </LangAwareView>
          )}
          <Button label='pricing:extra:add' variant='secondary' compact onPress={() => add('extras', { name: '', price: '', per: 'day' })} icon='plus' />
          <LangAwareView className='gap-x-2 items-center'>
            <TranslatableText data='pricing:second_driver' className='text-body text-ink flex-1' />
            <Input value={rules.second_driver_price} onChange={(text) => setRule('second_driver_price', text)} placeholder='0' numeric />
            <TranslatableText data='pricing:tnd_per_day' className='text-body text-ink' />
          </LangAwareView>
        </Card>

        <Card>
          <TranslatableText data='pricing:locations' className='text-title font-semibold text-ink' />
          <TranslatableText data='pricing:locations:hint' className='text-meta text-muted' />
          {rules.locations.map((location, index) =>
            <LangAwareView key={index} className='gap-x-2 items-center'>
              <Input value={location.name} onChange={(text) => set('locations', index, 'name', text)} placeholder='pricing:location:name' flex={2} />
              <Input value={location.fee} onChange={(text) => set('locations', index, 'fee', text)} placeholder='0' numeric />
              <Text className='text-body text-muted'>TND</Text>
              <Remove onPress={() => remove('locations', index)} />
            </LangAwareView>
          )}
          <Button label='pricing:location:add' variant='secondary' compact onPress={() => add('locations', { name: '', fee: '' })} icon='airplane-landing' />
        </Card>

        <Card>
          <TranslatableText data='pricing:return' className='text-title font-semibold text-ink' />
          <TranslatableText data='pricing:return:hint' className='text-meta text-muted' />
          <TouchableOpacity onPress={() => setRule('charge_extra_km', ! rules.charge_extra_km)}>
            <LangAwareView className='gap-x-2 items-center'>
              <Icon name={rules.charge_extra_km ? 'checkbox-marked' : 'checkbox-blank-outline'} size={24} color={COLORS.primary} />
              <TranslatableText data='pricing:charge_extra_km' className='text-body text-ink flex-1' />
            </LangAwareView>
          </TouchableOpacity>
          {rules.charge_extra_km && <>
            <LangAwareView className='gap-x-2 items-center'>
              <TranslatableText data='pricing:km_per_day' className='text-body text-ink flex-1' />
              <Input value={rules.km_per_day} onChange={(text) => setRule('km_per_day', text)} placeholder='0' numeric />
              <Text className='text-body text-muted'>km</Text>
            </LangAwareView>
            <LangAwareView className='gap-x-2 items-center'>
              <TranslatableText data='pricing:extra_km_price' className='text-body text-ink flex-1' />
              <Input value={rules.extra_km_price} onChange={(text) => setRule('extra_km_price', text)} placeholder='0.200' numeric />
              <Text className='text-body text-muted'>TND</Text>
            </LangAwareView>
          </>}
          <ChipsField label='pricing:late' value={rules.late_per} onChange={(option) => setRule('late_per', option)} options={LATE_OPTIONS.map(option => ({ label: 'pricing:late:' + option, value: option }))} />
          {rules.late_per !== 'none' && <LangAwareView className='gap-x-2 items-center'>
            <TranslatableText data='pricing:late:grace' className='text-body text-ink flex-1' />
            <Input value={rules.late_grace_hours} onChange={(text) => setRule('late_grace_hours', text)} placeholder='2' numeric />
            <TranslatableText data='pricing:hours' className='text-body text-ink' />
          </LangAwareView>}
          {rules.late_per === 'hour' && <LangAwareView className='gap-x-2 items-center'>
            <TranslatableText data='pricing:late:hour_price' className='text-body text-ink flex-1' />
            <Input value={rules.late_hour_price} onChange={(text) => setRule('late_hour_price', text)} placeholder='TND' numeric />
            <Text className='text-body text-muted'>TND</Text>
          </LangAwareView>}
          <LangAwareView className='gap-x-2 items-center'>
            <TranslatableText data='pricing:washing' className='text-body text-ink flex-1' />
            <Input value={rules.washing_price} onChange={(text) => setRule('washing_price', text)} placeholder='20' numeric />
            <Text className='text-body text-muted'>TND</Text>
          </LangAwareView>
        </Card>

        <View style={{ margin: 12, marginBottom: 32 }}>
          <Button label='common:save' onPress={() => save.mutate()} isLoading={save.isPending} icon='check' />
        </View>
      </KeyboardScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 8,
  },
  toggle: {
    fontSize: 14,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
});
