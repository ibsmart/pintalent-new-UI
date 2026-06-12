import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const db = getDb();

  const projects = db.prepare(`
    SELECT p.*,
      COUNT(DISTINCT j.id) as request_count,
      COUNT(DISTINCT a.id) as candidate_count,
      COUNT(DISTINCT j.id) as total_positions,
      SUM(CASE WHEN a.pipeline_stage = 'Présélectionné'   THEN 1 ELSE 0 END) as stage_preselect,
      SUM(CASE WHEN a.pipeline_stage = 'Contacté'         THEN 1 ELSE 0 END) as stage_contacted,
      SUM(CASE WHEN a.pipeline_stage = 'Entretien RH'     THEN 1 ELSE 0 END) as stage_rh,
      SUM(CASE WHEN a.pipeline_stage = 'Entretien client' THEN 1 ELSE 0 END) as stage_client,
      SUM(CASE WHEN a.pipeline_stage = 'Offre envoyée'    THEN 1 ELSE 0 END) as stage_offer,
      SUM(CASE WHEN a.pipeline_stage = 'Embauché'         THEN 1 ELSE 0 END) as hired_count,
      SUM(CASE WHEN a.pipeline_stage = 'Refusé'           THEN 1 ELSE 0 END) as stage_refused
    FROM projects p
    LEFT JOIN jobs j ON j.campaign_id = p.id
    LEFT JOIN applications a ON a.job_id = j.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all();

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { name, client, description, status = 'active' } = body;

  if (!name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 });

  const id = uuidv4();
  db.prepare(`INSERT INTO projects (id, name, client, description, status) VALUES (?, ?, ?, ?, ?)`)
    .run(id, name.trim(), client || '', description || '', status);

  return NextResponse.json({ id }, { status: 201 });
}
