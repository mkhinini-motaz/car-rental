import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { updateMe } from '../api/auth';
import { useLang } from '../store/hooks';
import { setUserToken } from '../support/auth';
import { alertMessage, alertRequestError, validationErrors } from '../support/alert';
import { FORM_FIELD_TYPE_PASSWORD, FORM_FIELD_TYPE_SUBMIT } from '../support/form';
import Form from '../components/Form/Form';
import Screen from '../components/ui/Screen';
import { ScreenProps } from '../navigation/types';

const MIN_LENGTH = 8;

// A new password, with the current one.
export default function PasswordFormScreen({ navigation }: ScreenProps<'PasswordFormScreen'>): React.JSX.Element {
  const { selectedLang } = useLang();
  const [value, setValue] = useState({ current_password: '', password: '', password_confirmation: '' });
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () => updateMe({ current_password: value.current_password, password: value.password }),
    onSuccess: async (updated) => {
      await setUserToken(updated.access_token!); // the old token no longer matches the password
      alertMessage(selectedLang, 'settings:password:changed');
      navigation.goBack();
    },
    onError: (error) => {
      if (validationErrors(error).current_password) {
        setServerErrors({ current_password: 'user:password:wrong' });
      } else {
        alertRequestError(selectedLang, error);
      }
    },
  });

  return (
    <Screen white>
      <Form
        value={value}
        fields={[
          { name: 'current_password', label: 'settings:password:current', type: FORM_FIELD_TYPE_PASSWORD },
          { name: 'password', label: 'settings:password:new', type: FORM_FIELD_TYPE_PASSWORD },
          { name: 'password_confirmation', label: 'form:password_confirmation:label', type: FORM_FIELD_TYPE_PASSWORD },
          { label: 'common:save', type: FORM_FIELD_TYPE_SUBMIT, isLoading: save.isPending },
        ]}
        onChange={setValue}
        onSubmit={() => {
          if (value.password.length < MIN_LENGTH) {
            setServerErrors({ password: 'validation:password:min8' });
            return;
          }
          setServerErrors({});
          save.mutate();
        }}
        serverErrors={serverErrors}
      />
    </Screen>
  );
}
