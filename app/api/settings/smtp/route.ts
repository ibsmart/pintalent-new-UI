import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const getSetting = (key: string) =>
    (db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined)?.value || '';

  return NextResponse.json({
    smtp_host: getSetting('smtp_host'),
    smtp_port: getSetting('smtp_port') || '587',
    smtp_user: getSetting('smtp_user'),
    smtp_password: '', // never return password
    smtp_from_name: getSetting('smtp_from_name'),
    smtp_from_email: getSetting('smtp_from_email'),
    smtp_secure: getSetting('smtp_secure') || 'false',
  });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();

  const allowed = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from_name', 'smtp_from_email', 'smtp_secure'];
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))');

  for (const key of allowed) {
    if (key in body) {
      // Skip password if empty (preserve existing)
      if (key === 'smtp_password' && !body[key]) continue;
      stmt.run(key, String(body[key]));
    }
  }

  return NextResponse.json({ ok: true });
}
