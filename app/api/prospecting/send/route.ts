import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sendEmail } from '@/lib/email';

function generateJobCard(job: {
  title: string; location: string; contract_type: string;
  description: string; id: string;
}, baseUrl: string): string {
  const excerpt = (job.description || '').replace(/<[^>]*>/g, '').slice(0, 200).trim();
  const applyUrl = `${baseUrl}/jobs/${job.id}`;
  const contractBadge = {
    CDI: '#059669', CDD: '#2563eb', Freelance: '#7c3aed', Stage: '#d97706', Alternance: '#0891b2'
  }[job.contract_type] || '#6b7280';

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;margin-bottom:20px;overflow:hidden;">
    <tr>
      <td style="padding:24px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <h3 style="color:#111827;font-size:17px;font-weight:700;margin:0 0 10px;line-height:1.3;">${job.title}</h3>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
                <tr>
                  <td style="padding-right:16px;">
                    <span style="color:#6b7280;font-size:13px;">📍 ${job.location}</span>
                  </td>
                  <td>
                    <span style="display:inline-block;background:${contractBadge}20;color:${contractBadge};font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;">
                      ${job.contract_type}
                    </span>
                  </td>
                </tr>
              </table>
              ${excerpt ? `<p style="color:#4b5563;font-size:14px;line-height:1.6;margin:0 0 18px;">${excerpt}${excerpt.length >= 200 ? '…' : ''}</p>` : ''}
              <a href="${applyUrl}"
                style="display:inline-block;background:#10b981;color:white;padding:11px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.01em;">
                Voir l'offre et postuler →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function generateEmailHtml(params: {
  candidateName: string;
  intro: string;
  jobCards: string;
  companyName: string;
  fromEmail: string;
}): string {
  const firstName = params.candidateName.split(' ')[0];
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Opportunités d'emploi</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#059669 0%,#10b981 100%);border-radius:16px 16px 0 0;padding:36px 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="color:rgba(255,255,255,0.75);font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 4px;">De la part de</p>
                    <h1 style="color:white;margin:0;font-size:26px;font-weight:800;letter-spacing:-0.02em;">${params.companyName}</h1>
                  </td>
                  <td align="right">
                    <div style="width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;">
                      <span style="font-size:24px;">🎯</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:white;padding:40px 40px 32px;">

              <!-- Greeting -->
              <p style="color:#111827;font-size:18px;font-weight:600;margin:0 0 6px;">Bonjour ${firstName},</p>
              <div style="width:40px;height:3px;background:#10b981;border-radius:2px;margin-bottom:20px;"></div>

              <!-- Intro -->
              <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 32px;">${params.intro.replace(/\n/g, '<br>')}</p>

              <!-- Jobs heading -->
              <p style="color:#111827;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 16px;color:#6b7280;">
                Opportunités sélectionnées pour vous
              </p>

              <!-- Job cards -->
              ${params.jobCards}

              <!-- CTA footer text -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="color:#065f46;font-size:13px;line-height:1.6;margin:0;">
                      💡 Ces opportunités ont été sélectionnées en fonction de votre profil. Cliquez sur une offre pour en savoir plus et candidater directement en ligne.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;border-radius:0 0 16px 16px;padding:20px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="color:#9ca3af;font-size:12px;margin:0;line-height:1.6;">
                      Cet email a été envoyé par <strong style="color:#6b7280;">${params.companyName}</strong> via Pintalent.<br>
                      Vous recevez cet email car votre profil correspond à nos opportunités.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { candidateIds, jobIds, subject, intro } = body as {
      candidateIds: string[];
      jobIds: string[];
      subject: string;
      intro: string;
    };

    if (!candidateIds?.length || !jobIds?.length || !subject || !intro) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    const db = getDb();
    const getSetting = (key: string) =>
      (db.prepare('SELECT value FROM settings WHERE key=?').get(key) as { value: string } | undefined)?.value || '';

    const companyName = getSetting('smtp_from_name') || 'Pintalent';
    const baseUrl = req.headers.get('origin') || `https://${req.headers.get('host')}`;

    // Fetch jobs
    const placeholders = jobIds.map(() => '?').join(',');
    const jobs = db.prepare(`SELECT id, title, location, contract_type, description FROM jobs WHERE id IN (${placeholders})`).all(...jobIds) as {
      id: string; title: string; location: string; contract_type: string; description: string;
    }[];

    // Fetch candidates
    const cPlaceholders = candidateIds.map(() => '?').join(',');
    const candidates = db.prepare(`SELECT id, name, email FROM candidates WHERE id IN (${cPlaceholders})`).all(...candidateIds) as {
      id: string; name: string; email: string;
    }[];

    const results: { candidateId: string; name: string; email: string; success: boolean; error?: string }[] = [];

    for (const candidate of candidates) {
      if (!candidate.email) {
        results.push({ candidateId: candidate.id, name: candidate.name, email: '', success: false, error: 'Pas d\'email' });
        continue;
      }

      const jobCards = jobs.map(j => generateJobCard(j, baseUrl)).join('');
      const html = generateEmailHtml({
        candidateName: candidate.name,
        intro,
        jobCards,
        companyName,
        fromEmail: getSetting('smtp_from_email'),
      });

      const personalizedSubject = subject.replace('{{candidat.nom}}', candidate.name.split(' ')[0]);
      const result = await sendEmail({ to: candidate.email, subject: personalizedSubject, html });
      results.push({ candidateId: candidate.id, name: candidate.name, email: candidate.email, ...result });
    }

    const sent = results.filter(r => r.success).length;
    return NextResponse.json({ ok: true, sent, total: results.length, results });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
