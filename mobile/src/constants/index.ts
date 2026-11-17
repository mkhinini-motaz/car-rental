import { Platform } from 'react-native';

// Dev builds use `php artisan serve` on this machine; the Android emulator reaches the host
// at 10.0.2.2 (a USB device needs `adb reverse tcp:8000 tcp:8000` and 127.0.0.1 instead).
const DEV_API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8000/api/' : 'http://127.0.0.1:8000/api/';
// TODO: set once the API is deployed (task "Deploy the API and get the app onto the agency's phones").
const PRODUCTION_API_URL = 'https://api.example.com/api/';

export const API_URL = __DEV__ ? DEV_API_URL : PRODUCTION_API_URL;
export type Tone = 'ok' | 'info' | 'warn' | 'danger' | 'muted' | 'primary' | 'ink';
export const LOCAL = "fr-TN"; // Tunisian grouping: 1 234,5 ("tn" is Tswana)
export const LOCAL_CURRENCY = "TND";
export const PHONE_REGEX = /^(00|\+)2 *1 *6 *[234579] *([0-9] *){7}$/;