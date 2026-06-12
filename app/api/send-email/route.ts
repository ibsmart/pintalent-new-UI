import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sendEmail, renderTemplate } from '@/lib/email';

export async function POST(req: NextRequest) {
  const { to, template_id, variables } = await req.json();

  if (!to || !template_id) {
    return NextResponse.json({ error: 'to et template_id sont requis' }, { status: 400 });
  }

  const db = getDb();
  const template = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(template_id) as
    | { subject: string; body: string } | undefined;

  if (!template) return NextResponse.json({ error: 'Template introuvable' }, { status: 404 });

  const { subject, body } = renderTemplate(template.body, template.subject, variables || {});
  const result = await sendEmail({ to, subject, html: body });

  if (result.success) return NextResponse.json({ ok: true });
  return NextResponse.json({ error: result.error }, { status: 500 });
}
