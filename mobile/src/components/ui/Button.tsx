import { ActivityIndicator, TouchableOpacity } from 'react-native';
import LangAwareView from '../common/LangAwareView';
import TranslatableText from '../common/TranslatableText';
import Icon, { IconName } from './Icon';
import { useColors } from '../../store/ThemeContext';

interface ButtonProps {
  label: string, // translation key
  params?: object,
  onPress?: () => void,
  variant?: 'primary' | 'secondary' | 'danger',
  icon?: IconName,
  isLoading?: boolean,
  disabled?: boolean,
  compact?: boolean, // 36px, for actions inside a row
}

// 44px high (36 compact), radius 10, no shadow. Primary is filled in the agency's colour, secondary outlined.
export default function Button({ label, params, onPress, variant = 'primary', icon, isLoading = false, disabled = false, compact = false }: ButtonProps): React.JSX.Element {
  const COLORS = useColors();
  const colour = variant === 'danger' ? COLORS.danger : COLORS.primary;
  const isFilled = variant === 'primary';
  const content = isFilled ? COLORS.onPrimary : colour;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled || isLoading}
      style={{
        height: compact ? 36 : 44,
        paddingHorizontal: compact ? 12 : 16,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: colour,
        backgroundColor: isFilled ? colour : COLORS.surface,
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {isLoading ? <ActivityIndicator color={content} /> :
        <LangAwareView style={{ gap: 8, alignItems: 'center', justifyContent: 'center' }}>
          {icon && <Icon name={icon} size={compact ? 18 : 20} color={content} />}
          <TranslatableText data={label} params={params} style={{ color: content, fontSize: compact ? 14 : 16, fontWeight: '600' }} />
        </LangAwareView>
      }
    </TouchableOpacity>
  );
}
