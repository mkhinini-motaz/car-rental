import { Platform } from 'react-native';
import client from './client';

// This phone's push token, for the agency's morning alerts in the app's language.
export const registerDevice = (token: string, lang: string) => client.post('device-token', { token, platform: Platform.OS, lang });

// After sign-out: the token alone is enough, the session is already gone.
export const forgetDevice = (token: string) => client.delete('device-token/' + encodeURIComponent(token));
