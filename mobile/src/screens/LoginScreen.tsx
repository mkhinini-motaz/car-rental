import React, { useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, TouchableOpacity, TouchableWithoutFeedback, View, Modal } from 'react-native';
import { PHONE_REGEX } from '../constants';
import { translate } from "../i18n";
import { useAuthenticateUser, useLang } from "../store/hooks";
import { useMutation } from "@tanstack/react-query";
import { login } from "../api/auth";
import PasswordField from '../components/Form/PasswordField';
import PhoneField from '../components/Form/PhoneField';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { alertNetworkError } from "../support/alert";
import TranslatableText from '../components/common/TranslatableText';
import LangAwareView from '../components/common/LangAwareView';
import { LoginProps } from '../navigation/types';
import { useColors } from '../store/ThemeContext';

export default function LoginScreen({ navigation }: LoginProps<'LoginScreen'>) {
  const COLORS = useColors();
  // The seeded owner in debug builds only.
  const [phone, setPhone] = React.useState(__DEV__ ? '+21623456109' : '+216 ');
  const [password, setPassword] = React.useState(__DEV__ ? 'azerty' : '');
  const [forgotPhone, setForgotPhone] = React.useState('+216 ');
  const [modalIsVisible, setModalIsVisible] = useState(false);

  const { selectedLang } = useLang();
  const authenticateUser = useAuthenticateUser();
  const { mutate, isPending: isLoading } = useMutation({
    mutationFn: login,
    onSuccess: authenticateUser,
    onError: (error: any) => {
      if (error.code === 'ERR_NETWORK') {
        alertNetworkError(selectedLang);
        return;
      }

      Alert.alert(
        '',
        translate('login:error', selectedLang),
        [{ text: translate('common:ok', selectedLang), }],
      );
    }
  });

  const onLoginPress = () => mutate({ phone: phone.replaceAll(' ', ''), password });

  const onForgotPasswordPress = () => {
    setModalIsVisible(true);
    setForgotPhone('+216 ');
    // TODO: auto focus on phone input
  };

  const onForgotPasswordConfirm = () => {
    const phoneData = forgotPhone.replaceAll(' ', '');
    if (!PHONE_REGEX.test(phoneData)) {
      Alert.alert(
        '',
        translate('validation:phone:invalid', selectedLang),
        [{ text: translate('common:ok', selectedLang), }],
      );
      return;
    }
    // No SMS yet: someone invited already has a code from the owner; the next screen sends one.
    navigation.navigate('NewPasswordScreen', { phone: phoneData });
    setModalIsVisible(false);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: COLORS.canvas }}>
        <View style={{ alignItems: 'center', gap: 6, marginBottom: 24 }}>
          <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name='car-key' size={34} color={COLORS.onPrimary} />
          </View>
          <TranslatableText data='login:title' className='text-title font-semibold text-ink' />
        </View>
        <View className='bg-surface border border-line rounded-xl' style={{ padding: 16, gap: 16 }}>
          <PhoneField label='form:phone:label' value={phone} onChange={setPhone} />
          <PasswordField label='form:password:label' value={password} onChange={setPassword} />
          <Button label='common:login' onPress={onLoginPress} isLoading={isLoading} icon='login' />
          <TouchableOpacity onPress={onForgotPasswordPress} style={{ alignItems: 'center', paddingVertical: 4 }}>
            <TranslatableText data='common:forgot-password?' className='text-body text-info' />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('SignUpScreen')} style={{ alignItems: 'center', paddingVertical: 16 }}>
          <TranslatableText data='signup:link' className='text-body font-semibold text-info' />
        </TouchableOpacity>

        <Modal
          animationType='slide'
          transparent
          visible={modalIsVisible}
          onRequestClose={() => setModalIsVisible(! modalIsVisible)}>
          <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#00000055' }}>
            <View className='bg-surface rounded-xl' style={{ padding: 16, gap: 16 }}>
              <PhoneField label='form:phone:label' value={forgotPhone} onChange={setForgotPhone} />
              <LangAwareView style={{ gap: 8 }}>
                <View style={{ flex: 1 }}><Button label='common:cancel' variant='secondary' onPress={() => setModalIsVisible(! modalIsVisible)} /></View>
                <View style={{ flex: 1 }}><Button label='common:confirm' onPress={onForgotPasswordConfirm} /></View>
              </LangAwareView>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
