import client from './client';
import Branch, { RecurringBill } from '../classes/Branch';
import Car from '../classes/Car';
import Employee, { SalaryPayment } from '../classes/Employee';
import Expense from '../classes/Expense';
import Income from '../classes/Income';
import { QueryContext } from './query';

// The owner's money endpoints (a manager gets a 403): purchase and sale of cars, other income,
// branches, recurring bills and payroll.

export type PurchaseInput = Pick<Car, 'purchase_price' | 'bought_at' | 'purchase_fees' | 'supplier' | 'advance' | 'instalment_amount' | 'instalment_months' | 'first_instalment_at' | 'instalments_paid_before' | 'earned_before' | 'lender' | 'expected_sale_price'>;

export function updatePurchase(carId: number, data: PurchaseInput): Promise<Car> {
  return client.put('car/' + carId + '/purchase', data).then(response => response.data.data);
}

// 422 `car:sale:busy` while a rental is booked or out.
export function sell(carId: number, data: { sale_price: number, buyer_name: string, buyer_phone: string|null, sale_method: number, sold_at?: number }): Promise<Car> {
  return client.post('car/' + carId + '/sale', data).then(response => response.data.data);
}

export function undoSale(carId: number): Promise<Car> {
  return client.delete('car/' + carId + '/sale').then(response => response.data.data);
}

// queryKey: ['car.sold']
export function soldCars(): Promise<Car[]> {
  return client.get('car', { params: { sold: 1, perPage: 100 } }).then(response => response.data.data);
}

export function storeIncome(data: Omit<Income, 'id' | 'received_at'> & { received_at?: number }): Promise<Income> {
  return client.post('income', data).then(response => response.data.data);
}

export function destroyIncome(id: number): Promise<void> {
  return client.delete('income/' + id).then(() => {});
}

// queryKey: ['branch.index']
export function branches(): Promise<Branch[]> {
  return client.get('branch').then(response => response.data.data);
}

export function saveBranch(data: Omit<Branch, 'id'>, id?: number): Promise<Branch> {
  return (id ? client.put('branch/' + id, data) : client.post('branch', data)).then(response => response.data.data);
}

export function destroyBranch(id: number): Promise<void> {
  return client.delete('branch/' + id).then(() => {});
}

// queryKey: ['bill.index']
export function bills(): Promise<RecurringBill[]> {
  return client.get('recurring-bill').then(response => response.data.data);
}

export function saveBill(data: Omit<RecurringBill, 'id' | 'branch'>, id?: number): Promise<RecurringBill> {
  return (id ? client.put('recurring-bill/' + id, data) : client.post('recurring-bill', data)).then(response => response.data.data);
}

export function destroyBill(id: number): Promise<void> {
  return client.delete('recurring-bill/' + id).then(() => {});
}

// Records the expense and moves the due date.
export function payBill(id: number, method: number, amount?: number): Promise<Expense> {
  return client.post('recurring-bill/' + id + '/pay', { method, amount }).then(response => response.data.data);
}

// queryKey: ['employee.index']
export function employees(): Promise<Employee[]> {
  return client.get('employee').then(response => response.data.data);
}

// queryKey: ['employee.show', { id }]
export function employee({ queryKey }: QueryContext): Promise<Employee> {
  const [_key, { id }] = queryKey;

  return client.get('employee/' + id).then(response => response.data.data);
}

export type EmployeeInput = Omit<Employee, 'id' | 'paid_this_month' | 'due_this_month' | 'payments' | 'year_total'>;

export function saveEmployee(data: EmployeeInput, id?: number): Promise<Employee> {
  return (id ? client.put('employee/' + id, data) : client.post('employee', data)).then(response => response.data.data);
}

export function paySalary(employeeId: number, data: Omit<SalaryPayment, 'id' | 'employee_id' | 'paid_at' | 'month'> & { month?: string }): Promise<SalaryPayment> {
  return client.post('employee/' + employeeId + '/payment', data).then(response => response.data.data);
}

export function destroySalaryPayment(employeeId: number, paymentId: number): Promise<void> {
  return client.delete('employee/' + employeeId + '/payment/' + paymentId).then(() => {});
}

// Everything money screens show: call after any change here.
export const MONEY_QUERIES = [ 'car.show', 'car.index', 'car.sold', 'dashboard', 'report', 'cashbook', 'expense.index', 'employee.index', 'employee.show', 'branch.index', 'bill.index' ];
