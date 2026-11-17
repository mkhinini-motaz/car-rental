import Contract from "./Contract";
import DocumentPhoto from "./Document";

// Only the name and phone are required; the rest is usually filled in at pickup.
export default interface Client {
  id: number,
  first_name: string,
  last_name: string,
  phone: string,
  gender: 1|2|null,
  birth_date: string|null, // dd/mm/yyyy
  id_number: string|null,
  driver_licence_number: string|null,
  driver_licence_delivery_date: string|null, // dd/mm/yyyy
  driver_licence_expiry_date: string|null, // dd/mm/yyyy
  flag: 1|2|3|4|null, // blacklisted, and why: FLAGS
  notes: string|null,
  rentals_before: number, // a regular client's rentals kept on paper, before the app
  warnings?: ClientWarning[], // flagged clients this person matches (the client's page)
  stats?: ClientStats, // the client's page
  eligibility?: EligibilityIssue[], // the agency's rules they break today (the client's page)
  agency_id: number,
  contracts?: Contract[],
  documents?: DocumentPhoto[], // ID card, licence (the client's page)
  created_at: number,
  updated_at: number,
}

export const GENDER_MALE = 1;
export const GENDER_FEMALE = 2;

// Why staff don't want to rent to someone again.
export const FLAG_UNPAID = 1;
export const FLAG_DAMAGE = 2;
export const FLAG_LATE = 3;
export const FLAG_OTHER = 4;
export const FLAGS = [ FLAG_UNPAID, FLAG_DAMAGE, FLAG_LATE, FLAG_OTHER ];

// Too young, licence too recent (under the agency's minimums), or licence expired.
export interface EligibilityIssue {
  code: 'age'|'licence_years'|'licence_expired',
  min?: number,
  value?: number, // their age, or the licence's years
  date?: string, // dd/mm/yyyy, when the licence expired
}

// A flagged client with the same phone, ID number or licence number (or the client themselves).
export interface ClientWarning {
  id: number,
  first_name: string,
  last_name: string,
  flag: number,
  notes: string|null,
  matched_on: ('self'|'phone'|'id_number'|'driver_licence_number')[],
}

export const clientName = (client: Client) => client.first_name + ' ' + client.last_name;

// What a client brought in and how they behave (API: App\Support\ClientStats), millimes.
export interface ClientStats {
  contracts_count: number,
  rentals_before: number, // on paper, before the app: counted in nothing else
  first_rental_at: number|null,
  last_rental_at: number|null,
  revenue: number,
  average_value: number,
  average_days: number,
  paid: number,
  outstanding: number,
  fines_unpaid: number,
  damage_charged: number,
  repair_costs: number,
  deposits_kept: number,
  late_returns: number,
  late_hours: number,
  cancellations: number,
  no_shows: number,
  net: number, // revenue less unrecovered repairs, unpaid fines and the balance
  badge: Badge,
}

// good (also a regular client whose rentals were on paper); watch: one late return or a balance;
// risk: two late, damage, an unpaid fine, or flagged.
export type Badge = 'new'|'good'|'watch'|'risk';
export const BADGE_TONES = { new: 'muted', good: 'ok', watch: 'warn', risk: 'danger' } as const;
