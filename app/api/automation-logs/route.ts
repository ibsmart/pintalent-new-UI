import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const limit  = parseInt(searchParams.get('limit') || '100');

  let query = `SELECT * FROM automation_logs WHERE 1=1`;
  const params: unknown[] = [];
  if (status) { query += ' AND status = ?'; params.push(status); }
  query += ` ORDER BY executed_at DESC LIMIT ${limit}`;

  const logs = db.prepare(query).all(...params);
  return NextResponse.json(logs);
}

export async function DELETE(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (id) {
    db.prepare('DELETE FROM automation_logs WHERE id = ?').run(id);
  } else {
    db.prepare('DELETE FROM automation_logs').run();
  }
  return NextResponse.json({ success: true });
}
