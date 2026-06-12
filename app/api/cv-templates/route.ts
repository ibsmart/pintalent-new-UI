import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const db = getDb();
  const templates = db.prepare('SELECT * FROM cv_templates ORDER BY created_at DESC').all();
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO cv_templates (id, name, primary_color, secondary_color, accent_color, font_style, logo_base64, logo_width, logo_height, company_name, show_photo, anonymize_name, anonymize_contact, sections, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, body.name, body.primary_color || '#1e40af', body.secondary_color || '#f1f5f9',
    body.accent_color || '#3b82f6', body.font_style || 'modern',
    body.logo_base64 || '', body.logo_width || 130, body.logo_height || 46,
    body.company_name || '',
    body.show_photo ? 1 : 0, body.anonymize_name ? 1 : 0, body.anonymize_contact ? 1 : 0,
    JSON.stringify(body.sections || ['summary','experience','skills','education','languages']),
    now, now
  );
  return NextResponse.json({ id }, { status: 201 });
}
