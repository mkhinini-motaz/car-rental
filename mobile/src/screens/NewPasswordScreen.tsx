import React, { useState } from 'react';
import { View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { resetPassword } from '../api/auth';
import { useAuthenticateUser, useLang } from '../store/hooks';
import { alertMessage, alertRequestError, validationErrors } from '../support/alert';
import { FORM_FIELD_TYPE_PASSWORD, FORM_FIELD_TYPE_SUBMIT } from '../support/form';
import Form from '../components/Form/Form';
import OtpField from '../components/Form/OtpField';
import TranslatableText from '../components/common/TranslatableText';
import { LoginProps } from '../navigation/types';
import { useColors } from '../store/ThemeContext';

const MIN_LENGTH = 8;

// A new password with a 6-digit code: one sent by SMS from here, or the one the owner gave you
// when they invited you. Logs you in.
export default function NewPasswordScreen({ route }: LoginProps<'NewPasswordScreen'>): React.JSX.Element {
  const COLORS = useColors();
  const phone: string = route.params.phone;
  const { selectedLang } = useLang();
  const authenticateUser = useAuthenticateUser();
  const [otp, setOtp] = useState('');
  const [value, setValue] = useState({ password: '', password_confirmation: '' });
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () => resetPassword({ ...value, phone, otp: otp.replaceAll(' ', '') }),
    onSuccess: authenticateUser,
    onError: (error) => validationErrors(error).otp ? alertMessage(selectedLang, 'otp:validation:wrong') : alertRequestError(selectedLang, error),
  });

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface, padding: 16, gap: 18 }}>
      <TranslatableText data='otp:hint' className='text-body text-muted' />
      <OtpField label='form:otp:label' value={otp} onChange={setOtp} withRequestButton phone={phone} />
      <Form
        value={value}
        fields={[
          { name: 'password', label: 'settings:password:new', type: FORM_FIELD_TYPE_PASSWORD },
          { name: 'password_confirmation', label: 'form:password_confirmation:label', type: FORM_FIELD_TYPE_PASSWORD },
          { label: 'common:confirm', type: FORM_FIELD_TYPE_SUBMIT, isLoading: save.isPending },
        ]}
        onChange={setValue}
        onSubmit={() => {
          if (otp.replaceAll(' ', '').length < 6) {
            alertMessage(selectedLang, 'otp:validation:wrong');
            return;
          }
          if (value.password.length < MIN_LENGTH) {
            setServerErrors({ password: 'validation:password:min8' });
            return;
          }
          if (value.password !== value.password_confirmation) {
            setServerErrors({ password_confirmation: 'validation:password:confirmation' });
            return;
          }
          setServerErrors({});
          save.mutate();
        }}
        serverErrors={serverErrors}
      />
    </View>
  );
}
