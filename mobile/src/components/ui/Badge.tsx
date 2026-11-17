import { View } from 'react-native';
import { Tone } from '../../constants';
import TranslatableText from '../common/TranslatableText';
import { useColors } from '../../store/ThemeContext';

// A status pill: tinted background, text in the tone's colour.
export default function Badge({ label, params, tone = 'muted' }: { label: string, params?: object, tone?: Tone }): React.JSX.Element {
  const COLORS = useColors();
  return (
    <View style={{ backgroundColor: COLORS[tone] + '1A', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' }}>
      <TranslatableText data={label} params={params} style={{ color: COLORS[tone], fontSize: 13, fontWeight: '600' }} />
    </View>
  );
}
