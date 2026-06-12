import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const db = getDb();
  const automations = db.prepare(`
    SELECT a.*, et.name as template_name
    FROM automations a
    LEFT JOIN email_templates et ON et.id = json_extract(a.action_config, '$.template_id')
    ORDER BY a.name
  `).all();
  return NextResponse.json(automations);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const { name, trigger_type, trigger_value, action_type, action_config } = await req.json();

  if (!name || !trigger_type || !trigger_value || !action_type) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO automations (id, name, trigger_type, trigger_value, action_type, action_config)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name, trigger_type, trigger_value, action_type, JSON.stringify(action_config || {}));

  const created = db.prepare('SELECT * FROM automations WHERE id = ?').get(id);
  return NextResponse.json(created, { status: 201 });
}
