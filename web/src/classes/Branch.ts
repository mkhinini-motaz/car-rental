// One of the agency's premises and its rent (not a delivery place).
export default interface Branch {
  id: number,
  name: string,
  address: string|null,
  monthly_rent: number, // millimes
}

// A bill that comes back every `every_months` (agency categories). Paying it records the expense.
export interface RecurringBill {
  id: number,
  category: number,
  amount: number,
  every_months: number,
  next_due_at: number,
  note: string|null,
  branch_id: number|null,
  branch?: { id: number, name: string }|null,
}
