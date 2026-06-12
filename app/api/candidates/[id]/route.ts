import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const candidate = db.prepare('SELECT id, name, email, phone, linkedin, current_title, years_experience, cv_filename FROM candidates WHERE id = ?').get(id);
  if (!candidate) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  return NextResponse.json(candidate);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const body = await req.json();

  const ALLOWED = ['contract_preference', 'current_salary', 'desired_salary', 'tjm', 'notice_period', 'name', 'email', 'phone', 'linkedin'];
  const fields = Object.keys(body).filter(k => ALLOWED.includes(k));
  if (fields.length === 0) return NextResponse.json({ error: 'No valid fields' }, { status: 400 });

  const set = fields.map(f => `${f} = ?`).join(', ');
  db.prepare(`UPDATE candidates SET ${set} WHERE id = ?`).run(...fields.map(f => body[f]), id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (!hasPermission(session.role, 'candidates.delete')) return NextResponse.json({ error: 'Permission refusée' }, { status: 403 });

  const db = getDb();
  const { id } = await params;

  console.log('[DELETE candidate] id =', id);

  if (!id || id === 'null' || id === 'undefined') {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  }

  const candidate = db.prepare('SELECT id FROM candidates WHERE id = ?').get(id);
  console.log('[DELETE candidate] found =', candidate);
  if (!candidate) return NextResponse.json({ error: 'Candidat introuvable' }, { status: 404 });

  // Delete cascade: pipeline_history → notes → applications → candidate
  const appIds = (db.prepare('SELECT id FROM applications WHERE candidate_id = ?').all(id) as { id: string }[]).map(a => a.id);
  for (const appId of appIds) {
    db.prepare('DELETE FROM pipeline_history WHERE application_id = ?').run(appId);
    db.prepare('DELETE FROM notes WHERE application_id = ?').run(appId);
  }
  db.prepare('DELETE FROM applications WHERE candidate_id = ?').run(id);
  db.prepare('DELETE FROM candidates WHERE id = ?').run(id);

  return NextResponse.json({ success: true });
}
