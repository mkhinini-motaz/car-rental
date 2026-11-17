import { Text, TouchableOpacity, View } from 'react-native';
import { Tone } from '../../constants';
import { useLang } from '../../store/hooks';
import LangAwareView from '../common/LangAwareView';
import TranslatableText from '../common/TranslatableText';
import { useColors } from '../../store/ThemeContext';

interface InfoRowProps {
  label: string, // translation key
  params?: object,
  value: React.ReactNode, // text as is, or any element
  tone?: Tone, // colours the value
  bold?: boolean,
  onPress?: () => void, // the value opens something (a client, a car): shown as a link
}

// A label and its value on one line, the value on the far side (detail cards, totals).
export default function InfoRow({ label, params, value, tone, bold = false, onPress }: InfoRowProps): React.JSX.Element {
  const COLORS = useColors();
  const { selectedLangWriteFrom } = useLang();
  const row = (
    <LangAwareView style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 28 }}>
      <View style={{ flexShrink: 1 }}>
        <TranslatableText data={label} params={params} style={{ fontSize: 15, color: bold ? COLORS.ink : COLORS.muted, fontWeight: bold ? '600' : '400' }} />
      </View>
      {typeof value === 'string' || typeof value === 'number' ?
        <Text style={{ fontSize: 15, fontWeight: bold ? '700' : '600', color: tone ? COLORS[tone] : onPress ? COLORS.primary : COLORS.ink, textAlign: selectedLangWriteFrom === 'right' ? 'left' : 'right' }}>{value}</Text> :
        value}
    </LangAwareView>
  );

  return onPress ? <TouchableOpacity onPress={onPress} activeOpacity={0.6}>{row}</TouchableOpacity> : row;
}
