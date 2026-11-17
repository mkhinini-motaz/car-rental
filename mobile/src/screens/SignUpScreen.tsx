import React, { useState } from 'react';
import { View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { requestSignupCode, signup } from '../api/auth';
import { PHONE_REGEX } from '../constants';
import { useAuthenticateUser, useLang } from '../store/hooks';
import { alertMessage, alertRequestError, validationErrors } from '../support/alert';
import { FORM_FIELD_TYPE_PASSWORD, FORM_FIELD_TYPE_PHONE, FORM_FIELD_TYPE_SUBMIT, FORM_FIELD_TYPE_TEXT } from '../support/form';
import Form from '../components/Form/Form';
import OtpField from '../components/Form/OtpField';
import Screen from '../components/ui/Screen';
import TranslatableText from '../components/common/TranslatableText';

const MIN_LENGTH = 8;

// A new agency in two steps: the agency and its owner's name and phone, which gets a code by SMS;
// then the code and a password. Logs the new owner in on an empty agency.
export default function SignUpScreen(): React.JSX.Element {
  const { selectedLang } = useLang();
  const authenticateUser = useAuthenticateUser();
  const [value, setValue] = useState({ agency_name: '', first_name: '', last_name: '', phone: '+216 ', password: '', password_confirmation: '' });
  const [otp, setOtp] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const phone = value.phone.replaceAll(' ', '');

  const sendCode = useMutation({
    mutationFn: () => requestSignupCode(phone, selectedLang),
    onSuccess: () => setCodeSent(true),
    onError: (error) => validationErrors(error).phone ? setServerErrors({ phone: 'signup:phone:taken' }) : alertRequestError(selectedLang, error),
  });

  const create = useMutation({
    mutationFn: () => signup({ ...value, agency_name: value.agency_name.trim(), first_name: value.first_name.trim(), last_name: value.last_name.trim(), phone, otp }),
    onSuccess: authenticateUser,
    onError: (error) => validationErrors(error).otp ? alertMessage(selectedLang, 'otp:validation:wrong') : alertRequestError(selectedLang, error),
  });

  if (! codeSent) {
    return (
      <Screen white>
        <Form
          value={value}
          fields={[
            { name: 'agency_name', label: 'signup:agency_name', type: FORM_FIELD_TYPE_TEXT },
            { name: 'first_name', label: 'form:first_name:label', type: FORM_FIELD_TYPE_TEXT },
            { name: 'last_name', label: 'form:last_name:label', type: FORM_FIELD_TYPE_TEXT },
            { name: 'phone', label: 'form:phone:label', type: FORM_FIELD_TYPE_PHONE },
            { label: 'signup:send_code', type: FORM_FIELD_TYPE_SUBMIT, isLoading: sendCode.isPending },
          ]}
          onChange={setValue}
          onSubmit={() => {
            if (! PHONE_REGEX.test(phone)) {
              setServerErrors({ phone: 'validation:phone:invalid' });
              return;
            }
            setServerErrors({});
            sendCode.mutate();
          }}
          serverErrors={serverErrors}
        />
      </Screen>
    );
  }

  return (
    <Screen white>
      <View style={{ padding: 16, gap: 18 }}>
        <TranslatableText data='signup:code_hint' params={{ phone: value.phone }} className='text-body text-muted' />
        <OtpField label='form:otp:label' value={otp} onChange={setOtp} withRequestButton phone={phone} request={requestSignupCode} />
      </View>
      <Form
        value={value}
        fields={[
          { name: 'password', label: 'settings:password:new', type: FORM_FIELD_TYPE_PASSWORD },
          { name: 'password_confirmation', label: 'form:password_confirmation:label', type: FORM_FIELD_TYPE_PASSWORD },
          { label: 'signup:create', type: FORM_FIELD_TYPE_SUBMIT, isLoading: create.isPending },
        ]}
        onChange={setValue}
        onSubmit={() => {
          if (otp.length < 6) {
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
          create.mutate();
        }}
        serverErrors={serverErrors}
      />
    </Screen>
  );
}
