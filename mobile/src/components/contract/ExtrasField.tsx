import { Text, TouchableOpacity, View } from 'react-native';
import { Extra } from '../../classes/Contract';
import { useMoney } from '../../store/hooks';
import LangAwareView from '../common/LangAwareView';
import TranslatableText from '../common/TranslatableText';
import { useFieldStyles } from '../Form/fieldStyles';
import Icon from '../ui/Icon';
import { useColors } from '../../store/ThemeContext';

interface ExtrasFieldProps {
  value: Extra[],
  onChange: (extras: Extra[]) => void,
  catalogue: Extra[], // the agency's extras (Settings → Pricing)
  days: number,
}

// The extras sold with a rental: added from the agency's list (its price at that moment), removable.
export default function ExtrasField({ value, onChange, catalogue, days }: ExtrasFieldProps): React.JSX.Element|null {
  const fieldStyles = useFieldStyles();
  const COLORS = useColors();
  const money = useMoney();
  if (! catalogue.length && ! value.length) {
    return null;
  }

  return (
    <View style={{ gap: 8 }}>
      <TranslatableText data='extra:label' style={fieldStyles.label} />
      {value.map((extra, index) =>
        <LangAwareView key={index} style={{ gap: 8, alignItems: 'center' }}>
          <Text className='text-body text-ink' style={{ flex: 1 }}>{extra.name}</Text>
          <TranslatableText
            data={extra.per === 'day' ? 'extra:per_day' : 'extra:per_rental'}
            params={{ price: money(extra.price), total: money(Math.round(extra.per === 'day' ? extra.price * days : extra.price)) }}
            className='text-meta text-muted'
          />
          <TouchableOpacity onPress={() => onChange(value.filter((_extra, itemIndex) => itemIndex !== index))} hitSlop={8}>
            <Icon name='close-circle-outline' size={22} color={COLORS.danger} />
          </TouchableOpacity>
        </LangAwareView>
      )}
      <LangAwareView style={{ flexWrap: 'wrap', gap: 8 }}>
        {catalogue.map((extra, index) =>
          <TouchableOpacity key={index} activeOpacity={0.7} onPress={() => onChange([ ...value, extra ])}>
            <LangAwareView style={{ alignItems: 'center', gap: 4, borderWidth: 1, borderColor: COLORS.line, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: COLORS.surface }}>
              <Icon name='plus' size={16} color={COLORS.primary} />
              <Text style={{ fontSize: 15, color: COLORS.ink }}>{extra.name}</Text>
            </LangAwareView>
          </TouchableOpacity>
        )}
      </LangAwareView>
    </View>
  );
}
