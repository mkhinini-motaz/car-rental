import React from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { useHandoverQueue } from '../support/handoverQueue';
import { usePushNotifications } from '../support/push';
import TabNavigator from './TabNavigator';
import CarScreen from '../screens/CarScreen';
import ClientScreen from '../screens/ClientScreen';
import ClientFormScreen from '../screens/ClientFormScreen';
import ContractScreen from '../screens/ContractScreen';
import CarFormScreen from '../screens/CarFormScreen';
import HandoverScreen from '../screens/HandoverScreen';
import AgencyFormScreen from '../screens/AgencyFormScreen';
import ExpenseFormScreen from '../screens/ExpenseFormScreen';
import FineFormScreen from '../screens/FineFormScreen';
import FineScreen from '../screens/FineScreen';
import PricingScreen from '../screens/PricingScreen';
import StaffScreen from '../screens/StaffScreen';
import StaffFormScreen from '../screens/StaffFormScreen';
import BlockFormScreen from '../screens/BlockFormScreen';
import CashMovementFormScreen from '../screens/CashMovementFormScreen';
import CreateReservationScreen from '../screens/CreateReservationScreen';
import RentedCarsScreen from '../screens/RentedCarsScreen';
import FinesScreen from '../screens/FinesScreen';
import CashBookScreen from '../screens/CashBookScreen';
import ReportsScreen from '../screens/ReportsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AccountFormScreen from '../screens/AccountFormScreen';
import PasswordFormScreen from '../screens/PasswordFormScreen';
import LanguageScreen from '../screens/LanguageScreen';
import RemindersFormScreen from '../screens/RemindersFormScreen';
import CarPurchaseFormScreen from '../screens/CarPurchaseFormScreen';
import CarSaleFormScreen from '../screens/CarSaleFormScreen';
import DamageRepairFormScreen from '../screens/DamageRepairFormScreen';
import CarDamageFormScreen from '../screens/CarDamageFormScreen';
import PastRentalFormScreen from '../screens/PastRentalFormScreen';
import ImportScreen from '../screens/ImportScreen';
import IncomeFormScreen from '../screens/IncomeFormScreen';
import EmployeesScreen from '../screens/EmployeesScreen';
import EmployeeScreen from '../screens/EmployeeScreen';
import EmployeeFormScreen from '../screens/EmployeeFormScreen';
import SalaryPaymentFormScreen from '../screens/SalaryPaymentFormScreen';
import BranchesScreen from '../screens/BranchesScreen';
import BranchFormScreen from '../screens/BranchFormScreen';
import BillsScreen from '../screens/BillsScreen';
import BillFormScreen from '../screens/BillFormScreen';
import SoldCarsScreen from '../screens/SoldCarsScreen';
import TranslatableText from '../components/common/TranslatableText';
import { HomeParamList } from './types';
import { useColors } from '../store/ThemeContext';

const title = (label: string) => () => <HeaderTitle label={label} />;

function HeaderTitle({ label }: { label: string }): React.JSX.Element {
  const COLORS = useColors();
  return <TranslatableText data={label} style={{ color: COLORS.onNav, fontSize: 20, fontWeight: '600' }} />;
}

const Stack = createNativeStackNavigator<HomeParamList>();


export default function HomeNavigator({ }): React.JSX.Element {
    const COLORS = useColors();
    useHandoverQueue(useQueryClient()); // sends handovers saved without network
    usePushNotifications(); // the agency's morning alerts
    return (
        <Stack.Navigator screenOptions={{ headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false, headerStyle: { backgroundColor: COLORS.nav }, headerTintColor: COLORS.onNav, headerTitleStyle: { color: COLORS.onNav }, contentStyle: { backgroundColor: COLORS.canvas } }}>
            <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
            <Stack.Screen name="CreateReservation" component={CreateReservationScreen} options={{ headerTitle: title('common:reservation:create') }} />
            <Stack.Screen name="RentedCars" component={RentedCarsScreen} options={{ headerTitle: title('common:rented_cars') }} />
            <Stack.Screen name="Fines" component={FinesScreen} options={{ headerTitle: title('common:fines') }} />
            <Stack.Screen name="CashBook" component={CashBookScreen} options={{ headerTitle: title('common:cash_book') }} />
            <Stack.Screen name="Reports" component={ReportsScreen} options={{ headerTitle: title('common:reports') }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerTitle: title('common:settings') }} />
            <Stack.Screen name="AccountFormScreen" component={AccountFormScreen} options={{ headerTitle: title('settings:profile') }} />
            <Stack.Screen name="PasswordFormScreen" component={PasswordFormScreen} options={{ headerTitle: title('settings:password') }} />
            <Stack.Screen name="LanguageScreen" component={LanguageScreen} options={{ headerTitle: title('settings:language') }} />
            <Stack.Screen name="RemindersFormScreen" component={RemindersFormScreen} options={{ headerTitle: title('settings:reminders') }} />
            <Stack.Screen name="CarPurchaseFormScreen" component={CarPurchaseFormScreen} options={{ headerTitle: title('car:purchase') }} />
            <Stack.Screen name="CarSaleFormScreen" component={CarSaleFormScreen} options={{ headerTitle: title('car:sell') }} />
            <Stack.Screen name="DamageRepairFormScreen" component={DamageRepairFormScreen} options={{ headerTitle: title('damage:repair') }} />
            <Stack.Screen name="CarDamageFormScreen" component={CarDamageFormScreen} options={{ headerTitle: title('damage:mark') }} />
            <Stack.Screen name="PastRentalFormScreen" component={PastRentalFormScreen} options={{ headerTitle: title('contract:past:add') }} />
            <Stack.Screen name="ImportScreen" component={ImportScreen} options={{ headerTitle: title('import:title') }} />
            <Stack.Screen name="IncomeFormScreen" component={IncomeFormScreen} options={{ headerTitle: title('income:add') }} />
            <Stack.Screen name="EmployeesScreen" component={EmployeesScreen} options={{ headerTitle: title('payroll:label') }} />
            <Stack.Screen name="EmployeeScreen" component={EmployeeScreen} options={{ headerTitle: title('payroll:employee') }} />
            <Stack.Screen name="EmployeeFormScreen" component={EmployeeFormScreen} options={{ headerTitle: title('payroll:employee') }} />
            <Stack.Screen name="SalaryPaymentFormScreen" component={SalaryPaymentFormScreen} options={{ headerTitle: title('payroll:pay') }} />
            <Stack.Screen name="BranchesScreen" component={BranchesScreen} options={{ headerTitle: title('branch:label') }} />
            <Stack.Screen name="BranchFormScreen" component={BranchFormScreen} options={{ headerTitle: title('branch:label') }} />
            <Stack.Screen name="BillsScreen" component={BillsScreen} options={{ headerTitle: title('bill:label') }} />
            <Stack.Screen name="BillFormScreen" component={BillFormScreen} options={{ headerTitle: title('bill:label') }} />
            <Stack.Screen name="SoldCarsScreen" component={SoldCarsScreen} options={{ headerTitle: title('car:sold:label') }} />
            <Stack.Screen name="CarScreen" component={CarScreen} options={{ title: '' }} />
            <Stack.Screen name="ClientScreen" component={ClientScreen} options={{ title: '' }} />
            <Stack.Screen
                name="ClientFormScreen"
                component={ClientFormScreen}
                options={({ route }) => ({ headerTitle: title(route.params?.clientId ? 'client:edit' : 'client:new') })}
            />
            <Stack.Screen name="ContractScreen" component={ContractScreen} options={{ headerTitle: title('contract:label') }} />
            <Stack.Screen
                name="CarFormScreen"
                component={CarFormScreen}
                options={({ route }) => ({ headerTitle: title(route.params?.carId ? 'car:edit' : 'car:new') })}
            />
            <Stack.Screen
                name="HandoverScreen"
                component={HandoverScreen}
                options={({ route }) => ({ headerTitle: title(route.params.stage === 1 ? 'handover:pickup' : 'handover:return') })}
            />
            <Stack.Screen name="AgencyFormScreen" component={AgencyFormScreen} options={{ headerTitle: title('agency:edit') }} />
            <Stack.Screen name="ExpenseFormScreen" component={ExpenseFormScreen} options={{ headerTitle: title('expense:add') }} />
            <Stack.Screen name="FineFormScreen" component={FineFormScreen} options={{ headerTitle: title('fine:new') }} />
            <Stack.Screen name="FineScreen" component={FineScreen} options={{ headerTitle: title('fine:label') }} />
            <Stack.Screen name="PricingScreen" component={PricingScreen} options={{ headerTitle: title('pricing:label') }} />
            <Stack.Screen name="StaffScreen" component={StaffScreen} options={{ headerTitle: title('staff:label') }} />
            <Stack.Screen
                name="StaffFormScreen"
                component={StaffFormScreen}
                options={({ route }) => ({ headerTitle: title(route.params?.user ? 'staff:edit' : 'staff:add') })}
            />
            <Stack.Screen name="BlockFormScreen" component={BlockFormScreen} options={{ headerTitle: title('block:new') }} />
            <Stack.Screen name="CashMovementFormScreen" component={CashMovementFormScreen} options={{ headerTitle: title('cash:movement:add') }} />

        </Stack.Navigator>
    );
}