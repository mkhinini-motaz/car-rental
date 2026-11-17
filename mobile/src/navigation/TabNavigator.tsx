import { TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import TranslatableText from '../components/common/TranslatableText';
import Icon, { IconName } from '../components/ui/Icon';
import TodayScreen, { useTodayCount } from '../screens/TodayScreen';
import PlanningScreen from '../screens/PlanningScreen';
import CarsScreen from '../screens/CarsScreen';
import ClientsScreen from '../screens/ClientsScreen';
import MoreScreen from '../screens/MoreScreen';
import { ScreenProps, TabParamList } from './types';
import { useColors } from '../store/ThemeContext';

const Tab = createBottomTabNavigator<TabParamList>();

function HeaderTitle({ label }: { label: string }): React.JSX.Element {
  const COLORS = useColors();
  return <TranslatableText data={label} style={{ color: COLORS.onNav, fontSize: 20, fontWeight: '600' }} />;
}

const options = (label: string, icon: IconName) => ({
  headerTitle: () => <HeaderTitle label={label} />,
  tabBarLabel: ({ color }: { color: string }) => <TranslatableText data={label} style={{ color, fontSize: 12, fontWeight: '600' }} />,
  tabBarIcon: ({ color, focused }: { color: string, focused: boolean }) => <Icon name={focused ? icon : (icon + '-outline') as IconName} size={24} color={color} />,
});

// The daily tabs; everything else is under More, and detail screens stack on top (HomeNavigator).
export default function TabNavigator({ navigation }: ScreenProps<'Tabs'>): React.JSX.Element {
  const COLORS = useColors();
  const todayCount = useTodayCount();
  const newReservation = () => <TouchableOpacity onPress={() => navigation.navigate('CreateReservation')} hitSlop={10} style={{ marginHorizontal: 16 }}>
    <Icon name='plus-circle' size={28} color={COLORS.onNav} />
  </TouchableOpacity>;

  return (
    <Tab.Navigator screenOptions={{
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.muted,
      tabBarStyle: { borderTopColor: COLORS.line, backgroundColor: COLORS.surface },
      headerStyle: { backgroundColor: COLORS.nav },
      headerShadowVisible: false,
      sceneStyle: { backgroundColor: COLORS.canvas },
    }}>
      <Tab.Screen name='Today' component={TodayScreen} options={{ ...options('common:today', 'calendar-today'), tabBarBadge: todayCount || undefined, headerRight: newReservation }} />
      <Tab.Screen name='Planning' component={PlanningScreen} options={{ ...options('common:planning', 'calendar-month'), headerRight: newReservation }} />
      <Tab.Screen name='Cars' component={CarsScreen} options={options('common:cars', 'car')} />
      <Tab.Screen name='Clients' component={ClientsScreen} options={options('common:clients', 'account-multiple')} />
      <Tab.Screen name='More' component={MoreScreen} options={options('common:more', 'dots-horizontal-circle')} />
    </Tab.Navigator>
  );
}
