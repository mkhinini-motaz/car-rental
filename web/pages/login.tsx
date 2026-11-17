import React, { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import DirectionsCarOutlined from '@mui/icons-material/DirectionsCarOutlined';
import { login, requestOtp, resetPassword } from '../src/api/auth';
import { PHONE_REGEX } from '../src/constants';
import { useAuthenticateUser, useLang, useT } from '../src/store/Store';
import { validationErrors } from '../src/support/alert';
import { LangSelect } from '../src/layout/Layout';

// Seeded owner, pre-filled in development only (like the phone app during development).
const DEV = process.env.NODE_ENV === 'development';
const MIN_LENGTH = 8;

// An unreachable server is not a wrong password.
const errorKey = (error: any, wrongKey: string) => ! error ? null : error.code === 'ERR_NETWORK' ? 'network:error' :
  [ 401, 422 ].includes(error.response?.status) ? wrongKey : 'common:error:happened';

// "Forgot password?": a code sent by SMS, or the one the owner gave you when they invited you,
// then a new password. Logs you in.
function ResetForm({ phone, onBack }: { phone: string, onBack: () => void }) {
  const t = useT();
  const { selectedLang } = useLang();
  const authenticateUser = useAuthenticateUser();
  const [value, setValue] = useState({ otp: '', password: '', password_confirmation: '' });
  const [fieldError, setFieldError] = useState<string|null>(null);
  const send = useMutation({ mutationFn: () => requestOtp(phone, selectedLang) });
  const save = useMutation({ mutationFn: () => resetPassword({ ...value, phone, otp: value.otp.replaceAll(' ', '') }), onSuccess: authenticateUser });
  const saveError = save.error && validationErrors(save.error).otp ? 'otp:validation:wrong' : errorKey(save.error, 'common:error:happened');

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const error = value.otp.replaceAll(' ', '').length !== 6 ? 'otp:validation:wrong' :
      value.password.length < MIN_LENGTH ? 'validation:password:min8' :
      value.password !== value.password_confirmation ? 'validation:password:confirmation' : null;
    setFieldError(error);
    if (! error) {
      save.mutate();
    }
  };
  const field = (name: keyof typeof value, label: string, extra: object = {}) =>
    <TextField label={t(label)} value={value[name]} onChange={event => setValue({ ...value, [name]: event.target.value })} size='medium' {...extra} />;

  return (
    <Stack component='form' onSubmit={onSubmit} sx={{ gap: 2.5 }}>
      <Typography color='text.secondary'>{t('otp:hint')}</Typography>
      <Typography sx={{ fontWeight: 600 }}><bdi dir='ltr'>{phone}</bdi></Typography>
      {(fieldError || saveError) && <Alert severity='error'>{t((fieldError || saveError)!)}</Alert>}
      {send.isSuccess && <Alert severity='success'>{t('otp:sent')}</Alert>}
      {send.isError && <Alert severity='error'>{t(errorKey(send.error, 'otp:request:timeout:message')!)}</Alert>}
      <Stack direction='row' sx={{ gap: 1, alignItems: 'center' }}>
        {field('otp', 'form:otp:label', { autoComplete: 'one-time-code', inputMode: 'numeric', sx: { flex: 1 } })}
        <Button variant='outlined' onClick={() => send.mutate()} loading={send.isPending} disabled={send.isSuccess}>{t('form:otp:request')}</Button>
      </Stack>
      {field('password', 'settings:password:new', { type: 'password', autoComplete: 'new-password' })}
      {field('password_confirmation', 'form:password_confirmation:label', { type: 'password', autoComplete: 'new-password' })}
      <Button type='submit' variant='contained' size='large' loading={save.isPending}>{t('common:confirm')}</Button>
      <Button onClick={onBack}>{t('common:cancel')}</Button>
    </Stack>
  );
}

export default function LoginPage() {
  const t = useT();
  const authenticateUser = useAuthenticateUser();
  const [phone, setPhone] = useState(DEV ? '+21623456109' : '+216 ');
  const [password, setPassword] = useState(DEV ? 'azerty' : '');
  const [resetPhone, setResetPhone] = useState<string|null>(null);
  const [phoneError, setPhoneError] = useState(false);
  const { mutate, isPending, error } = useMutation({ mutationFn: login, onSuccess: authenticateUser });
  const loginError = errorKey(error, 'login:error');

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutate({ phone: phone.replaceAll(' ', ''), password });
  };
  // The code screen needs the phone first: the one typed here.
  const onForgot = () => {
    const bare = phone.replaceAll(' ', '');
    setPhoneError(! PHONE_REGEX.test(bare));
    if (PHONE_REGEX.test(bare)) {
      setResetPhone(bare);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'primary.main', p: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 400 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack sx={{ alignItems: 'center', gap: 1, mb: 2.5 }}>
            <DirectionsCarOutlined color='primary' sx={{ fontSize: 48 }} />
            <Typography variant='h5' component='h1'>{t(resetPhone ? 'form:new_password:label' : 'common:login')}</Typography>
          </Stack>
          {resetPhone ? <ResetForm phone={resetPhone} onBack={() => setResetPhone(null)} /> :
            <Stack component='form' onSubmit={onSubmit} sx={{ gap: 2.5 }}>
              {loginError && <Alert severity='error'>{t(loginError)}</Alert>}
              <TextField label={t('form:phone:label')} value={phone} onChange={event => setPhone(event.target.value)} type='tel' autoComplete='username' size='medium'
                error={phoneError} helperText={phoneError && t('validation:phone:invalid')} />
              <TextField label={t('form:password:label')} value={password} onChange={event => setPassword(event.target.value)} type='password' autoComplete='current-password' size='medium' />
              <Button type='submit' variant='contained' size='large' loading={isPending}>{t('common:login')}</Button>
              <Button onClick={onForgot}>{t('common:forgot-password?')}</Button>
              <Button component={Link} href='/signup' sx={{ fontWeight: 700 }}>{t('signup:link')}</Button>
              <LangSelect />
            </Stack>
          }
        </CardContent>
      </Card>
    </Box>
  );
}
