import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Pricing } from '../../api/agency';
import { translate } from '../../i18n';
import { useLang } from '../../store/hooks';
import { formatMoneyDisplay } from '../../support/utils';
import LangAwareView from '../common/LangAwareView';
import ChipsField from '../Form/ChipsField';
import { useFieldStyles } from '../Form/fieldStyles';
import Icon from '../ui/Icon';
import { useColors } from '../../store/ThemeContext';

interface LocationFieldProps {
  label: string,
  value: string|null, // null: at the agency
  onChange: (location: string|null) => void,
  locations: Pricing['locations'], // the agency's delivery places (Settings → Pricing)
}

// Where the car is handed over or taken back: the agency, one of its delivery places (airport,
// hotel) with its fee, or any other address typed in.
export default function LocationField({ label, value, onChange, locations }: LocationFieldProps): React.JSX.Element {
  const fieldStyles = useFieldStyles();
  const COLORS = useColors();
  const { selectedLang, selectedLangWriteFrom } = useLang();
  const [isTyping, setIsTyping] = useState(false);
  const isListed = locations.some(location => location.name === value);
  const showsInput = isTyping || (value !== null && ! isListed);

  const AGENCY = '\u0000agency';
  const OTHER = '\u0000other';
  const selected = showsInput ? OTHER : value === null ? AGENCY : value;
  const choose = (choice: string) => {
    if (choice === OTHER) {
      setIsTyping(true);
      onChange(isListed ? '' : value ?? '');
      return;
    }
    setIsTyping(false);
    onChange(choice === AGENCY ? null : choice);
  };

  return (
    <View style={{ gap: 8 }}>
      <ChipsField
        label={label}
        value={selected}
        onChange={choose}
        options={[
          { label: 'location:agency', value: AGENCY },
          ...locations.map(location => ({ label: location.name + (location.fee ? ' · ' + formatMoneyDisplay(location.fee, selectedLang) : ''), value: location.name })),
          { label: 'location:other', value: OTHER },
        ]}
      />
      {showsInput && <LangAwareView style={{ ...fieldStyles.input, alignItems: 'center', gap: 8, paddingVertical: 0 }}>
        <Icon name='map-marker-outline' size={20} color={COLORS.primary} />
        <TextInput
          value={value ?? ''}
          onChangeText={onChange}
          placeholder={translate('location:address', selectedLang)}
          placeholderTextColor={COLORS.muted}
          maxLength={100}
          textAlign={selectedLangWriteFrom}
          style={{ flex: 1, fontSize: 16, color: COLORS.ink, paddingVertical: 10 }}
          autoFocus={isTyping}
        />
      </LangAwareView>}
    </View>
  );
}
