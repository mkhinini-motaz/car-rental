import { Text, TouchableOpacity, View } from 'react-native';
import { Tone } from '../../constants';
import TranslatableText from '../common/TranslatableText';
import { useColors } from '../../store/ThemeContext';

interface StatProps {
  label: string, // translation key
  value: string | number,
  tone?: Tone, // colours the value
  onPress?: () => void,
}

// A number tile for the Today screen and reports.
export default function Stat({ label, value, tone = 'primary', onPress }: StatProps): React.JSX.Element {
  const COLORS = useColors();
  const body = (
    <View className='bg-surface border border-line rounded-xl px-3 py-2.5' style={{ minHeight: 72, justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 24, fontWeight: '700', color: COLORS[tone] }}>{value}</Text>
      <TranslatableText data={label} className='text-meta text-muted' />
    </View>
  );

  return onPress ? <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={{ flex: 1 }}>{body}</TouchableOpacity> : <View style={{ flex: 1 }}>{body}</View>;
}
