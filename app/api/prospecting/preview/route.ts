import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

function generateJobCard(job: {
  title: string; location: string; contract_type: string;
  description: string; id: string;
}, baseUrl: string, primaryColor: string): string {
  const excerpt = (job.description || '').replace(/<[^>]*>/g, '').slice(0, 200).trim();
  const applyUrl = `${baseUrl}/jobs/${job.id}`;
  const contractBadge: Record<string, string> = {
    CDI: '#059669', CDD: '#2563eb', Freelance: '#7c3aed', Stage: '#d97706', Alternance: '#0891b2'
  };
  const color = contractBadge[job.contract_type] || '#6b7280';

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;margin-bottom:20px;overflow:hidden;">
    <tr><td style="padding:24px 28px;">
      <h3 style="color:#111827;font-size:17px;font-weight:700;margin:0 0 10px;line-height:1.3;">${job.title}</h3>
      <table cellpadding="0" cellspacing="0" style="margin-bottom:14px;"><tr>
        <td style="padding-right:16px;"><span style="color:#6b7280;font-size:13px;">📍 ${job.location}</span></td>
        <td><span style="display:inline-block;background:${color}20;color:${color};font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;">${job.contract_type}</span></td>
      </tr></table>
      ${excerpt ? `<p style="color:#4b5563;font-size:14px;line-height:1.6;margin:0 0 18px;">${excerpt}${excerpt.length >= 200 ? '…' : ''}</p>` : ''}
      <a href="${applyUrl}" style="display:inline-block;background:${primaryColor};color:white;padding:11px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
        Voir l'offre et postuler →
      </a>
    </td></tr>
  </table>`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { jobIds, intro, candidateName = 'Prénom Nom' } = body as { jobIds: string[]; intro: string; candidateName?: string };

  const db = getDb();
  const getSetting = (key: string) =>
    (db.prepare('SELECT value FROM settings WHERE key=?').get(key) as { value: string } | undefined)?.value || '';

  const companyName = getSetting('company_name') || getSetting('smtp_from_name') || 'Pintalent';
  const primaryColor = getSetting('primary_color') || '#10b981';
  const baseUrl = req.headers.get('origin') || `https://${req.headers.get('host')}`;

  const placeholders = jobIds.map(() => '?').join(',');
  const jobs = db.prepare(`SELECT id, title, location, contract_type, description FROM jobs WHERE id IN (${placeholders})`).all(...jobIds) as {
    id: string; title: string; location: string; contract_type: string; description: string;
  }[];

  const firstName = candidateName.split(' ')[0];
  const c = primaryColor;
  const jobCards = jobs.map(j => generateJobCard(j, baseUrl, c)).join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:${c};border-radius:16px 16px 0 0;padding:36px 40px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>
              <p style="color:rgba(255,255,255,0.75);font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 4px;">De la part de</p>
              <h1 style="color:white;margin:0;font-size:26px;font-weight:800;letter-spacing:-0.02em;">${companyName}</h1>
            </td>
            <td align="right">
              <div style="width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:12px;text-align:center;line-height:48px;font-size:24px;">🎯</div>
            </td>
          </tr></table>
        </td></tr>

        <tr><td style="background:white;padding:40px 40px 32px;">
          <p style="color:#111827;font-size:18px;font-weight:600;margin:0 0 6px;">Bonjour ${firstName},</p>
          <div style="width:40px;height:3px;background:${c};border-radius:2px;margin-bottom:20px;"></div>
          <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 32px;">${intro.replace(/\n/g, '<br>')}</p>
          <p style="color:#6b7280;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 16px;">Opportunités sélectionnées pour vous</p>
          ${jobCards}
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;background:${c}12;border-radius:10px;border:1px solid ${c}40;">
            <tr><td style="padding:16px 20px;">
              <p style="color:#374151;font-size:13px;line-height:1.6;margin:0;">
                💡 Ces opportunités ont été sélectionnées en fonction de votre profil. Cliquez sur une offre pour en savoir plus et candidater directement en ligne.
              </p>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;border-radius:0 0 16px 16px;padding:20px 40px;">
          <p style="color:#9ca3af;font-size:12px;margin:0;line-height:1.6;">
            Cet email a été envoyé par <strong style="color:#6b7280;">${companyName}</strong> via Pintalent.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return NextResponse.json({ html });
}
