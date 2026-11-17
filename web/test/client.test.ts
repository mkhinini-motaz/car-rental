import { expect, test, vi } from 'vitest';
import { AxiosError, InternalAxiosRequestConfig } from 'axios';
import client, { setOnUnauthorized, toFormData } from '../src/api/client';

// Answers every request with a 401 and records the Authorization header it was sent.
let sentAuthorization: string | undefined;
client.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
  sentAuthorization = config.headers.Authorization as string | undefined;
  const response = { status: 401, statusText: 'Unauthorized', data: {}, headers: {}, config };
  throw new AxiosError('Unauthorized', AxiosError.ERR_BAD_REQUEST, config, null, response);
};

test('a rejected token is cleared and the user sent back to login', async () => {
  const onUnauthorized = vi.fn();
  setOnUnauthorized(onUnauthorized);
  localStorage.setItem('user_access_token', 'expired');

  await expect(client.get('me')).rejects.toThrow('Unauthorized');

  expect(sentAuthorization).toBe('Bearer expired');
  expect(localStorage.getItem('user_access_token')).toBeNull();
  expect(onUnauthorized).toHaveBeenCalledTimes(1);
});

test('a wrong password on the login page does not log anyone out', async () => {
  const onUnauthorized = vi.fn();
  setOnUnauthorized(onUnauthorized);

  await expect(client.post('login', { phone: '+21611111111', password: 'x' })).rejects.toThrow();

  expect(sentAuthorization).toBeUndefined();
  expect(onUnauthorized).not.toHaveBeenCalled();
});

test('nested data becomes bracketed multipart fields; files go as they are', () => {
  const file = new File([ 'jpeg' ], 'front.jpg', { type: 'image/jpeg' });
  const form = toFormData({
    mileage: 20150,
    deposit_method: undefined,
    note: null,
    photos: [ { angle: 1, file } ],
    damages: [ { x: 250, y: 100, note: null } ],
    waived: [ 'late' ],
  });
  expect([ ...form.entries() ].map(([ key, value ]) => [ key, value instanceof File ? value.name : value ])).toEqual([
    [ 'mileage', '20150' ],
    [ 'photos[0][angle]', '1' ],
    [ 'photos[0][file]', 'front.jpg' ],
    [ 'damages[0][x]', '250' ],
    [ 'damages[0][y]', '100' ],
    [ 'waived[0]', 'late' ],
  ]);
});
