import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sendEmail, renderTemplate } from '@/lib/email';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

interface AutomationRow {
  id: string;
  action_type: string;
  action_config: string;
  subject: string | null;
  body: string | null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  // Try by application id first, then by candidate id (no application)
  let app = db.prepare(`
    SELECT a.*, c.name, c.email, c.phone, c.linkedin, c.cv_filename, c.cv_path, c.cv_text,
           c.contract_preference, c.current_salary, c.desired_salary, c.tjm, c.notice_period,
           c.current_title, c.years_experience,
           j.title as job_title, j.department, j.description as job_description
    FROM applications a
    JOIN candidates c ON a.candidate_id = c.id
    JOIN jobs j ON a.job_id = j.id
    WHERE a.id = ?
  `).get(id) as Record<string, unknown> | undefined;

  let history: unknown[] = [];
  let notes: unknown[] = [];

  if (!app) {
    // Fallback: id is a candidate_id with no application
    const candidate = db.prepare(
      'SELECT *, id as candidate_id, contract_preference, current_salary, desired_salary, tjm, notice_period FROM candidates WHERE id = ?'
    ).get(id) as Record<string, unknown> | undefined;
    if (!candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ...candidate, history: [], notes: [], job_title: null, department: null });
  }

  history = db.prepare('SELECT * FROM pipeline_history WHERE application_id = ? ORDER BY changed_at ASC').all(id);
  notes   = db.prepare('SELECT * FROM notes WHERE application_id = ? ORDER BY created_at DESC').all(id);

  return NextResponse.json({ ...app, history, notes });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json();

  if (body.pipeline_stage) {
    const current = db.prepare('SELECT pipeline_stage FROM applications WHERE id = ?').get(id) as { pipeline_stage: string } | undefined;
    if (current && current.pipeline_stage !== body.pipeline_stage) {
      db.prepare(`INSERT INTO pipeline_history (id, application_id, from_stage, to_stage) VALUES (?, ?, ?, ?)`)
        .run(uuidv4(), id, current.pipeline_stage, body.pipeline_stage);

      // Trigger automations for stage change
      const appData = db.prepare(`
        SELECT c.email, c.name, j.title as job_title
        FROM applications a
        JOIN candidates c ON a.candidate_id = c.id
        JOIN jobs j ON a.job_id = j.id
        WHERE a.id = ?
      `).get(id) as { email: string; name: string; job_title: string } | undefined;

      const automations = db.prepare(`
        SELECT a.*, et.subject, et.body
        FROM automations a
        LEFT JOIN email_templates et ON et.id = json_extract(a.action_config, '$.template_id')
        WHERE a.active = 1 AND a.trigger_type = 'stage_change' AND a.trigger_value = ?
      `).all(body.pipeline_stage) as AutomationRow[];

      const appFull = db.prepare(`
        SELECT a.id, c.id as candidate_id, c.email, c.name, c.phone, c.cv_filename, c.cv_path, c.cv_text, j.title as job_title
        FROM applications a
        JOIN candidates c ON a.candidate_id = c.id
        JOIN jobs j ON a.job_id = j.id
        WHERE a.id = ?
      `).get(id) as { id: string; candidate_id: string; email: string; name: string; phone: string; cv_filename: string; cv_path: string; cv_text: string; job_title: string } | undefined;

      for (const auto of automations) {
        const config = JSON.parse(auto.action_config || '{}');

        /* ── Email ── */
        if (auto.action_type === 'send_email' && appData?.email && auto.subject && auto.body) {
          const vars: Record<string, string> = {
            'candidat.nom': appData.name || '',
            'offre.titre': appData.job_title || '',
            'pipeline.etape': body.pipeline_stage,
            'recruteur.nom': config.recruteur_nom || 'Équipe RH',
            'entreprise.nom': config.entreprise_nom || 'GEEKFACT',
          };
          const { body: renderedBody, subject: renderedSubject } = renderTemplate(auto.body, auto.subject, vars);
          sendEmail({ to: appData.email, subject: renderedSubject, html: renderedBody }).then(result => {
            db.prepare(`INSERT INTO automation_logs (id, automation_id, automation_name, action_type, status, recipient, subject, candidate_name, job_title, pipeline_stage, error)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
              .run(uuidv4(), auto.id, auto.name || '', auto.action_type,
                result.success ? 'success' : 'error',
                appData?.email, renderedSubject,
                appData?.name, appData?.job_title,
                body.pipeline_stage,
                result.error || null);
          }).catch(() => {});
        }

        /* ── Webhook ── */
        if (auto.action_type === 'webhook' && config.url) {
          // Read physical CV file as base64 if available
          let cvBase64 = '';
          let cvMimetype = '';
          if (appFull?.cv_path) {
            try {
              const absPath = path.isAbsolute(appFull.cv_path)
                ? appFull.cv_path
                : path.join(process.cwd(), appFull.cv_path);
              const buf = fs.readFileSync(absPath);
              cvBase64 = buf.toString('base64');
              const ext = path.extname(appFull.cv_path).toLowerCase();
              cvMimetype = ext === '.pdf' ? 'application/pdf'
                : ext === '.docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                : ext === '.doc'  ? 'application/msword'
                : 'application/octet-stream';
            } catch { /* file missing on disk */ }
          }

          // Build absolute cv_url from request host
          const host = req.headers.get('host') || 'localhost:3000';
          const protocol = host.startsWith('localhost') ? 'http' : 'https';
          const cvUrl = appFull?.candidate_id
            ? `${protocol}://${host}/api/candidates/${appFull.candidate_id}/cv`
            : '';

          // All available data
          const allData: Record<string, string> = {
            candidate_name:  appFull?.name          || '',
            candidate_email: appFull?.email         || '',
            candidate_id:    appFull?.candidate_id  || '',
            candidate_phone: appFull?.phone         || '',
            cv_filename:     appFull?.cv_filename   || '',
            cv_url:          cvUrl,
            cv_text:         appFull?.cv_text       || '',
            cv_base64:       cvBase64,
            cv_mimetype:     cvMimetype,
            job_title:       appFull?.job_title     || '',
            application_id:  id,
          };
          // Build payload: always-on fields + selected fields
          const selectedFields: string[] = Array.isArray(config.fields) ? config.fields : Object.keys(allData);
          const payload: Record<string, string> = {
            event: 'stage_change',
            stage: body.pipeline_stage,
          };
          for (const key of selectedFields) {
            if (key in allData) payload[key] = allData[key];
          }
          fetch(config.url, {
            method: config.method || 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: config.method === 'GET' ? undefined : JSON.stringify(payload),
            signal: AbortSignal.timeout(10000),
          }).then(async res => {
            db.prepare(`INSERT INTO automation_logs (id, automation_id, automation_name, action_type, status, recipient, subject, candidate_name, job_title, pipeline_stage, error)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
              .run(uuidv4(), auto.id, auto.name || '', 'webhook',
                res.ok ? 'success' : 'error',
                config.url,
                `${config.method || 'POST'} ${config.url}`,
                appFull?.name, appFull?.job_title,
                body.pipeline_stage,
                res.ok ? null : `HTTP ${res.status}`);
          }).catch(err => {
            db.prepare(`INSERT INTO automation_logs (id, automation_id, automation_name, action_type, status, recipient, subject, candidate_name, job_title, pipeline_stage, error)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
              .run(uuidv4(), auto.id, auto.name || '', 'webhook',
                'error', config.url,
                `${config.method || 'POST'} ${config.url}`,
                appFull?.name, appFull?.job_title,
                body.pipeline_stage,
                String(err?.message || err));
          });
        }
      }
    }
  }

  const fields = Object.keys(body).filter(k =>
    ['pipeline_stage', 'score', 'score_summary', 'strengths', 'gaps', 'recommendation'].includes(k)
  );
  if (fields.length === 0) return NextResponse.json({ error: 'No valid fields' }, { status: 400 });

  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = [...fields.map(f => body[f]), new Date().toISOString(), id];
  db.prepare(`UPDATE applications SET ${setClause}, updated_at = ? WHERE id = ?`).run(...values);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM notes WHERE application_id = ?').run(id);
  db.prepare('DELETE FROM pipeline_history WHERE application_id = ?').run(id);
  db.prepare('DELETE FROM applications WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
