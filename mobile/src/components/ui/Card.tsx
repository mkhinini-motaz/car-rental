import { TouchableOpacity, View, ViewStyle } from 'react-native';

interface CardProps {
  children?: React.ReactNode,
  onPress?: () => void,
  flush?: boolean, // no outer margin: the parent spaces it
  style?: ViewStyle,
}

// Flat surface with a 1px border, radius 12, no shadow.
export default function Card({ children, onPress, flush = false, style }: CardProps): React.JSX.Element {
  const body = <View className={'bg-surface border border-line rounded-xl p-3 gap-y-2' + (flush ? '' : ' mx-3 my-1.5')} style={style}>{children}</View>;

  return onPress ? <TouchableOpacity activeOpacity={0.7} onPress={onPress}>{body}</TouchableOpacity> : body;
}
