import { useLayoutEffect } from 'react';
import { TouchableOpacity } from 'react-native';
import Icon, { IconName } from './Icon';
import { useColors } from '../../store/ThemeContext';

// A round action in the screen's header (add a car, a client...).
export function useHeaderAction(navigation: any, icon: IconName|null, onPress: () => void) {
  const COLORS = useColors();
  useLayoutEffect(() => navigation.setOptions({
    headerRight: icon ? () => <TouchableOpacity onPress={onPress} hitSlop={10} style={{ marginHorizontal: 8 }}>
      <Icon name={icon} size={28} color={COLORS.onNav} />
    </TouchableOpacity> : undefined,
  }));
}
