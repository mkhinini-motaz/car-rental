import Car from "./Car";

// Money spent on a car (car categories) or on the agency itself (agency categories, for a branch
// or an employee). A repair can be tied to the rental that caused it (`contract_id`).
export default interface Expense {
  id: number,
  category: number,
  amount: number, // millimes
  spent_at: number,
  mileage: number|null,
  garage: string|null,
  note: string|null,
  method: 1|2|3|4, // Payment METHOD_*; only cash is in the cash book's balance
  car_id: number|null,
  car?: Car,
  branch_id?: number|null,
  branch?: { id: number, name: string }|null,
  employee_id?: number|null,
  employee?: { id: number, first_name: string, last_name: string|null }|null,
  contract_id?: number|null,
}

export const CATEGORY_OIL_CHANGE = 1;
export const CATEGORY_REPAIR = 4;
export const CATEGORY_INSTALMENT = 12; // pays for the car: not a running cost
export const CATEGORY_RENT = 20;
export const CATEGORY_PHONE = 24;
// Oil change, tyres, brakes, repair: the car's maintenance log.
export const MAINTENANCE_CATEGORIES = [ 1, 2, 3, 4 ];
// Car: oil, tyres, brakes, repair, fuel, insurance, tax, washing, other, technical visit,
// registration, instalment, accident, GPS, parking.
export const CAR_CATEGORIES = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 ];
// The agency's own (overhead): rent, electricity, water, internet, phone, accountant, bank fees,
// taxes and licences, marketing, software, office, CNSS, other.
export const AGENCY_CATEGORIES = [ 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 39 ];
export const CATEGORIES = [ ...CAR_CATEGORIES, ...AGENCY_CATEGORIES ];
