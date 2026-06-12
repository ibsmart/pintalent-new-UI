import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const db = getDb();
  const templates = db.prepare('SELECT * FROM email_templates ORDER BY name').all();
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const { name, subject, body, variables } = await req.json();

  if (!name || !subject || !body) {
    return NextResponse.json({ error: 'name, subject et body sont requis' }, { status: 400 });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO email_templates (id, name, subject, body, variables)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, subject, body, JSON.stringify(variables || []));

  const created = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(id);
  return NextResponse.json(created, { status: 201 });
}
