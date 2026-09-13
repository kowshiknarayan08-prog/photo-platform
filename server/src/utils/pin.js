import bcrypt from 'bcryptjs';

const PIN_REGEX = /^\d{4,8}$/;

export function isValidPinFormat(pin) {
  return typeof pin === 'string' && PIN_REGEX.test(pin);
}

export async function hashPin(pin) {
  if (!isValidPinFormat(pin)) {
    throw new Error('PIN must be 4 to 8 digits');
  }
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin, pinHash) {
  if (typeof pin !== 'string' || typeof pinHash !== 'string') return false;
  return bcrypt.compare(pin, pinHash);
}

/** Generate a random numeric PIN (used by the seed script / demo data). */
export function randomPin(length = 6) {
  let out = '';
  for (let i = 0; i < length; i += 1) out += Math.floor(Math.random() * 10);
  return out;
}
