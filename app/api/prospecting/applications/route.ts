import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Returns all applications as a flat list: { candidateId, jobId, jobTitle, stage }
export async function GET() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT a.candidate_id as candidateId, a.job_id as jobId, a.pipeline_stage as stage, j.title as jobTitle
    FROM applications a
    LEFT JOIN jobs j ON j.id = a.job_id
    ORDER BY a.updated_at DESC
  `).all() as { candidateId: string; jobId: string; stage: string; jobTitle: string }[];
  return NextResponse.json(rows);
}
