import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'geekfact-recruitment-secret-2024-change-in-production'
);

export const SESSION_COOKIE = 'gf_session';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar_color: string;
}

export async function signToken(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(): Promise<SessionUser | null> {
  return getSession();
}

// Verify password against bcrypt hash (or fallback for plain-text / placeholder)
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  // Fallback for seed placeholder
  if (hash.includes('placeholder')) return plain === 'Admin2024!';
  // Plain-text password stored (not a bcrypt hash) — compare directly
  if (!hash.startsWith('$2b$') && !hash.startsWith('$2a$')) return plain === hash;
  try {
    const bcrypt = await import('bcryptjs');
    return bcrypt.compare(plain, hash);
  } catch {
    return plain === hash;
  }
}
