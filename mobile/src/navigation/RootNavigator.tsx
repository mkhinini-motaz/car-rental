import React from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar, View } from "react-native";
import HomeNavigator from './HomeNavigator';
import { useIsRestoringSession, useUser } from '../store/hooks';
import FullScreenLoader from '../components/common/FullScreenLoader';
import LoginNavigator from './LoginNavigator';
import { navigationRef } from './ref';
import { useColors } from '../store/ThemeContext';

export default function RootNavigator(): React.JSX.Element {
  const user = useUser();
  const isRestoringSession = useIsRestoringSession();
  const COLORS = useColors();
  // React Navigation's own colours (cards, borders, the back swipe) in the agency's theme.
  const base = COLORS.scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, primary: COLORS.primary, background: COLORS.canvas, card: COLORS.surface, text: COLORS.ink, border: COLORS.line, notification: COLORS.danger } };

  if (isRestoringSession) {
    return <FullScreenLoader />;
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Over the header (the theme's `nav` colour) once signed in, over the page before. */}
      <StatusBar barStyle={(user.id ? COLORS.onNav === '#FFFFFF' : COLORS.scheme === 'dark') ? 'light-content' : 'dark-content'} />
      <NavigationContainer ref={navigationRef} theme={theme}>
        {!!user.id ?
          <HomeNavigator/> :
          <LoginNavigator/>
        }
      </NavigationContainer>
    </View>
  );
}