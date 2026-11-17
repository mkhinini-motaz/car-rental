// localStorage throws when storage is blocked (private mode, site data off): treat it as logged out.
const KEY = 'user_access_token';

export function setUserToken(token: string) {
  try { localStorage.setItem(KEY, token); } catch {}
}

export function getUserToken(): string|null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function clearUserToken() {
  try { localStorage.removeItem(KEY); } catch {}
}
