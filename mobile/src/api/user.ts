import client from './client';
import User from '../classes/User';
import Activity from '../classes/Activity';

export interface UserInput {
  first_name: string,
  last_name: string,
  phone: string,
  password?: string, // none on a new account invites them (see store); empty keeps the current one
  role: 1|2,
  branch_id?: number|null, // managers only: null works on every branch
  disabled?: boolean,
}

// The owner's staff, disabled accounts included. Owner only.
export function index(): Promise<User[]> {
  return client.get('user').then(response => response.data.data);
}

// Without a password, the new staff member is invited: `invite_code` (also sent by SMS in `lang`)
// lets them choose their password from "Forgot password?" on the login screen, for 7 days.
export function store(data: UserInput & { lang?: string }): Promise<{ user: User, invite_code?: string }> {
  return client.post('user', data).then(response => ({ user: response.data.data, invite_code: response.data.invite_code }));
}

// A new code, for someone invited who lost theirs or who forgot their password.
export function invite(id: number, lang: string): Promise<string> {
  return client.post('user/' + id + '/invite', { lang }).then(response => response.data.invite_code);
}

// Who added the account and changed its role, branch or access, newest first.
// queryKey: ['user.activity', id]
export function activity(id: number): Promise<Activity[]> {
  return client.get('user/' + id + '/activity').then(response => response.data.data);
}

// A 422 `user:self` means the owner tried to demote or disable themselves.
export function update(id: number, data: Partial<UserInput>): Promise<User> {
  return client.put('user/' + id, data).then(response => response.data.data);
}
