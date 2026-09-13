import { describe, it, expect } from 'vitest';
import { isValidPinFormat, hashPin, verifyPin, randomPin } from '../src/utils/pin.js';

describe('PIN format', () => {
  it('accepts 4 to 8 digit strings', () => {
    expect(isValidPinFormat('1234')).toBe(true);
    expect(isValidPinFormat('482917')).toBe(true);
    expect(isValidPinFormat('12345678')).toBe(true);
  });

  it('rejects bad formats', () => {
    expect(isValidPinFormat('123')).toBe(false);
    expect(isValidPinFormat('123456789')).toBe(false);
    expect(isValidPinFormat('12a4')).toBe(false);
    expect(isValidPinFormat('')).toBe(false);
    expect(isValidPinFormat(123456)).toBe(false);
  });
});

describe('PIN hashing', () => {
  it('hash + verify round-trips', async () => {
    const hash = await hashPin('482917');
    expect(hash).not.toBe('482917');
    expect(await verifyPin('482917', hash)).toBe(true);
  });

  it('rejects the wrong PIN', async () => {
    const hash = await hashPin('482917');
    expect(await verifyPin('000000', hash)).toBe(false);
  });

  it('verifyPin is safe with non-string input', async () => {
    expect(await verifyPin(undefined, 'x')).toBe(false);
    expect(await verifyPin('1234', undefined)).toBe(false);
  });

  it('throws when hashing an invalid PIN', async () => {
    await expect(hashPin('abc')).rejects.toThrow();
  });
});

describe('randomPin', () => {
  it('produces a numeric string of the requested length', () => {
    const p = randomPin(6);
    expect(p).toHaveLength(6);
    expect(/^\d{6}$/.test(p)).toBe(true);
  });
});
