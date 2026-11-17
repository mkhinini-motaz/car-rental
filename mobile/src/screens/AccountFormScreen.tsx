import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { updateMe } from '../api/auth';
import { useLang, useSetUser, useUser } from '../store/hooks';
import { alertMessage, alertRequestError } from '../support/alert';
import { FORM_FIELD_TYPE_PHONE, FORM_FIELD_TYPE_SUBMIT, FORM_FIELD_TYPE_TEXT, serverFieldErrors } from '../support/form';
import Form from '../components/Form/Form';
import Screen from '../components/ui/Screen';
import { toMaskedPhone } from '../components/client/clientForm';
import { ScreenProps } from '../navigation/types';

// Your own name and phone (the phone is your login).
export default function AccountFormScreen({ navigation }: ScreenProps<'AccountFormScreen'>): React.JSX.Element {
  const user = useUser();
  const setUser = useSetUser();
  const { selectedLang } = useLang();
  const [value, setValue] = useState({ first_name: user.first_name, last_name: user.last_name, phone: toMaskedPhone(user.phone) });
  const [serverErrors, setServerErrors] = useState({});

  const save = useMutation({
    mutationFn: () => updateMe({ first_name: value.first_name.trim(), last_name: value.last_name.trim(), phone: value.phone.replaceAll(' ', '') }),
    onSuccess: (updated) => {
      setUser({ ...user, ...updated, access_token: user.access_token });
      alertMessage(selectedLang, 'settings:saved');
      navigation.goBack();
    },
    onError: (error) => {
      const errors = serverFieldErrors(error, 'validation:phone:used');
      setServerErrors(errors);
      if (! Object.keys(errors).length) {
        alertRequestError(selectedLang, error);
      }
    },
  });

  return (
    <Screen white>
      <Form
        value={value}
        fields={[
          { name: 'first_name', label: 'form:first_name:label', type: FORM_FIELD_TYPE_TEXT },
          { name: 'last_name', label: 'form:last_name:label', type: FORM_FIELD_TYPE_TEXT },
          { name: 'phone', label: 'form:phone:label', type: FORM_FIELD_TYPE_PHONE },
          { label: 'common:save', type: FORM_FIELD_TYPE_SUBMIT, isLoading: save.isPending },
        ]}
        onChange={setValue}
        onSubmit={() => {
          setServerErrors({});
          save.mutate();
        }}
        serverErrors={serverErrors}
      />
    </Screen>
  );
}
