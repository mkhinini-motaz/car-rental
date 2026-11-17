import { useNavigation } from '@react-navigation/native';

// Opens the page of what was tapped, from anywhere: every car, client, contract, fine and employee
// shown in the app leads to its page.
export function useOpen() {
  const navigation = useNavigation<any>();
  return {
    car: (carId: number) => navigation.navigate('CarScreen', { carId }),
    client: (clientId: number) => navigation.navigate('ClientScreen', { clientId }),
    contract: (contractId: number) => navigation.navigate('ContractScreen', { contractId }),
    fine: (fineId: number) => navigation.navigate('FineScreen', { fineId }),
    employee: (employeeId: number) => navigation.navigate('EmployeeScreen', { employeeId }),
  };
}
