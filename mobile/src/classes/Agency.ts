export default interface Agency {
  id: number,
  name: string,
  phone: string|null,
  address: string|null,
  logo_url: string|null,
  takes_deposit: boolean, // many agencies take none: then pickup doesn't ask
  default_deposit: number, // millimes, suggested at pickup
  default_deposit_method: 1|2|3|4,
  tax_id: string|null, // matricule fiscal
  contract_terms: string|null,
  pickup_time: string, // 'HH:MM', the usual pickup: new reservations start then
  return_time: string, // 'HH:MM', and end then
  expiry_warning_days: number, // papers flagged this many days ahead
  oil_warning_km: number, // oil changes flagged this far ahead
  oil_warning_days: number,
  fleet_max_years: number, // a car leaves the fleet this long after its first registration (3 in Tunisia)
  employer_charges_rate: number, // hundredths of a percent on salaries (1657 = 16.57 %), 0 = off
  min_driver_age: number, // who may rent (0: no rule); breaking it only warns
  min_licence_years: number,
  vat_rate: number, // hundredths of a percent included in prices, shown on invoices (1900 = 19 %); 0: none
  fiscal_stamp: number, // millimes added to an invoice (timbre fiscal); 0: none
  theme: string|null, // a palette id (`PALETTES` in the theme file); null or unknown: the default
  theme_mode: 1|2|3, // THEME_MODE_*: the owner's choice for every staff member
  staff?: Staff[], // GET agency: who can be given a pickup or a return
}

export interface Staff {
  id: number,
  first_name: string,
  last_name: string,
  branch_id: number|null, // a manager of one branch only works on its cars (and those in no branch)
}

// The same ints as App\Models\Agency::THEME_MODE_*.
export const THEME_MODE_DEVICE = 1; // light or dark as each phone or computer is set
export const THEME_MODE_LIGHT = 2;
export const THEME_MODE_DARK = 3;
export const THEME_MODES = [ THEME_MODE_DEVICE, THEME_MODE_LIGHT, THEME_MODE_DARK ] as const;

export const staffName = (staff?: Staff) => staff ? staff.first_name + ' ' + staff.last_name : '';

// A Date on `day` at the agency's 'HH:MM'.
export const atTime = (day: Date, time: string) => {
  const [ hours, minutes ] = time.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
};
