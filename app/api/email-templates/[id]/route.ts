import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const template = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(id);
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(template);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json();

  const fields = Object.keys(body).filter(k => ['name', 'subject', 'body', 'variables'].includes(k));
  if (fields.length === 0) return NextResponse.json({ error: 'No valid fields' }, { status: 400 });

  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => f === 'variables' ? JSON.stringify(body[f]) : body[f]);
  db.prepare(`UPDATE email_templates SET ${setClause}, updated_at = datetime('now') WHERE id = ?`).run(...values, id);

  const updated = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(id);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM email_templates WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
