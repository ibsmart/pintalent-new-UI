import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(job);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json();

  const fields = Object.keys(body).filter(k => ['title','department','location','contract_type','description','missions','profile','keywords','experience','education','status','campaign_id'].includes(k));
  if (fields.length === 0) return NextResponse.json({ error: 'No valid fields' }, { status: 400 });

  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => body[f]);
  values.push(new Date().toISOString(), id);

  db.prepare(`UPDATE jobs SET ${setClause}, updated_at = ? WHERE id = ?`).run(...values);

  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  return NextResponse.json(job);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM jobs WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
