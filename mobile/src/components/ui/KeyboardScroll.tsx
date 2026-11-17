import { useEffect, useRef } from 'react';
import { Keyboard, KeyboardAvoidingView, ScrollView, StyleProp, TextInput, ViewStyle } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';

const ABOVE_INPUT = 96; // room kept above the field being typed in: its label

// A scrolling screen that keeps the field being typed in above the keyboard (React Native's
// KeyboardAvoidingView, and a scroll to the focused input when the keyboard opens).
export default function KeyboardScroll({ children, contentContainerStyle }: { children: React.ReactNode, contentContainerStyle?: StyleProp<ViewStyle> }): React.JSX.Element {
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const headerHeight = useHeaderHeight();

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      const input = TextInput.State.currentlyFocusedInput();
      const content = scroll.current?.getInnerViewRef();
      if (input && content) {
        input.measureLayout(content, (_x, y) => scroll.current?.scrollTo({ y: Math.max(0, y - ABOVE_INPUT), animated: true }), () => {});
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior='padding' keyboardVerticalOffset={headerHeight}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps='handled' keyboardDismissMode='on-drag' contentContainerStyle={contentContainerStyle}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
