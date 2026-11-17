import { View } from 'react-native';
import TranslatableText from '../common/TranslatableText';
import Button from './Button';
import Icon, { IconName } from './Icon';
import { useColors } from '../../store/ThemeContext';

interface EmptyStateProps {
  icon: IconName,
  label: string, // one line, translation key
  action?: { label: string, onPress: () => void },
}

// What a list shows when it has nothing: an icon, one line, and what to do about it.
export default function EmptyState({ icon, label, action }: EmptyStateProps): React.JSX.Element {
  const COLORS = useColors();
  return (
    <View style={{ alignItems: 'center', gap: 12, paddingVertical: 32, paddingHorizontal: 24 }}>
      <Icon name={icon} size={40} color={COLORS.muted} />
      <TranslatableText data={label} className='text-body text-muted text-center' />
      {action && <Button label={action.label} onPress={action.onPress} variant='secondary' compact />}
    </View>
  );
}
