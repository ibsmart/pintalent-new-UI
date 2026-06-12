import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json();

  const allowed = ['title', 'nb_positions', 'deadline', 'priority', 'job_id', 'status', 'notes'];
  const fields = Object.keys(body).filter(k => allowed.includes(k));
  if (fields.length === 0) return NextResponse.json({ error: 'No valid fields' }, { status: 400 });

  const setClause = fields.map(f => `${f} = ?`).join(', ');
  db.prepare(`UPDATE requests SET ${setClause}, updated_at = datetime('now') WHERE id = ?`)
    .run(...fields.map(f => body[f] ?? null), id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM requests WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
