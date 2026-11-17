import { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import Branch, { RecurringBill } from '../classes/Branch';
import Car from '../classes/Car';
import Employee from '../classes/Employee';
import { ContractDamage } from '../classes/Inspection';
import User from '../classes/User';

// The bottom tabs (TabNavigator).
export type TabParamList = {
  Today: undefined,
  Planning: undefined,
  Cars: undefined,
  Clients: undefined,
  More: undefined,
};

// Every screen once signed in (HomeNavigator) and its params; navigate() is checked against it.
export type HomeParamList = {
  Tabs: NavigatorScreenParams<TabParamList>|undefined,
  CreateReservation: { car?: Car, startsAt?: number }|undefined, // from the planning: that car, that day
  RentedCars: undefined,
  Fines: undefined,
  CashBook: undefined,
  Reports: undefined,
  Settings: undefined,
  AccountFormScreen: undefined,
  PasswordFormScreen: undefined,
  LanguageScreen: undefined,
  RemindersFormScreen: undefined,
  CarPurchaseFormScreen: { carId: number },
  CarSaleFormScreen: { carId: number },
  DamageRepairFormScreen: { carId: number, damage: ContractDamage },
  CarDamageFormScreen: { carId: number },
  PastRentalFormScreen: { carId: number },
  ImportScreen: undefined,
  IncomeFormScreen: { carId?: number }|undefined,
  EmployeesScreen: undefined,
  EmployeeScreen: { employeeId: number },
  EmployeeFormScreen: { employee?: Employee }|undefined,
  SalaryPaymentFormScreen: { employee: Employee, type?: number, amount?: number },
  BranchesScreen: undefined,
  BranchFormScreen: { branch?: Branch }|undefined,
  BillsScreen: undefined,
  BillFormScreen: { bill?: RecurringBill }|undefined,
  SoldCarsScreen: undefined,
  CarScreen: { carId: number },
  ClientScreen: { clientId: number },
  ClientFormScreen: { clientId?: number }|undefined,
  ContractScreen: { contractId: number },
  CarFormScreen: { carId?: number }|undefined,
  HandoverScreen: { contractId: number, stage: number },
  AgencyFormScreen: undefined,
  ExpenseFormScreen: { carId?: number, contractId?: number }|undefined,
  FineFormScreen: undefined,
  FineScreen: { fineId: number },
  PricingScreen: undefined,
  StaffScreen: undefined,
  StaffFormScreen: { user?: User }|undefined,
  BlockFormScreen: { car: Car, startsAt: number },
  CashMovementFormScreen: undefined,
};

// The screens opened without params (menus list them by name), and navigate() for one of them:
// React Navigation's overloads don't take a union of names.
export type PlainRoute = { [K in keyof HomeParamList]: undefined extends HomeParamList[K] ? K : never }[keyof HomeParamList];
export const openPlain = (navigation: { navigate: unknown }, screen: PlainRoute) => (navigation.navigate as (screen: PlainRoute) => void)(screen);

export type LoginParamList = {
  LoginScreen: undefined,
  NewPasswordScreen: { phone: string },
  SignUpScreen: undefined,
};

export type ScreenProps<N extends keyof HomeParamList> = NativeStackScreenProps<HomeParamList, N>;
export type TabProps<N extends keyof TabParamList> = CompositeScreenProps<BottomTabScreenProps<TabParamList, N>, NativeStackScreenProps<HomeParamList>>;
export type LoginProps<N extends keyof LoginParamList> = NativeStackScreenProps<LoginParamList, N>;

// useNavigation() without a type argument knows the signed-in screens.
declare global {
  namespace ReactNavigation {
    interface RootParamList extends HomeParamList {}
  }
}
