import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../../store/ThemeContext';

// A screen under a header: the header covers the top inset, the canvas colour behind the cards.
export default function Screen({ children, white = false }: { children: React.ReactNode, white?: boolean }): React.JSX.Element {
  const COLORS = useColors();
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: white ? COLORS.surface : COLORS.canvas }}>
      {children}
    </SafeAreaView>
  );
}
