export default interface User {
  id: number,
  first_name: string,
  last_name: string,
  phone: string,
  role: 1|2,
  branch_id?: number|null, // a manager limited to this branch's cars (and the cars in no branch)
  disabled?: boolean, // can't log in; the owner can enable the account again
  invited: boolean, // hasn't chosen a password yet (see the invite code in api/user.ts)
  created_at: number,
  updated_at: number,
  access_token?: string,
}

export const ROLE_OWNER = 1;
export const ROLE_MANAGER = 2;
// Only the owner manages staff, the agency's settings and prices, cars, reports and the cash
// book, removes payments or expenses and keeps part of a deposit (the API answers 403).
export const isOwner = (user: User) => user.role === ROLE_OWNER;
