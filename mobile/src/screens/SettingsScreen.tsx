import { ScrollView } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { logout } from '../api/auth';
import { useIsOwner, useLang, useSetUser, useT, useUser } from '../store/hooks';
import { alertConfirmLogout } from '../support/alert';
import { clearUserToken } from '../support/auth';
import User from '../classes/User';
import { formatLocalPhoneNumber } from '../support/utils';
import TranslatableText from '../components/common/TranslatableText';
import { IconName } from '../components/ui/Icon';
import ListGroup from '../components/ui/ListGroup';
import ListRow from '../components/ui/ListRow';
import Screen from '../components/ui/Screen';
import { openPlain, PlainRoute, ScreenProps } from '../navigation/types';
import { useColors } from '../store/ThemeContext';

const { version } = require('../../package.json');

// Grouped like the phone's own settings: your account, then the agency's (owner only), then the app.
export default function SettingsScreen({ navigation }: ScreenProps<'Settings'>): React.JSX.Element {
  const COLORS = useColors();
  const isOwner = useIsOwner();
  const user = useUser();
  const { selectedLang } = useLang();
  const t = useT();
  const setUser = useSetUser();
  const queryClient = useQueryClient();
  const row = (label: string, icon: IconName, screen: PlainRoute, subtitle?: string) =>
    <ListRow key={label} icon={icon} iconColor={COLORS.primary} title={<TranslatableText data={label} className='text-body text-ink' />} subtitle={subtitle} onPress={() => openPlain(navigation, screen)} />;
  const onLogoutPress = () => alertConfirmLogout(
    selectedLang,
    () => logout().catch(() => {}).then(clearUserToken).then(() => {
      queryClient.clear();
      setUser({} as User);
    }),
  );

  return (
    <Screen>
      <ScrollView>
        <ListGroup title='settings:account'>
          {row('settings:profile', 'account-edit-outline', 'AccountFormScreen', user.first_name + ' ' + user.last_name + ' · ' + formatLocalPhoneNumber(user.phone ?? ''))}
          {row('settings:password', 'lock-outline', 'PasswordFormScreen')}
          <ListRow icon='logout' iconColor={COLORS.danger} title={<TranslatableText data='common:logout' className='text-body text-danger' />} onPress={onLogoutPress} chevron={false} />
        </ListGroup>
        {isOwner && <>
          <ListGroup title='settings:agency'>
            {row('agency:edit', 'storefront-outline', 'AgencyFormScreen')}
            {row('pricing:label', 'tag-outline', 'PricingScreen')}
            {row('branch:label', 'storefront-outline', 'BranchesScreen')}
            {row('bill:label', 'calendar-sync-outline', 'BillsScreen')}
            {row('import:title', 'database-import', 'ImportScreen')}
          </ListGroup>
          <ListGroup title='settings:team'>
            {row('staff:label', 'badge-account-outline', 'StaffScreen')}
            {row('payroll:label', 'account-cash-outline', 'EmployeesScreen')}
          </ListGroup>
        </>}
        <ListGroup title='settings:app'>
          {row('settings:language', 'translate', 'LanguageScreen', t('lang:' + selectedLang))}
          {isOwner && row('settings:reminders', 'bell-outline', 'RemindersFormScreen')}
          <ListRow icon='information-outline' title={<TranslatableText data='settings:version' className='text-body text-ink' />} meta={version} />
        </ListGroup>
      </ScrollView>
    </Screen>
  );
}
