import client from './client';
import User from "../classes/User";
import { getUserToken } from "../support/auth";
import Translatable from "../classes/Translatable";

export function login({ phone, password }: { phone: string, password: string }): Promise<User> {
  return client.post('login', { phone, password })
    .then(response => response.data.data)
}

// Called on start. Resolves to null when nobody is logged in on this device; otherwise the user
// comes back with a fresh 30-day `access_token` to store, so opening the app at least once a
// month keeps you logged in.
export async function refresh(): Promise<User | null> {
  if (! await getUserToken()) {
    return null;
  }
  return client.post('refresh').then(response => response.data.data);
}

// Your own name and phone; a new password needs the current one (422 `user:password:wrong`) and
// comes back with a new `access_token`: it logs out your other devices, and the old token with them.
export function updateMe(data: Partial<Pick<User, 'first_name' | 'last_name' | 'phone'>> & { current_password?: string, password?: string }): Promise<User> {
  return client.put('me', data).then(response => response.data.data);
}

export function logout(): Promise<void> {
  return client.post('logout').then(() => {});
}

// With a code from requestOtp or from the owner's invitation; logs in (422 `otp` for a wrong code).
export function resetPassword({ password, password_confirmation, otp, phone }: { password: string, password_confirmation: string, otp: string, phone: string }): Promise<User> {
  return client.post('password/reset', { password, password_confirmation, otp, phone })
    .then(response => response.data.data)
}

// A new agency: a code by SMS to a phone without an account (422 `phone` when it has one), then
// the agency and its first owner, logged in (422 `otp` for a wrong code).
export function requestSignupCode(phone: string, lang: keyof Translatable): Promise<void> {
  return client.post('signup/code', { phone, lang });
}

export function signup(data: { agency_name: string, first_name: string, last_name: string, phone: string, otp: string, password: string, password_confirmation: string }): Promise<User> {
  return client.post('signup', data).then(response => response.data.data);
}

// Sends a code by SMS. Same answer whether the phone has an account or not; one SMS a minute.
export function requestOtp(phone: string, lang: keyof Translatable): Promise<void> {
  return client.post('otp/request', { phone, lang })
}
