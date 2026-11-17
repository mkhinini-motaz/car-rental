import axios from 'axios';
import { API_URL } from '../constants';
import { clearUserToken, getUserToken } from '../support/auth';

const client = axios.create({ baseURL: API_URL, headers: { Accept: 'application/json' } });

client.interceptors.request.use(async config => {
  const token = await getUserToken();
  if (token) {
    config.headers.Authorization = 'Bearer ' + token;
  }
  return config;
});

let onUnauthorized = () => {};

// The store registers this so a rejected token (expired, logged out elsewhere) sends the user back to login.
export function setOnUnauthorized(handler: () => void) {
  onUnauthorized = handler;
}

client.interceptors.response.use(undefined, async error => {
  if (error.response?.status === 401 && error.config?.headers?.Authorization) {
    await clearUserToken();
    onUnauthorized();
  }
  return Promise.reject(error);
});

// Nested data as multipart fields the API understands: { photos: [{ angle: 1, file }] } becomes
// `photos[0][angle]` and `photos[0][file]`. Files are `{ uri, name, type }` objects.
export function toFormData(data: object): FormData {
  const formData = new FormData();
  const append = (key: string, value: any) => {
    if (value === null || value === undefined) {
      return;
    }
    if (typeof value === 'object' && ! value.uri) {
      Object.entries(value).forEach(([ childKey, childValue ]) => append(`${key}[${childKey}]`, childValue));
      return;
    }
    formData.append(key, typeof value === 'object' ? value : String(value));
  };
  Object.entries(data).forEach(([ key, value ]) => append(key, value));
  return formData;
}

export const multipartConfig = { headers: { 'Content-Type': 'multipart/form-data' } };

export default client;
