import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { getSession } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'active';
  const department = searchParams.get('department');
  const location = searchParams.get('location');
  const contract = searchParams.get('contract');
  const q = searchParams.get('q');

  const campaignId = searchParams.get('campaign_id');
  const noCampaign = searchParams.get('no_campaign');

  let query = 'SELECT * FROM jobs WHERE 1=1';
  const params: unknown[] = [];

  if (status !== 'all') {
    query += ' AND status = ?';
    params.push(status);
  }
  if (campaignId) { query += ' AND campaign_id = ?'; params.push(campaignId); }
  if (noCampaign === '1') { query += ' AND campaign_id IS NULL'; }
  if (department) { query += ' AND department = ?'; params.push(department); }
  if (location) { query += ' AND location = ?'; params.push(location); }
  if (contract) { query += ' AND contract_type = ?'; params.push(contract); }
  if (q) {
    query += ' AND (title LIKE ? OR description LIKE ? OR department LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  query += ' ORDER BY created_at DESC';

  const jobs = db.prepare(query).all(...params);

  // Get application counts per job
  const counts = db.prepare(`
    SELECT job_id, COUNT(*) as count, AVG(score) as avg_score
    FROM applications GROUP BY job_id
  `).all() as { job_id: string; count: number; avg_score: number }[];
  const countMap = Object.fromEntries(counts.map(c => [c.job_id, c]));

  const enriched = jobs.map((j: unknown) => {
    const job = j as Record<string, unknown>;
    return {
      ...job,
      application_count: countMap[job.id as string]?.count || 0,
      avg_score: Math.round(countMap[job.id as string]?.avg_score || 0),
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (!hasPermission(session.role, 'jobs.create')) return NextResponse.json({ error: 'Permission refusée' }, { status: 403 });

  const db = getDb();
  const body = await req.json();
  const id = uuidv4();

  db.prepare(`
    INSERT INTO jobs (id, title, department, location, contract_type, description, missions, profile, keywords, experience, education, status, campaign_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, body.title, body.department || 'IT', body.location || 'Casablanca',
    body.contract_type || 'CDI', body.description || '', body.missions || '',
    body.profile || '', body.keywords || '', body.experience || '',
    body.education || '', body.status || 'active', body.campaign_id || null,
    session.id
  );

  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  return NextResponse.json(job, { status: 201 });
}
