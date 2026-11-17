/* eslint-env jest */
import 'react-native-gesture-handler/jestSetup';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);
// Gesture Handler 3 binds to the native UI runtime on startup; there is none under Jest.
jest.mock(
  'react-native-gesture-handler/lib/module/handlers/gestures/installUIRuntimeBindings',
  () => ({installUIRuntimeBindings: () => {}}),
);

// Firebase has no native app under Jest: push registration gives up, as on a build without its config.
jest.mock('@react-native-firebase/app', () => ({ getApp: () => { throw new Error('No Firebase app'); } }));
jest.mock('@react-native-firebase/messaging', () => ({}));

// Native camera and gallery pickers.
jest.mock('react-native-image-picker', () => ({ launchCamera: jest.fn(), launchImageLibrary: jest.fn() }));

// The native file picker (the import screen).
jest.mock('@react-native-documents/picker', () => ({ pick: jest.fn(), keepLocalCopy: jest.fn(), types: {}, errorCodes: {}, isErrorWithCode: () => false }));
