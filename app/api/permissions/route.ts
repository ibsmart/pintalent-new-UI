import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { ALL_PERMISSIONS } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const rows = db.prepare('SELECT role, permission, enabled FROM role_permissions ORDER BY role, permission').all() as { role: string; permission: string; enabled: number }[];
  const result: Record<string, Record<string, boolean>> = {};
  for (const row of rows) {
    if (!result[row.role]) result[row.role] = {};
    result[row.role][row.permission] = row.enabled === 1;
  }
  return NextResponse.json({ permissions: result, all_permissions: ALL_PERMISSIONS });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  const { role, permission, enabled } = await req.json() as { role: string; permission: string; enabled: boolean };
  if (role === 'admin') {
    return NextResponse.json({ error: 'Les permissions admin ne peuvent pas être modifiées' }, { status: 400 });
  }
  const db = getDb();
  db.prepare('UPDATE role_permissions SET enabled=? WHERE role=? AND permission=?')
    .run(enabled ? 1 : 0, role, permission);
  return NextResponse.json({ ok: true });
}
