import { toFormData } from '../src/api/client';

jest.mock('../src/support/auth', () => ({ getUserToken: () => null, clearUserToken: () => null }));

// Records what React Native's FormData would send.
class RecordingFormData {
  parts: [string, any][] = [];
  append(key: string, value: any) {
    this.parts.push([ key, value ]);
  }
}

test('nested data becomes bracketed multipart fields', () => {
  (globalThis as any).FormData = RecordingFormData;
  const file = { uri: 'file:///front.jpg', name: 'front.jpg', type: 'image/jpeg' };
  const { parts } = (toFormData({
    mileage: 20150,
    deposit_method: undefined,
    photos: [ { angle: 1, file } ],
    damages: [ { x: 250, y: 100, note: null } ],
  }) as unknown as RecordingFormData);

  expect(parts).toEqual([
    [ 'mileage', '20150' ],
    [ 'photos[0][angle]', '1' ],
    [ 'photos[0][file]', file ],
    [ 'damages[0][x]', '250' ],
    [ 'damages[0][y]', '100' ],
  ]);
});
