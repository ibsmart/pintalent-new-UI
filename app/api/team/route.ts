import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { getSession } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9',
];

export async function GET() {
  try {
    const db = getDb();
    // Use only columns guaranteed to exist in the original schema
    // active/avatar_color/last_login added via ALTER TABLE — use PRAGMA to check safely
    const cols = (db.prepare('PRAGMA table_info(users)').all() as {name: string}[]).map(c => c.name);
    const select = [
      'id', 'email', 'name', 'role',
      cols.includes('active')       ? 'active'       : '1 as active',
      cols.includes('avatar_color') ? 'avatar_color' : "'#6366f1' as avatar_color",
      cols.includes('created_at')   ? 'created_at'   : "null as created_at",
      cols.includes('last_login')   ? 'last_login'   : "null as last_login",
    ].join(', ');
    const users = db.prepare(`SELECT ${select} FROM users ORDER BY rowid DESC`).all();
    return NextResponse.json(users);
  } catch (err) {
    console.error('[GET /api/team]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (!hasPermission(session.role, 'team.manage')) return NextResponse.json({ error: 'Permission refusée' }, { status: 403 });

  const db = getDb();
  const body = await req.json();
  const { email, name, role = 'rh', password = 'ChangeMe2024!' } = body;

  if (!email || !name) return NextResponse.json({ error: 'Email et nom requis' }, { status: 400 });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return NextResponse.json({ error: 'Cet email est déjà utilisé' }, { status: 409 });

  // Pick a random avatar color
  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

  // Hash password (bcrypt if available, else placeholder)
  let hash = password;
  try {
    const bcrypt = await import('bcryptjs');
    hash = await bcrypt.hash(password, 10);
  } catch { /* bcryptjs not available */ }

  const id = uuidv4();
  db.prepare(
    'INSERT INTO users (id, email, name, role, password_hash, active, avatar_color) VALUES (?, ?, ?, ?, ?, 1, ?)'
  ).run(id, email, name, role, hash, color);

  return NextResponse.json({ id, email, name, role }, { status: 201 });
}
