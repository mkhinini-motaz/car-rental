import { maskPhone } from '../src/support/utils';

// The phone field shapes what is typed or pasted; the API wants '+216' and eight digits.
test('phone numbers keep the +216 and group as 22 123 456', () => {
  expect(maskPhone('+216 ')).toBe('+216 ');
  expect(maskPhone('+216 2')).toBe('+216 2');
  expect(maskPhone('+216 221')).toBe('+216 22 1');
  expect(maskPhone('+216 22 123 4567')).toBe('+216 22 123 456');
  expect(maskPhone('22123456')).toBe('+216 22 123 456'); // pasted without the prefix
  expect(maskPhone('+21621622123')).toBe('+216 21 622 123');
  expect(maskPhone('+216 1')).toBe('+216 '); // no Tunisian number starts with 1
  expect(maskPhone('+216')).toBe('+216 '); // the prefix can't be erased
});
