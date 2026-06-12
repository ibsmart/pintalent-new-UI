import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const template = db.prepare('SELECT * FROM cv_templates WHERE id=?').get(id);
  if (!template) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  return NextResponse.json(template);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json();
  db.prepare(`
    UPDATE cv_templates SET name=?, primary_color=?, secondary_color=?, accent_color=?, font_style=?,
    logo_base64=?, logo_width=?, logo_height=?, company_name=?, show_photo=?, anonymize_name=?, anonymize_contact=?, sections=?, updated_at=?
    WHERE id=?
  `).run(
    body.name, body.primary_color, body.secondary_color, body.accent_color, body.font_style,
    body.logo_base64 || '', body.logo_width || 130, body.logo_height || 46,
    body.company_name || '',
    body.show_photo ? 1 : 0, body.anonymize_name ? 1 : 0, body.anonymize_contact ? 1 : 0,
    JSON.stringify(body.sections || []), new Date().toISOString(), id
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM cv_templates WHERE id=?').run(id);
  return NextResponse.json({ ok: true });
}
