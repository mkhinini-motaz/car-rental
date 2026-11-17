// Someone the agency pays, with or without a login. The owner's business only.
export default interface Employee {
  id: number,
  first_name: string,
  last_name: string|null,
  phone: string|null,
  role_label: string|null, // "mechanic", "washer"
  monthly_salary: number, // millimes
  hired_at: number|null,
  active: boolean,
  user_id: number|null,
  paid_this_month?: number,
  due_this_month?: number, // salary less salary and advances paid this month
  payments?: SalaryPayment[], // one employee
  year_total?: number,
}

export interface SalaryPayment {
  id: number,
  employee_id: number,
  month: string, // 'YYYY-MM' it counts for
  type: 1|2|3,
  amount: number,
  paid_at: number,
  method: 1|2|3|4,
  note: string|null,
}

// An advance reduces what is due at the end of the month; a bonus is on top.
export const TYPE_SALARY = 1;
export const TYPE_ADVANCE = 2;
export const TYPE_BONUS = 3;
export const TYPES = [ TYPE_SALARY, TYPE_ADVANCE, TYPE_BONUS ];

export const employeeName = (employee: Pick<Employee, 'first_name' | 'last_name'>) => [ employee.first_name, employee.last_name ].filter(Boolean).join(' ');
