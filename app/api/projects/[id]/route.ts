import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const jobs = db.prepare(`
    SELECT j.*,
      COUNT(a.id) as candidate_count,
      SUM(CASE WHEN a.pipeline_stage = 'Nouveau'        THEN 1 ELSE 0 END) as stage_nouveau,
      SUM(CASE WHEN a.pipeline_stage = 'Présélectionné' THEN 1 ELSE 0 END) as stage_preselect,
      SUM(CASE WHEN a.pipeline_stage = 'Entretien'      THEN 1 ELSE 0 END) as stage_entretien,
      SUM(CASE WHEN a.pipeline_stage = 'Test technique' THEN 1 ELSE 0 END) as stage_test,
      SUM(CASE WHEN a.pipeline_stage = 'Offre'          THEN 1 ELSE 0 END) as stage_offre,
      SUM(CASE WHEN a.pipeline_stage = 'Embauché'       THEN 1 ELSE 0 END) as stage_embauche,
      SUM(CASE WHEN a.pipeline_stage = 'Rejeté'         THEN 1 ELSE 0 END) as stage_rejete
    FROM jobs j
    LEFT JOIN applications a ON a.job_id = j.id
    WHERE j.campaign_id = ?
    GROUP BY j.id
    ORDER BY j.created_at ASC
  `).all(id);

  return NextResponse.json({ ...project as object, jobs });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json();

  const allowed = ['name', 'client', 'description', 'status'];
  const fields = Object.keys(body).filter(k => allowed.includes(k));
  if (fields.length === 0) return NextResponse.json({ error: 'No valid fields' }, { status: 400 });

  const setClause = fields.map(f => `${f} = ?`).join(', ');
  db.prepare(`UPDATE projects SET ${setClause}, updated_at = datetime('now') WHERE id = ?`)
    .run(...fields.map(f => body[f]), id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  // Detach jobs from campaign before deleting
  db.prepare("UPDATE jobs SET campaign_id = NULL WHERE campaign_id = ?").run(id);
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
