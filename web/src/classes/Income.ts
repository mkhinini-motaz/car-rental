// Money received that isn't rent, on a car or not. Cash ones are in the cash book.
export default interface Income {
  id: number,
  category: number,
  amount: number, // millimes
  received_at: number,
  method: 1|2|3|4,
  note: string|null,
  car_id: number|null,
}

export const CATEGORY_INSURANCE_PAYOUT = 1;
export const CATEGORY_REIMBURSEMENT = 2;
export const CATEGORY_PARTS_SALE = 3;
export const CATEGORY_OTHER = 4;
export const CATEGORIES = [ 1, 2, 3, 4 ];
