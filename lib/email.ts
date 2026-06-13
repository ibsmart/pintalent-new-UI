import nodemailer from 'nodemailer';
import { getDb } from './db';

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  const getSetting = (key: string) =>
    (db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined)?.value || '';

  const host = getSetting('smtp_host');
  const port = parseInt(getSetting('smtp_port') || '587');
  const user = getSetting('smtp_user');
  const pass = getSetting('smtp_password');
  const fromName = getSetting('company_name') || getSetting('smtp_from_name');
  const fromEmail = getSetting('smtp_from_email');
  const secure = getSetting('smtp_secure') === 'true';

  if (!host || !user || !pass) return { success: false, error: 'SMTP non configuré' };

  try {
    const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail || user}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function renderTemplate(body: string, subject: string, variables: Record<string, string>) {
  let renderedBody = body;
  let renderedSubject = subject;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key.replace(/\./g, '\\.')}}}`, 'g');
    renderedBody = renderedBody.replace(regex, value);
    renderedSubject = renderedSubject.replace(regex, value);
  }
  return { body: renderedBody, subject: renderedSubject };
}
