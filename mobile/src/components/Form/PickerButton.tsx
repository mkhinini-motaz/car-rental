import { Text, TouchableOpacity } from 'react-native';
import { useLang } from '../../store/hooks';
import LangAwareView from '../common/LangAwareView';
import Icon, { IconName } from '../ui/Icon';
import { useFieldStyles } from './fieldStyles';
import { useColors } from '../../store/ThemeContext';

// Looks like an input, opens a picker (dates).
export default function PickerButton({ text, icon, onPress, error = false }: { text: string, icon: IconName, onPress: () => void, error?: boolean }): React.JSX.Element {
  const fieldStyles = useFieldStyles();
  const COLORS = useColors();
  const { selectedLangWriteFrom } = useLang();
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <LangAwareView style={{ ...fieldStyles.input, ...(error ? fieldStyles.inputError : {}), alignItems: 'center', gap: 8 }}>
        <Text style={{ flex: 1, fontSize: 16, color: COLORS.ink, textAlign: selectedLangWriteFrom }}>{text}</Text>
        <Icon name={icon} size={20} color={COLORS.primary} />
      </LangAwareView>
    </TouchableOpacity>
  );
}
