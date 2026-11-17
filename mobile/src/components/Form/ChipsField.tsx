import React, { memo } from 'react';
import { TouchableOpacity, View } from 'react-native';
import TranslatableText from '../common/TranslatableText';
import LangAwareView from '../common/LangAwareView';
import { useFieldStyles } from './fieldStyles';
import { useColors } from '../../store/ThemeContext';

interface ChipsFieldProps<T> {
  value: T|null,
  label?: string,
  options: { label: string, value: T }[], // labels are translation keys, or shown as is (plates, names)
  onChange: (newValue: T) => void,
  error?: boolean,
  helperText?: string,
  hint?: string, // a muted line under the pills
}

// One choice among a few or many short options, as wrapping pills.
function ChipsField<T>({ value, label, options, onChange, error = false, helperText = '', hint }: ChipsFieldProps<T>): React.JSX.Element {
  const fieldStyles = useFieldStyles();
  const COLORS = useColors();
  return (
    <View style={{ width: '100%' }}>
      {label && <TranslatableText data={label} style={fieldStyles.label} />}
      <LangAwareView style={{ flexWrap: 'wrap', gap: 8 }}>
        {options.map(option => {
          const isSelected = option.value === value;
          return (
            <TouchableOpacity key={String(option.value)} activeOpacity={0.7} onPress={() => onChange(option.value)}>
              <View style={{
                borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7,
                borderColor: error ? COLORS.danger : isSelected ? COLORS.primary : COLORS.line,
                backgroundColor: isSelected ? COLORS.primary : COLORS.surface,
              }}>
                <TranslatableText data={option.label} style={{ fontSize: 15, fontWeight: '500', color: isSelected ? COLORS.onPrimary : COLORS.ink }} />
              </View>
            </TouchableOpacity>
          );
        })}
      </LangAwareView>
      {helperText ? <TranslatableText data={helperText} style={fieldStyles.helperText} /> :
        !! hint && <TranslatableText data={hint} style={{ color: COLORS.muted, fontSize: 13, marginTop: 4 }} />}
    </View>
  );
}

export default memo(ChipsField) as typeof ChipsField;
