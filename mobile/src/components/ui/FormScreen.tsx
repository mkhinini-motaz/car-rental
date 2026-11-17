import { View } from 'react-native';
import KeyboardScroll from './KeyboardScroll';
import Screen from './Screen';

// A white screen of fields, spaced evenly, that scrolls above the keyboard.
export default function FormScreen({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Screen white>
      <KeyboardScroll>
        <View style={{ padding: 16, gap: 18, paddingBottom: 32 }}>{children}</View>
      </KeyboardScroll>
    </Screen>
  );
}
