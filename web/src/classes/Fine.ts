import Car from "./Car";
import Client from "./Client";
import Contract from "./Contract";

// A traffic fine, matched to the rental active when it was committed (none if the car was at the
// agency, or the rental was kept on paper: staff can then name the renter, `client`).
export default interface Fine {
  id: number,
  committed_at: number,
  amount: number, // millimes
  reference: string|null,
  note: string|null,
  status: 1|2|3|4,
  settled_at: number|null,
  method: 1|2|3|4|null, // how the client paid the agency (Payment METHOD_*); null: straight to the authority
  paid_out_at: number|null, // the agency paid the authority, whoever pays it back; cash ones are in the cash book
  paid_out_method: 1|2|3|4|null,
  car_id: number,
  contract_id: number|null,
  client_id: number|null, // the renter named by staff when no rental in the app matches
  car?: Car,
  contract?: Contract|null,
  client?: Client|null,
}

// The client's side; the agency paying the authority is `paid_out_at`.
export const STATUS_UNPAID = 1; // the client owes it
export const STATUS_PAID_BY_CLIENT = 2;
export const STATUS_FROM_DEPOSIT = 3;
export const STATUS_PAID_BY_AGENCY = 4;
