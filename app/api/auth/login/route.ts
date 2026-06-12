import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { signToken, verifyPassword, SESSION_COOKIE } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 });
  }

  const db = getDb();
  const user = db.prepare(
    'SELECT id, email, name, role, password_hash, active, avatar_color FROM users WHERE email = ?'
  ).get(email.toLowerCase().trim()) as {
    id: string; email: string; name: string; role: string;
    password_hash: string; active: number; avatar_color: string;
  } | undefined;

  if (!user) {
    return NextResponse.json({ error: 'Identifiants incorrects' }, { status: 401 });
  }
  if (!user.active) {
    return NextResponse.json({ error: 'Compte désactivé — contactez un administrateur' }, { status: 403 });
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    return NextResponse.json({ error: 'Identifiants incorrects' }, { status: 401 });
  }

  // Update last_login
  db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(new Date().toISOString(), user.id);

  const token = await signToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatar_color: user.avatar_color || '#6366f1',
  });

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, avatar_color: user.avatar_color },
  });

  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax',
  });

  return res;
}
