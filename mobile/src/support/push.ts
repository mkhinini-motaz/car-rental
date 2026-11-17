import { useEffect } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { getInitialNotification, getMessaging, getToken, onNotificationOpenedApp, onTokenRefresh, requestPermission } from '@react-native-firebase/messaging';
import { forgetDevice, registerDevice } from '../api/device';
import { navigationRef } from '../navigation/ref';
import { useLang } from '../store/hooks';

let token: string|null = null;

// What a tapped notification opens: the contract of a task given to you, the car whose paper is
// ending, or the Today tab.
function open(message: { data?: Record<string, unknown> }|null) {
  const data = message?.data;
  if (! data || ! navigationRef.isReady()) {
    return;
  }
  if (data.contract_id) {
    navigationRef.navigate('ContractScreen', { contractId: Number(data.contract_id) });
  } else if (data.car_id) {
    navigationRef.navigate('CarScreen', { carId: Number(data.car_id) });
  } else if (data.screen === 'Today') {
    navigationRef.navigate('Tabs', { screen: 'Today' });
  }
}

// Registers the phone for the agency's push notifications (the API's alerts:daily) while someone is
// signed in: mounted in HomeNavigator. A build without the Firebase config files (google-services.json,
// GoogleService-Info.plist) has no Firebase app: then it does nothing.
export function usePushNotifications(): void {
  const { selectedLang } = useLang();

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];
    (async () => {
      try {
        const messaging = getMessaging(getApp());
        if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        } else if (Platform.OS === 'ios') {
          await requestPermission(messaging);
        }
        token = await getToken(messaging);
        await registerDevice(token, selectedLang);
        unsubscribers.push(onTokenRefresh(messaging, newToken => {
          token = newToken;
          registerDevice(newToken, selectedLang).catch(() => {});
        }));
        unsubscribers.push(onNotificationOpenedApp(messaging, open));
        open(await getInitialNotification(messaging)); // the app was started by a tap
      } catch {
        // No Firebase on this build, notifications refused, or no network: the app works without them.
      }
    })();
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [selectedLang]);

  // Signed out (HomeNavigator unmounts): this phone stops getting the agency's alerts.
  useEffect(() => () => {
    if (token) {
      forgetDevice(token).catch(() => {});
      token = null;
    }
  }, []);
}
