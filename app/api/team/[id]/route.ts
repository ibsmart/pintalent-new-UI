import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json();

  const ALLOWED = ['role', 'active', 'name', 'avatar_color'];
  const fields = Object.keys(body).filter(k => ALLOWED.includes(k));
  if (fields.length === 0) return NextResponse.json({ error: 'No valid fields' }, { status: 400 });

  // If changing password
  if (body.password) {
    let hash = body.password;
    try {
      const bcrypt = await import('bcryptjs');
      hash = await bcrypt.hash(body.password, 10);
    } catch { /* */ }
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
  }

  if (fields.length > 0) {
    const set = fields.map(f => `${f} = ?`).join(', ');
    db.prepare(`UPDATE users SET ${set} WHERE id = ?`).run(...fields.map(f => body[f]), id);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  // Prevent deleting the last admin
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(id) as { role: string } | undefined;
  if (user?.role === 'admin') {
    const adminCount = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin' AND active = 1").get() as { c: number }).c;
    if (adminCount <= 1) return NextResponse.json({ error: 'Impossible de supprimer le dernier administrateur' }, { status: 400 });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
