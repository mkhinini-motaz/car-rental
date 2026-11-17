import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Dialog, DialogActions, DialogContent, DialogTitle, Link, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import PersonAdd from '@mui/icons-material/PersonAdd';
import { activity, index, invite, store, update } from '../../src/api/user';
import { branches } from '../../src/api/money';
import User, { ROLE_MANAGER, ROLE_OWNER } from '../../src/classes/User';
import { PHONE_REGEX } from '../../src/constants';
import { useLang, useT, useUser } from '../../src/store/Store';
import { serverFieldErrors, validationErrors } from '../../src/support/alert';
import { formatLocalPhoneNumber, toMaskedPhone } from '../../src/support/utils';
import { useFeedback } from '../../src/components/Feedback';
import { Choice, Loading, Page } from '../../src/components/common';
import { ActivityLog } from '../../src/components/contractSections';

type Invite = { name: string, code: string };

// The code also goes by SMS; the owner can pass it on themselves (WhatsApp, in person).
function InviteDialog({ invite, onClose }: { invite: Invite, onClose: () => void }) {
  const t = useT();
  const { notify } = useFeedback();
  const share = () => {
    const text = t('staff:invite:share', { code: invite.code });
    (navigator.share ? navigator.share({ text }) : navigator.clipboard.writeText(text).then(() => notify('common:copied', 'success'))).catch(() => {});
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth='xs'>
      <DialogTitle>{t('staff:invite:title')}</DialogTitle>
      <DialogContent>
        <Typography variant='h4' sx={{ fontWeight: 700, letterSpacing: 6, textAlign: 'center', my: 2 }}><bdi dir='ltr'>{invite.code}</bdi></Typography>
        <Typography color='text.secondary'>{t('staff:invite:message', { name: invite.name, code: invite.code })}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={share}>{t('common:share')}</Button>
        <Button variant='contained' onClick={onClose}>{t('common:ok')}</Button>
      </DialogActions>
    </Dialog>
  );
}

// Adds a staff account, or edits `user`: name, phone (their login), password, role, the branch a
// manager is limited to, and whether it can still log in. The owner can't demote or disable
// themselves. Added without a password, the person is invited with a code. Below, the account's
// history (who changed what).
function StaffDialog({ user, branchList, onClose, onInvite }: { user: User|null, branchList: { id: number, name: string }[], onClose: () => void, onInvite: (invite: Invite) => void }) {
  const t = useT();
  const { selectedLang } = useLang();
  const isSelf = user?.id === useUser()?.id;
  const queryClient = useQueryClient();
  const { notify, requestError } = useFeedback();
  const { data: history } = useQuery({ queryKey: ['user.activity', user?.id], queryFn: () => activity(user!.id), enabled: !! user });
  const [value, setValue] = useState({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    phone: user ? toMaskedPhone(user.phone) : '+216 ',
    password: '',
    role: user?.role ?? ROLE_MANAGER,
    branch_id: user?.branch_id ?? 0, // 0: every branch
    disabled: user?.disabled ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (field: string) => (fieldValue: any) => setValue(current => ({ ...current, [field]: fieldValue }));

  const save = useMutation({
    mutationFn: () => {
      const input = {
        first_name: value.first_name.trim(),
        last_name: value.last_name.trim(),
        phone: value.phone.replaceAll(' ', ''),
        password: value.password || undefined,
        role: value.role,
        branch_id: value.role === ROLE_MANAGER && value.branch_id ? value.branch_id : null,
      };
      return user ? update(user.id, { ...input, disabled: value.disabled }).then(saved => ({ user: saved, invite_code: undefined })) : store({ ...input, lang: selectedLang });
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['user.index'] });
      queryClient.invalidateQueries({ queryKey: ['user.activity'] });
      onClose();
      if (saved.invite_code) {
        onInvite({ name: saved.user.first_name, code: saved.invite_code });
      }
    },
    onError: (error) => {
      if (validationErrors(error).role) {
        notify('user:self', 'error');
        return;
      }
      const fieldErrors = serverFieldErrors(error, 'validation:phone:used');
      setErrors(fieldErrors);
      if (! Object.keys(fieldErrors).length) {
        requestError(error);
      }
    },
  });

  const sendCode = useMutation({
    mutationFn: () => invite(user!.id, selectedLang),
    onSuccess: (code) => {
      queryClient.invalidateQueries({ queryKey: ['user.activity', user!.id] });
      onClose();
      onInvite({ name: user!.first_name, code });
    },
    onError: requestError,
  });

  const onSave = () => {
    const fieldErrors: Record<string, string> = {};
    for (const field of [ 'first_name', 'last_name' ] as const) {
      if (! value[field].trim()) {
        fieldErrors[field] = 'validation:required';
      }
    }
    if (! PHONE_REGEX.test(value.phone)) {
      fieldErrors.phone = 'validation:phone:invalid';
    }
    if (value.password && value.password.length < 8) {
      fieldErrors.password = 'validation:password:min8';
    }
    setErrors(fieldErrors);
    if (! Object.keys(fieldErrors).length) {
      save.mutate();
    }
  };
  const field = (name: 'first_name'|'last_name'|'phone'|'password', label: string, extra: object = {}) =>
    <TextField label={t(label)} value={value[name]} onChange={event => set(name)(event.target.value)} error={!! errors[name]} helperText={errors[name] && t(errors[name])} {...extra} />;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth='sm'>
      <DialogTitle>{t(user ? 'staff:edit' : 'staff:add')}</DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 2.5, pt: 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
            {field('first_name', 'form:first_name:label', { required: true })}
            {field('last_name', 'form:last_name:label', { required: true })}
          </Stack>
          {field('phone', 'form:phone:label', { required: true, type: 'tel' })}
          {field('password', user ? 'staff:password:new' : 'staff:password:invite', { type: 'password', autoComplete: 'new-password' })}
          {! isSelf && <>
            <Choice label='staff:role' value={value.role} onChange={set('role')} options={[ ROLE_MANAGER, ROLE_OWNER ].map(role => ({ label: 'staff:role:' + role, value: role }))} />
            {value.role === ROLE_MANAGER && branchList.length > 0 && <>
              <Choice label='staff:branch' value={value.branch_id} onChange={set('branch_id')} options={[ { label: 'staff:branch:all', value: 0 }, ...branchList.map(branch => ({ label: branch.name, value: branch.id, raw: true })) ]} />
              <Typography variant='body2' color='text.secondary' sx={{ mt: -1.5 }}>{t('staff:branch:hint')}</Typography>
            </>}
            {user && <Choice label='staff:access' value={value.disabled} onChange={set('disabled')} options={[ { label: 'staff:enabled', value: false }, { label: 'staff:disabled', value: true } ]} />}
          </>}
          <ActivityLog activities={history} />
        </Stack>
      </DialogContent>
      <DialogActions>
        {user && ! isSelf && ! user.disabled && <Button onClick={() => sendCode.mutate()} loading={sendCode.isPending} sx={{ mr: 'auto' }}>{t('staff:invite:send')}</Button>}
        <Button onClick={onClose}>{t('common:cancel')}</Button>
        <Button variant='contained' loading={save.isPending} onClick={onSave}>{t('common:save')}</Button>
      </DialogActions>
    </Dialog>
  );
}

// The owner's staff accounts: who can log in, as owner or manager.
export default function StaffPage() {
  const t = useT();
  const [editing, setEditing] = useState<User|null|undefined>(undefined); // null: a new account
  const [invited, setInvited] = useState<Invite|null>(null);
  const { isLoading, data } = useQuery({ queryKey: ['user.index'], queryFn: index });
  const { data: branchList = [] } = useQuery({ queryKey: ['branch.index'], queryFn: branches });
  const branchName = (id?: number|null) => branchList.find(branch => branch.id === id)?.name;

  return (
    <Page title='staff:label' actions={<Button variant='contained' startIcon={<PersonAdd />} onClick={() => setEditing(null)}>{t('staff:add')}</Button>}>
      <Typography color='text.secondary' sx={{ mb: 2 }}>{t('staff:hint')}</Typography>
      {isLoading ? <Loading /> :
        <Card sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('form:last_name:label')}</TableCell>
                <TableCell>{t('form:phone:label')}</TableCell>
                <TableCell>{t('staff:role')}</TableCell>
                <TableCell>{t('staff:access')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.map(user =>
                <TableRow key={user.id} hover onClick={() => setEditing(user)} sx={{ cursor: 'pointer' }}>
                  <TableCell sx={{ fontWeight: 600, textDecoration: user.disabled ? 'line-through' : 'none', color: user.disabled ? 'text.disabled' : undefined }}>
                    {/* The row opens it on a click; the name, from the keyboard. */}
                    <Link component='button' color='inherit' underline='hover' onClick={() => setEditing(user)} sx={{ font: 'inherit' }}>{user.first_name} {user.last_name}</Link>
                  </TableCell>
                  <TableCell><bdi dir='ltr'>{formatLocalPhoneNumber(user.phone)}</bdi></TableCell>
                  <TableCell>{[ t('staff:role:' + user.role), branchName(user.branch_id) ].filter(Boolean).join(' · ')}</TableCell>
                  <TableCell>{user.disabled ? <Typography color='error' sx={{ fontWeight: 700 }}>{t('staff:disabled')}</Typography> : user.invited ? <Typography color='warning' sx={{ fontWeight: 700 }}>{t('staff:invited')}</Typography> : t('staff:enabled')}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      }
      {editing !== undefined && <StaffDialog user={editing} branchList={branchList} onClose={() => setEditing(undefined)} onInvite={setInvited} />}
      {invited && <InviteDialog invite={invited} onClose={() => setInvited(null)} />}
    </Page>
  );
}
