import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useMutation } from '@tanstack/react-query';
import { TextField } from '@mui/material';
import { updateMe } from '../../src/api/auth';
import { useT } from '../../src/store/Store';
import { setUserToken } from '../../src/support/auth';
import { validationErrors } from '../../src/support/alert';
import { useFeedback } from '../../src/components/Feedback';
import SimpleForm from '../../src/components/SimpleForm';

const MIN_LENGTH = 8;

// A new password, with the current one.
export default function PasswordPage() {
  const t = useT();
  const router = useRouter();
  const { notify, requestError } = useFeedback();
  const [value, setValue] = useState({ current_password: '', password: '', password_confirmation: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () => updateMe({ current_password: value.current_password, password: value.password }),
    onSuccess: (updated) => {
      setUserToken(updated.access_token!); // the old token no longer matches the password
      notify('settings:password:changed', 'success');
      router.push('/settings');
    },
    onError: (error) => validationErrors(error).current_password ? setErrors({ current_password: 'user:password:wrong' }) : requestError(error),
  });
  const onSubmit = () => {
    const fieldErrors: Record<string, string> = {};
    if (! value.current_password) {
      fieldErrors.current_password = 'validation:required';
    }
    if (value.password.length < MIN_LENGTH) {
      fieldErrors.password = 'validation:password:min8';
    } else if (value.password !== value.password_confirmation) {
      fieldErrors.password_confirmation = 'validation:password:confirmation';
    }
    setErrors(fieldErrors);
    if (! Object.keys(fieldErrors).length) {
      save.mutate();
    }
  };
  const field = (name: keyof typeof value, label: string, autoComplete: string) =>
    <TextField type='password' autoComplete={autoComplete} label={t(label)} value={value[name]} onChange={event => setValue({ ...value, [name]: event.target.value })} error={!! errors[name]} helperText={errors[name] && t(errors[name])} />;

  return (
    <SimpleForm title='settings:password' onSubmit={onSubmit} isSaving={save.isPending}>
      {field('current_password', 'settings:password:current', 'current-password')}
      {field('password', 'settings:password:new', 'new-password')}
      {field('password_confirmation', 'form:password_confirmation:label', 'new-password')}
    </SimpleForm>
  );
}
