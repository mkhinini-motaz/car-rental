import React, { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import DirectionsCarOutlined from '@mui/icons-material/DirectionsCarOutlined';
import { requestSignupCode, signup } from '../src/api/auth';
import { PHONE_REGEX } from '../src/constants';
import { useAuthenticateUser, useLang, useT } from '../src/store/Store';
import { validationErrors } from '../src/support/alert';
import { LangSelect } from '../src/layout/Layout';

const MIN_LENGTH = 8;

// An unreachable server is not a wrong answer.
const errorKey = (error: any, key: string) => ! error ? null : error.code === 'ERR_NETWORK' ? 'network:error' : error.response?.status === 422 ? key : 'common:error:happened';

// A new agency in two steps: the agency and its owner's name and phone, which gets a code by SMS;
// then the code and a password. Logs the new owner in (`_app` then leaves this page for Today).
export default function SignupPage() {
  const t = useT();
  const { selectedLang } = useLang();
  const authenticateUser = useAuthenticateUser();
  const [value, setValue] = useState({ agency_name: '', first_name: '', last_name: '', phone: '+216 ', otp: '', password: '', password_confirmation: '' });
  const [fieldError, setFieldError] = useState<string|null>(null);
  const phone = value.phone.replaceAll(' ', '');

  const sendCode = useMutation({ mutationFn: () => requestSignupCode(phone, selectedLang) });
  const create = useMutation({
    mutationFn: () => signup({ ...value, agency_name: value.agency_name.trim(), first_name: value.first_name.trim(), last_name: value.last_name.trim(), phone, otp: value.otp.replaceAll(' ', '') }),
    onSuccess: authenticateUser,
  });
  const codeSent = sendCode.isSuccess;
  const sendError = sendCode.error && validationErrors(sendCode.error).phone ? 'signup:phone:taken' : errorKey(sendCode.error, 'common:error:happened');
  const createError = create.error && validationErrors(create.error).otp ? 'otp:validation:wrong' : errorKey(create.error, 'common:error:happened');

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (! codeSent) {
      const error = [ value.agency_name, value.first_name, value.last_name ].some(text => ! text.trim()) ? 'validation:required' :
        ! PHONE_REGEX.test(phone) ? 'validation:phone:invalid' : null;
      setFieldError(error);
      if (! error) {
        sendCode.mutate();
      }
      return;
    }
    const error = value.otp.replaceAll(' ', '').length !== 6 ? 'otp:validation:wrong' :
      value.password.length < MIN_LENGTH ? 'validation:password:min8' :
      value.password !== value.password_confirmation ? 'validation:password:confirmation' : null;
    setFieldError(error);
    if (! error) {
      create.mutate();
    }
  };
  const field = (name: keyof typeof value, label: string, extra: object = {}) =>
    <TextField label={t(label)} value={value[name]} onChange={event => setValue({ ...value, [name]: event.target.value })} size='medium' {...extra} />;
  const error = fieldError || (codeSent ? createError : sendError);

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'primary.main', p: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 440 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack sx={{ alignItems: 'center', gap: 1, mb: 2.5 }}>
            <DirectionsCarOutlined color='primary' sx={{ fontSize: 48 }} />
            <Typography variant='h5' component='h1'>{t('signup:title')}</Typography>
          </Stack>
          <Stack component='form' onSubmit={onSubmit} sx={{ gap: 2.5 }}>
            {error && <Alert severity='error'>{t(error)}</Alert>}
            {! codeSent ? <>
              {field('agency_name', 'signup:agency_name', { required: true, autoComplete: 'organization' })}
              <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
                {field('first_name', 'form:first_name:label', { required: true, autoComplete: 'given-name' })}
                {field('last_name', 'form:last_name:label', { required: true, autoComplete: 'family-name' })}
              </Stack>
              {field('phone', 'form:phone:label', { required: true, type: 'tel', autoComplete: 'tel' })}
              <Button type='submit' variant='contained' size='large' loading={sendCode.isPending}>{t('signup:send_code')}</Button>
            </> : <>
              <Typography color='text.secondary'>{t('signup:code_hint', { phone: '\u2066' + value.phone + '\u2069' })}</Typography>
              {field('otp', 'form:otp:label', { autoComplete: 'one-time-code', inputMode: 'numeric' })}
              {field('password', 'settings:password:new', { type: 'password', autoComplete: 'new-password' })}
              {field('password_confirmation', 'form:password_confirmation:label', { type: 'password', autoComplete: 'new-password' })}
              <Button type='submit' variant='contained' size='large' loading={create.isPending}>{t('signup:create')}</Button>
              <Button onClick={() => sendCode.reset()}>{t('common:cancel')}</Button>
            </>}
            <Button component={Link} href='/login'>{t('common:login')}</Button>
            <LangSelect />
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
