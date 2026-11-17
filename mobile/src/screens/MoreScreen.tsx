import { useCallback } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { logout } from '../api/auth';
import { useAgency } from '../api/agency';
import { useIsOwner, useLang, useSetUser, useUser } from '../store/hooks';
import { alertConfirmLogout } from '../support/alert';
import { clearUserToken } from '../support/auth';
import User from '../classes/User';
import LangAwareView from '../components/common/LangAwareView';
import TranslatableText from '../components/common/TranslatableText';
import Card from '../components/ui/Card';
import ListGroup from '../components/ui/ListGroup';
import ListRow from '../components/ui/ListRow';
import Screen from '../components/ui/Screen';
import { openPlain, PlainRoute, TabProps } from '../navigation/types';
import { useColors } from '../store/ThemeContext';

// Everything that isn't a daily tab: fines, money (owner), settings, logging out.
export default function MoreScreen({ navigation }: TabProps<'More'>): React.JSX.Element {
  const COLORS = useColors();
  const isOwner = useIsOwner();
  const user = useUser();
  const { data: agency } = useAgency();
  const setUser = useSetUser();
  const queryClient = useQueryClient();
  const { selectedLang } = useLang();
  const row = (title: string, icon: React.ComponentProps<typeof ListRow>['icon'], screen: PlainRoute) =>
    <ListRow key={screen} icon={icon} iconColor={COLORS.primary} title={<TranslatableText data={title} className='text-body text-ink' />} onPress={() => openPlain(navigation, screen)} />;

  const onLogoutPress = useCallback(() => alertConfirmLogout(
    selectedLang,
    // Revoke the token on the API; log out locally even if that fails (offline).
    () => logout()
      .catch(() => {})
      .then(clearUserToken)
      .then(() => {
        queryClient.clear();
        setUser({} as User);
      })
  ), [selectedLang, queryClient, setUser]);

  return (
    <Screen>
      <ScrollView>
        {agency && <Card onPress={isOwner ? () => navigation.navigate('AgencyFormScreen') : undefined}>
          <LangAwareView style={{ gap: 12, alignItems: 'center' }}>
            {agency.logo_url && <Image source={{ uri: agency.logo_url }} style={{ width: 48, height: 48, borderRadius: 8 }} resizeMode='contain' />}
            <View style={{ flex: 1 }}>
              <Text className='text-title font-semibold text-ink'>{agency.name}</Text>
              <Text className='text-meta text-muted'>{user.first_name} {user.last_name}</Text>
            </View>
          </LangAwareView>
        </Card>}
        <ListGroup title='more:daily'>
          {row('common:reservation:create', 'calendar-plus', 'CreateReservation')}
          {row('common:rented_cars', 'car-clock', 'RentedCars')}
          {row('common:fines', 'receipt-text-outline', 'Fines')}
        </ListGroup>
        {isOwner && <ListGroup title='more:money'>
          {row('common:cash_book', 'cash-register', 'CashBook')}
          {row('common:reports', 'chart-box-outline', 'Reports')}
          {row('payroll:label', 'account-cash-outline', 'EmployeesScreen')}
          {row('bill:label', 'calendar-sync-outline', 'BillsScreen')}
          {row('car:sold:label', 'car-off', 'SoldCarsScreen')}
        </ListGroup>}
        <ListGroup>
          {row('common:settings', 'cog-outline', 'Settings')}
          <ListRow icon='logout' iconColor={COLORS.danger} title={<TranslatableText data='common:logout' className='text-body text-danger' />} onPress={onLogoutPress} chevron={false} />
        </ListGroup>
      </ScrollView>
    </Screen>
  );
}
