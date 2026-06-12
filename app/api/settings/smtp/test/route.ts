import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  const { to } = await req.json();
  if (!to) return NextResponse.json({ error: 'Adresse email requise' }, { status: 400 });

  const result = await sendEmail({
    to,
    subject: 'Test SMTP - Recruitment App',
    html: `<p>Ceci est un email de test envoyé depuis votre application de recrutement.</p><p>La configuration SMTP fonctionne correctement.</p>`,
  });

  if (result.success) return NextResponse.json({ ok: true });
  return NextResponse.json({ error: result.error }, { status: 500 });
}
