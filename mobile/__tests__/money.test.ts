import { millimesFromInput, priceInputFromMillimes } from '../src/support/money';

test('dinar input converts to millimes', () => {
  expect(millimesFromInput('90')).toBe(90000);
  expect(millimesFromInput(' 87,5 ')).toBe(87500);
  expect(millimesFromInput('0.125')).toBe(125);
  expect(millimesFromInput('')).toBeNull();
  expect(millimesFromInput('0')).toBeNull();
  expect(millimesFromInput('-5')).toBeNull();
  expect(millimesFromInput('abc')).toBeNull();
  expect(millimesFromInput(priceInputFromMillimes(142500))).toBe(142500);
});
