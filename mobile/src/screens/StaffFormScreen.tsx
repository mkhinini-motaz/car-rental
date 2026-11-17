import { useState } from 'react';
import { Alert, Share, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { activity, invite, store, update } from '../api/user';
import { branches } from '../api/money';
import User, { ROLE_MANAGER, ROLE_OWNER } from '../classes/User';
import { useLang, useT, useUser } from '../store/hooks';
import { alertMessage, alertRequestError, validationErrors } from '../support/alert';
import { FORM_FIELD_TYPE_PASSWORD, FORM_FIELD_TYPE_PHONE, FORM_FIELD_TYPE_RADIO, FORM_FIELD_TYPE_SUBMIT, FORM_FIELD_TYPE_TEXT, serverFieldErrors } from '../support/form';
import Form from '../components/Form/Form';
import Button from '../components/ui/Button';
import Screen from '../components/ui/Screen';
import ActivityLog from '../components/contract/ActivityLog';
import { toMaskedPhone } from '../components/client/clientForm';
import { ScreenProps } from '../navigation/types';

const ENABLED = 1;
const DISABLED = 2;
const MIN_LENGTH = 8;

// Adds a staff account, or edits one passed as `user`: name, phone (their login), password, role,
// the branch a manager is limited to, and whether it can still log in. Added without a password,
// the person is invited with a code. Below, the account's history (who changed what).
export default function StaffFormScreen({ route, navigation }: ScreenProps<'StaffFormScreen'>): React.JSX.Element {
  const user: User|undefined = route.params?.user;
  const isSelf = user?.id === useUser().id;
  const { selectedLang } = useLang();
  const t = useT();
  const queryClient = useQueryClient();
  const { data: branchList = [] } = useQuery({ queryKey: ['branch.index'], queryFn: branches }); // staff is the owner's
  const { data: history } = useQuery({ queryKey: ['user.activity', user?.id], queryFn: () => activity(user!.id), enabled: !! user });
  const [value, setValue] = useState({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    phone: user ? toMaskedPhone(user.phone) : '+216 ',
    new_password: '',
    role: user?.role ?? ROLE_MANAGER,
    branch_id: user?.branch_id ?? 0, // 0: every branch
    status: user?.disabled ? DISABLED : ENABLED,
  });
  const [serverErrors, setServerErrors] = useState({});

  const save = useMutation({
    mutationFn: () => {
      const input = {
        first_name: value.first_name.trim(),
        last_name: value.last_name.trim(),
        phone: value.phone.replaceAll(' ', ''),
        password: value.new_password || undefined,
        role: value.role,
        branch_id: value.role === ROLE_MANAGER && value.branch_id ? value.branch_id : null,
      };
      return user ? update(user.id, { ...input, disabled: value.status === DISABLED }).then(saved => ({ user: saved, invite_code: undefined })) : store({ ...input, lang: selectedLang });
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['user.index'] });
      queryClient.invalidateQueries({ queryKey: ['user.activity'] });
      navigation.goBack();
      if (saved.invite_code) {
        showCode(saved.user.first_name, saved.invite_code);
      }
    },
    onError: (error) => {
      if (validationErrors(error).role) {
        alertMessage(selectedLang, 'user:self');
        return;
      }
      const errors = serverFieldErrors(error, 'validation:phone:used');
      setServerErrors({ ...errors, new_password: errors.password });
      if (! Object.keys(errors).length) {
        alertRequestError(selectedLang, error);
      }
    },
  });

  const sendCode = useMutation({
    mutationFn: () => invite(user!.id, selectedLang),
    onSuccess: (code) => {
      queryClient.invalidateQueries({ queryKey: ['user.activity', user!.id] });
      showCode(user!.first_name, code);
    },
    onError: (error) => alertRequestError(selectedLang, error),
  });

  // The code also goes by SMS; the owner can pass it on themselves (WhatsApp, in person).
  const showCode = (name: string, code: string) => Alert.alert(t('staff:invite:title'), t('staff:invite:message', { name, code }), [
    { text: t('common:share'), onPress: () => Share.share({ message: t('staff:invite:share', { code }) }) },
    { text: t('common:ok') },
  ]);

  const fields = [
    { name: 'first_name', label: 'form:first_name:label', type: FORM_FIELD_TYPE_TEXT },
    { name: 'last_name', label: 'form:last_name:label', type: FORM_FIELD_TYPE_TEXT },
    { name: 'phone', label: 'form:phone:label', type: FORM_FIELD_TYPE_PHONE },
    { name: 'new_password', label: user ? 'staff:password:new' : 'staff:password:invite', type: FORM_FIELD_TYPE_PASSWORD, required: false },
    ...(isSelf ? [] : [
      { name: 'role', label: 'staff:role', type: FORM_FIELD_TYPE_RADIO, options: [ { label: 'staff:role:' + ROLE_MANAGER, value: ROLE_MANAGER }, { label: 'staff:role:' + ROLE_OWNER, value: ROLE_OWNER } ] },
      ...(value.role === ROLE_MANAGER && branchList.length ? [ {
        name: 'branch_id', label: 'staff:branch', type: FORM_FIELD_TYPE_RADIO, required: false, hint: 'staff:branch:hint',
        options: [ { label: 'staff:branch:all', value: 0 }, ...branchList.map(branch => ({ label: branch.name, value: branch.id })) ],
      } ] : []),
      ...(user ? [ { name: 'status', label: 'staff:access', type: FORM_FIELD_TYPE_RADIO, options: [ { label: 'staff:enabled', value: ENABLED }, { label: 'staff:disabled', value: DISABLED } ] } ] : []),
    ]),
    { label: 'common:save', type: FORM_FIELD_TYPE_SUBMIT, isLoading: save.isPending },
  ];

  return (
    <Screen white>
      <Form
        value={value}
        fields={fields}
        onChange={setValue}
        onSubmit={() => {
          if (value.new_password && value.new_password.length < MIN_LENGTH) {
            setServerErrors({ new_password: 'validation:password:min8' });
            return;
          }
          setServerErrors({});
          save.mutate();
        }}
        serverErrors={serverErrors}
      >
        {user && ! isSelf && ! user.disabled && <View style={{ padding: 16 }}>
          <Button label='staff:invite:send' variant='secondary' icon='message-lock-outline' onPress={() => sendCode.mutate()} isLoading={sendCode.isPending} />
        </View>}
        {!! history?.length && <View style={{ padding: 16 }}><ActivityLog activities={history} /></View>}
      </Form>
    </Screen>
  );
}
