import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const db = getDb();
  const integrations = db.prepare('SELECT * FROM job_board_integrations ORDER BY platform').all();
  return NextResponse.json(integrations);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { platform, config = {}, active = 0 } = body;

  const existing = db.prepare('SELECT id FROM job_board_integrations WHERE platform = ?').get(platform);
  if (existing) {
    db.prepare('UPDATE job_board_integrations SET config = ?, active = ?, updated_at = ? WHERE platform = ?')
      .run(JSON.stringify(config), active, new Date().toISOString(), platform);
    return NextResponse.json({ ok: true });
  }

  db.prepare('INSERT INTO job_board_integrations (id, platform, active, config) VALUES (?, ?, ?, ?)')
    .run(uuidv4(), platform, active, JSON.stringify(config));
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { platform, config, active } = body;

  if (active !== undefined) {
    db.prepare('UPDATE job_board_integrations SET active = ?, updated_at = ? WHERE platform = ?')
      .run(active, new Date().toISOString(), platform);
  }
  if (config !== undefined) {
    db.prepare('UPDATE job_board_integrations SET config = ?, updated_at = ? WHERE platform = ?')
      .run(JSON.stringify(config), new Date().toISOString(), platform);
  }
  return NextResponse.json({ ok: true });
}
