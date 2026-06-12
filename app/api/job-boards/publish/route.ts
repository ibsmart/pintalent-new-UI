import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

interface JobRow {
  id: string; title: string; department: string; location: string;
  contract_type: string; description: string; missions: string;
  profile: string; keywords: string; experience: string; education: string;
}

interface IntegrationRow {
  platform: string; config: string; active: number;
}

async function publishToWebhook(
  job: JobRow,
  config: Record<string, string>,
  platform: string
): Promise<{ success: boolean; external_url?: string; error?: string }> {
  const payload = {
    platform,
    job_id: job.id,
    title: job.title,
    department: job.department,
    location: job.location,
    contract_type: job.contract_type,
    description: job.description,
    missions: job.missions || '',
    profile: job.profile || '',
    keywords: job.keywords || '',
    experience: job.experience || '',
    education: job.education || '',
  };

  try {
    const res = await fetch(config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
    const data = await res.json().catch(() => ({}));
    return { success: true, external_url: data.url || data.job_url || undefined };
  } catch (e) {
    return { success: false, error: String((e as Error).message || e) };
  }
}

async function publishToIndeedFeed(
  job: JobRow,
  _config: Record<string, string>
): Promise<{ success: boolean; external_url?: string; error?: string }> {
  // Indeed uses XML feed crawling — no direct push API
  // We just mark as "published via feed" and return the feed URL
  return {
    success: true,
    external_url: `/api/job-boards/feed/indeed?job_id=${job.id}`,
  };
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { job_id, platforms } = body as { job_id: string; platforms: string[] };

  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id) as JobRow | undefined;
  if (!job) return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 });

  const results: Record<string, { status: string; external_url?: string; error?: string }> = {};

  for (const platform of platforms) {
    const integration = db.prepare(
      'SELECT * FROM job_board_integrations WHERE platform = ? AND active = 1'
    ).get(platform) as IntegrationRow | undefined;

    if (!integration) {
      results[platform] = { status: 'error', error: 'Intégration non configurée ou inactive' };
      continue;
    }

    const config = JSON.parse(integration.config || '{}') as Record<string, string>;
    let result: { success: boolean; external_url?: string; error?: string };

    if (platform === 'indeed_feed') {
      result = await publishToIndeedFeed(job, config);
    } else {
      // LinkedIn, HelloWork, APEC, custom → all via webhook
      result = await publishToWebhook(job, config, platform);
    }

    const postingId = uuidv4();
    db.prepare(`
      INSERT INTO job_postings (id, job_id, platform, status, external_url, error, posted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      postingId, job_id, platform,
      result.success ? 'published' : 'error',
      result.external_url || null,
      result.error || null,
      result.success ? new Date().toISOString() : null
    );

    results[platform] = {
      status: result.success ? 'published' : 'error',
      external_url: result.external_url,
      error: result.error,
    };
  }

  return NextResponse.json({ results });
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const job_id = searchParams.get('job_id');

  let query = `
    SELECT jp.*, j.title as job_title
    FROM job_postings jp
    JOIN jobs j ON jp.job_id = j.id
    WHERE 1=1
  `;
  const params: string[] = [];
  if (job_id) { query += ' AND jp.job_id = ?'; params.push(job_id); }
  query += ' ORDER BY jp.created_at DESC LIMIT 100';

  const postings = db.prepare(query).all(...params);
  return NextResponse.json(postings);
}
