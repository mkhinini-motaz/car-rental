export default interface Payment {
  id: number,
  contract_id: number,
  amount: number, // millimes
  method: 1|2|3|4|5,
  paid_at: number,
}

// Also used for the deposit's method and an expense's.
export const METHOD_CASH = 1;
export const METHOD_CARD = 2;
export const METHOD_TRANSFER = 3;
export const METHOD_CHEQUE = 4;
export const METHODS = [ METHOD_CASH, METHOD_CARD, METHOD_TRANSFER, METHOD_CHEQUE ];
// Taken out of the deposit the agency holds (return charges): payments only.
export const METHOD_DEPOSIT = 5;
