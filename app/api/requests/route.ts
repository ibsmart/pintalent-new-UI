import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const db = getDb();
  const projectId = new URL(req.url).searchParams.get('project_id');

  let query = `
    SELECT r.*, j.title as job_title, j.department
    FROM requests r
    LEFT JOIN jobs j ON j.id = r.job_id
    WHERE 1=1
  `;
  const params: string[] = [];
  if (projectId) { query += ' AND r.project_id = ?'; params.push(projectId); }
  query += ' ORDER BY r.created_at ASC';

  return NextResponse.json(db.prepare(query).all(...params));
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { project_id, title, nb_positions = 1, deadline, priority = 'normal', job_id, notes } = body;

  if (!project_id || !title?.trim()) {
    return NextResponse.json({ error: 'project_id et title requis' }, { status: 400 });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO requests (id, project_id, title, nb_positions, deadline, priority, job_id, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')
  `).run(id, project_id, title.trim(), nb_positions, deadline || null, priority, job_id || null, notes || '');

  return NextResponse.json({ id }, { status: 201 });
}
