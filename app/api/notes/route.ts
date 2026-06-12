import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  const db = getDb();
  const { application_id, content, author } = await req.json();

  if (!application_id || !content) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
  }

  const id = uuidv4();
  db.prepare('INSERT INTO notes (id, application_id, content, author) VALUES (?, ?, ?, ?)')
    .run(id, application_id, content, author || 'RH');

  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
  return NextResponse.json(note, { status: 201 });
}
