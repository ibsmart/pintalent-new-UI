import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  // Fetch enabled permissions for this role
  let permissions: string[] = [];
  if (session.role === 'admin') {
    // Admin has all permissions
    const { ALL_PERMISSIONS } = await import('@/lib/db');
    permissions = ALL_PERMISSIONS;
  } else {
    const db = getDb();
    const rows = db.prepare('SELECT permission FROM role_permissions WHERE role=? AND enabled=1')
      .all(session.role) as { permission: string }[];
    permissions = rows.map(r => r.permission);
  }

  return NextResponse.json({ ...session, permissions });
}
