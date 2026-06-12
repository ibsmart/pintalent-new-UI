import { getDb } from './db';

export function hasPermission(role: string, permission: string): boolean {
  if (role === 'admin') return true;
  const db = getDb();
  const row = db.prepare('SELECT enabled FROM role_permissions WHERE role=? AND permission=?').get(role, permission) as { enabled: number } | undefined;
  return row?.enabled === 1;
}
