import { View } from 'react-native';
import TranslatableText from '../common/TranslatableText';
import Button from './Button';
import Icon from './Icon';
import { useColors } from '../../store/ThemeContext';

// A list or page that failed to load: one line and a retry.
export default function ErrorState({ error, onRetry }: { error: any, onRetry: () => void }): React.JSX.Element {
  const COLORS = useColors();
  const label = error?.code === 'ERR_NETWORK' ? 'common:error:network' : error?.response?.status === 403 ? 'common:forbidden' : 'common:error:load';

  return (
    <View style={{ alignItems: 'center', gap: 12, paddingVertical: 32, paddingHorizontal: 24 }}>
      <Icon name='alert-circle-outline' size={40} color={COLORS.danger} />
      <TranslatableText data={label} className='text-body text-ink text-center' />
      <Button label='common:retry' onPress={onRetry} variant='secondary' icon='refresh' compact />
    </View>
  );
}
