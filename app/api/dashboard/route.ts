import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();

  const totalJobs = (db.prepare("SELECT COUNT(*) as c FROM jobs WHERE status='active'").get() as { c: number }).c;
  const totalApplications = (db.prepare('SELECT COUNT(*) as c FROM applications').get() as { c: number }).c;

  const byStage = db.prepare(`
    SELECT pipeline_stage, COUNT(*) as count FROM applications GROUP BY pipeline_stage
  `).all() as { pipeline_stage: string; count: number }[];

  const byJob = db.prepare(`
    SELECT j.id, j.title, j.department,
      COUNT(a.id) as count,
      AVG(a.score) as avg_score,
      MAX(a.created_at) as last_application
    FROM jobs j LEFT JOIN applications a ON j.id = a.job_id
    WHERE j.status = 'active'
    GROUP BY j.id
    ORDER BY count DESC
  `).all();

  const recent = db.prepare(`
    SELECT a.id, a.score, a.recommendation, a.pipeline_stage, a.created_at,
           c.name, c.email, j.title as job_title
    FROM applications a
    JOIN candidates c ON a.candidate_id = c.id
    JOIN jobs j ON a.job_id = j.id
    ORDER BY a.created_at DESC LIMIT 10
  `).all();

  const avgScore = (db.prepare('SELECT AVG(score) as avg FROM applications').get() as { avg: number }).avg || 0;

  return NextResponse.json({
    totalJobs,
    totalApplications,
    avgScore: Math.round(avgScore),
    byStage,
    byJob,
    recent,
  });
}
