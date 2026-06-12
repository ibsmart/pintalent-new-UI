import { NextRequest, NextResponse } from 'next/server';
import { getDb, getSettings } from '@/lib/db';

export async function GET() {
  const settings = getSettings();
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  const update = db.transaction((data: Record<string, string>) => {
    for (const [key, value] of Object.entries(data)) {
      stmt.run(key, String(value));
    }
  });
  update(body);
  return NextResponse.json({ ok: true });
}
