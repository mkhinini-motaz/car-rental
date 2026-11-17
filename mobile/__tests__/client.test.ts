import AsyncStorage from '@react-native-async-storage/async-storage';
import { AxiosError, InternalAxiosRequestConfig } from 'axios';
import client, { setOnUnauthorized } from '../src/api/client';

// Answers every request with a 401 and records the Authorization header it was sent.
let sentAuthorization: string | undefined;
client.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
  sentAuthorization = config.headers.Authorization as string | undefined;
  const response = { status: 401, statusText: 'Unauthorized', data: {}, headers: {}, config };
  throw new AxiosError('Unauthorized', AxiosError.ERR_BAD_REQUEST, config, null, response);
};

const onUnauthorized = jest.fn();
setOnUnauthorized(onUnauthorized);
beforeEach(() => onUnauthorized.mockClear());

test('a rejected token is cleared and the user sent back to login', async () => {
  await AsyncStorage.setItem('user_access_token', 'expired');

  await expect(client.get('me')).rejects.toThrow('Unauthorized');

  expect(sentAuthorization).toBe('Bearer expired');
  expect(await AsyncStorage.getItem('user_access_token')).toBeNull();
  expect(onUnauthorized).toHaveBeenCalledTimes(1);
});

test('a wrong password on the login screen does not trigger a logout', async () => {
  await expect(client.post('login', { phone: '+21611111111', password: 'x' })).rejects.toThrow();

  expect(sentAuthorization).toBeUndefined();
  expect(onUnauthorized).not.toHaveBeenCalled();
});
