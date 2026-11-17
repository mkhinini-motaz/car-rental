import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useMutation } from '@tanstack/react-query';
import { TextField } from '@mui/material';
import { updateMe } from '../../src/api/auth';
import { PHONE_REGEX } from '../../src/constants';
import { useStore, useT } from '../../src/store/Store';
import { serverFieldErrors } from '../../src/support/alert';
import { toMaskedPhone } from '../../src/support/utils';
import { useFeedback } from '../../src/components/Feedback';
import SimpleForm from '../../src/components/SimpleForm';

// Your own name and phone (the phone is your login).
export default function ProfilePage() {
  const t = useT();
  const router = useRouter();
  const { user, setUser } = useStore();
  const { notify, requestError } = useFeedback();
  const [value, setValue] = useState({ first_name: user!.first_name, last_name: user!.last_name, phone: toMaskedPhone(user!.phone) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () => updateMe({ first_name: value.first_name.trim(), last_name: value.last_name.trim(), phone: value.phone.replaceAll(' ', '') }),
    onSuccess: (updated) => {
      setUser({ ...user!, ...updated });
      notify('settings:saved', 'success');
      router.push('/settings');
    },
    onError: (error) => {
      const fieldErrors = serverFieldErrors(error, 'validation:phone:used');
      setErrors(fieldErrors);
      if (! Object.keys(fieldErrors).length) {
        requestError(error);
      }
    },
  });
  const onSubmit = () => {
    const fieldErrors: Record<string, string> = {};
    for (const field of [ 'first_name', 'last_name' ] as const) {
      if (! value[field].trim()) {
        fieldErrors[field] = 'validation:required';
      }
    }
    if (! PHONE_REGEX.test(value.phone)) {
      fieldErrors.phone = 'validation:phone:invalid';
    }
    setErrors(fieldErrors);
    if (! Object.keys(fieldErrors).length) {
      save.mutate();
    }
  };
  const field = (name: keyof typeof value, label: string, extra: object = {}) =>
    <TextField label={t(label)} value={value[name]} onChange={event => setValue({ ...value, [name]: event.target.value })} error={!! errors[name]} helperText={errors[name] && t(errors[name])} required {...extra} />;

  return (
    <SimpleForm title='settings:profile' onSubmit={onSubmit} isSaving={save.isPending}>
      {field('first_name', 'form:first_name:label')}
      {field('last_name', 'form:last_name:label')}
      {field('phone', 'form:phone:label', { type: 'tel', autoComplete: 'username' })}
    </SimpleForm>
  );
}
