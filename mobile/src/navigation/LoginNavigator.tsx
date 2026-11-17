import React from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from "../screens/LoginScreen";
import NewPasswordScreen from "../screens/NewPasswordScreen";
import SignUpScreen from "../screens/SignUpScreen";
import TranslatableText from '../components/common/TranslatableText';
import { LoginParamList } from './types';
import { useColors } from '../store/ThemeContext';

export default function LoginNavigator(): React.JSX.Element {
  const COLORS = useColors();
  const Stack = createNativeStackNavigator<LoginParamList>();

  return (
    <Stack.Navigator screenOptions={{ headerTitle: '', headerShown: false, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="LoginScreen" component={LoginScreen} />
      <Stack.Screen name="NewPasswordScreen" component={NewPasswordScreen} options={{ headerShown: true }} />
      <Stack.Screen name="SignUpScreen" component={SignUpScreen} options={{ headerShown: true, headerTitle: () => <TranslatableText data='signup:title' style={{ color: COLORS.onNav, fontSize: 20, fontWeight: '600' }} />, headerStyle: { backgroundColor: COLORS.nav }, headerTintColor: COLORS.onNav }} />
    </Stack.Navigator>
  );
}