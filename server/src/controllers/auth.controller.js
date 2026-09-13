import { prisma } from '../lib/prisma.js';
import { signUserToken } from '../lib/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { hashPassword, verifyPassword, publicUser } from '../utils/password.js';

/**
 * POST /api/auth/register
 * Public self-registration always creates an ADMIN / Lead account.
 * Team Members are created by an Admin (see events controller) and only log in.
 */
export async function register(req, res) {
  const { name, email, password } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw ApiError.conflict('An account with that email already exists');

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      role: 'ADMIN',
    },
  });

  res.status(201).json({
    token: signUserToken(user),
    user: publicUser(user),
  });
}

/** POST /api/auth/login */
export async function login(req, res) {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  // Same error whether the email is unknown or the password is wrong.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  res.json({
    token: signUserToken(user),
    user: publicUser(user),
  });
}

/** GET /api/auth/me */
export async function me(req, res) {
  res.json({ user: publicUser(req.user) });
}
