import { TouchableOpacity } from 'react-native';

// Makes a piece of a row open something else than the row does (the car or the client inside a
// contract card). Inner presses don't reach the row.
export default function Tappable({ onPress, children }: { onPress?: () => void, children: React.ReactNode }): React.JSX.Element {
  if (! onPress) {
    return <>{children}</>;
  }
  return <TouchableOpacity onPress={onPress} hitSlop={6} activeOpacity={0.6}>{children}</TouchableOpacity>;
}
