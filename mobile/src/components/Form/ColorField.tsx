import React, { memo, useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useLang } from '../../store/hooks';
import { translate } from '../../i18n';
import TranslatableText from '../common/TranslatableText';
import LangAwareView from '../common/LangAwareView';
import Icon from '../ui/Icon';
import { useFieldStyles } from './fieldStyles';
import { useColors } from '../../store/ThemeContext';

// Common car colours; swatches need no translation.
export const CAR_COLOURS = [
  '#f5f5f5', '#1f1f1f', '#9e9e9e', '#c0c0c0', '#b71c1c', '#1565c0',
  '#0d2c54', '#2e7d32', '#d7c4a3', '#6d4c41', '#ef6c00', '#fbc02d',
];

export const isSwatch = (colour: string|null) => !! colour && colour.startsWith('#');

interface ColorFieldProps {
  value: string|null,
  label: string,
  onChange: (newValue: string) => void,
}

// A swatch, or for a colour the palette doesn't have ("Vert pomme", "Bordeaux métallisé"), its name.
function ColorField({ value, label, onChange }: ColorFieldProps): React.JSX.Element {
  const fieldStyles = useFieldStyles();
  const COLORS = useColors();
  const { selectedLang, selectedLangWriteFrom } = useLang();
  const [isNaming, setIsNaming] = useState(false); // "other" pressed, name not typed yet
  // Also true when a saved car arrives with a named colour after the form mounted.
  const showsName = isNaming || (!! value && ! isSwatch(value));

  return (
    <View>
      <TranslatableText data={label} style={fieldStyles.label} />
      <LangAwareView className='flex-wrap gap-3'>
        {CAR_COLOURS.map(colour =>
          <TouchableOpacity key={colour} onPress={() => {
            setIsNaming(false);
            onChange(colour);
          }}>
            <View style={[ styles.swatch, { backgroundColor: colour }, value === colour && [ styles.selected, { borderColor: COLORS.primary } ] ]} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => {
          setIsNaming(true);
          onChange(isSwatch(value) ? '' : value ?? '');
        }}>
          <View style={[ styles.swatch, styles.other, { backgroundColor: COLORS.surface }, showsName && [ styles.selected, { borderColor: COLORS.primary } ] ]}>
            <Icon name='pencil' size={20} color={COLORS.primary} />
          </View>
        </TouchableOpacity>
      </LangAwareView>
      {showsName && <TextInput
        value={value ?? ''}
        onChangeText={onChange}
        placeholder={translate('car:colour:name', selectedLang)}
        maxLength={30}
        textAlign={selectedLangWriteFrom}
        style={[ fieldStyles.input, { marginTop: 10 } ]}
        autoFocus={isNaming}
      />}
    </View>
  );
}

const styles = StyleSheet.create({
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#00000033',
  },
  other: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    borderWidth: 3,
  },
});

export default memo(ColorField);
