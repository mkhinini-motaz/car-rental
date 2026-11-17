import { Text, TouchableOpacity, View } from 'react-native';
import { useLang } from '../../store/hooks';
import LangAwareView from '../common/LangAwareView';
import Icon, { IconName } from './Icon';
import { useColors } from '../../store/ThemeContext';

interface ListRowProps {
  title: React.ReactNode, // text as is; pass a TranslatableText to translate
  subtitle?: React.ReactNode,
  meta?: React.ReactNode, // on the far side: a price, a badge, a count
  icon?: IconName,
  iconColor?: string,
  left?: React.ReactNode, // instead of the icon: a photo, a swatch
  onPress?: () => void,
  chevron?: boolean, // shown when pressable, unless false
  boxed?: boolean, // a row of its own in a list: in a card
}

// One line in a list: icon, title over a muted subtitle, meta, chevron.
export default function ListRow({ title, subtitle, meta, icon, iconColor, left, onPress, chevron, boxed = false }: ListRowProps): React.JSX.Element {
  const COLORS = useColors();
  const { selectedLangWriteFrom } = useLang();
  const isRtl = selectedLangWriteFrom === 'right';
  const text = (value: React.ReactNode, className: string) => typeof value === 'string' || typeof value === 'number' ?
    <Text className={className} style={{ textAlign: selectedLangWriteFrom }} numberOfLines={2}>{value}</Text> : value;

  const row = (
    <LangAwareView style={{ alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, minHeight: 52 }}>
      {left ?? (icon && <Icon name={icon} size={22} color={iconColor ?? COLORS.muted} />)}
      <View style={{ flex: 1, gap: 2, alignItems: isRtl ? 'flex-end' : 'flex-start' }}>
        {text(title, 'text-body text-ink')}
        {subtitle !== undefined && subtitle !== null && subtitle !== '' && text(subtitle, 'text-meta text-muted')}
      </View>
      {typeof meta === 'string' ? <Text className='text-body text-ink font-semibold'>{meta}</Text> : meta}
      {(chevron ?? !! onPress) && <Icon name={isRtl ? 'chevron-left' : 'chevron-right'} size={20} color={COLORS.muted} />}
    </LangAwareView>
  );

  const pressable = onPress ? <TouchableOpacity activeOpacity={0.6} onPress={onPress}>{row}</TouchableOpacity> : row;

  return boxed ? <View className='bg-surface border border-line rounded-xl mx-3 my-1 overflow-hidden'>{pressable}</View> : pressable;
}
