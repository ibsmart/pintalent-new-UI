import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, mkdir, readFile } from 'fs/promises';
import path from 'path';

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('job_id');
  const candidateId = searchParams.get('candidate_id');
  const stage = searchParams.get('stage');
  const minScore = searchParams.get('min_score');
  const sort = searchParams.get('sort') || 'created_at';
  const order = searchParams.get('order') || 'DESC';

  try {
    // All applications for a specific candidate
    if (candidateId) {
      const rows = db.prepare(`
        SELECT a.id, a.job_id, a.pipeline_stage, a.score, a.recommendation, a.created_at,
               j.title as job_title, j.department
        FROM applications a
        JOIN jobs j ON j.id = a.job_id
        WHERE a.candidate_id = ?
        ORDER BY a.created_at DESC
      `).all(candidateId);
      return NextResponse.json(rows);
    }

    const hasFilter = jobId || stage || minScore;

    // When filters are active, show only candidates with matching applications
    // Otherwise show ALL candidates (with or without application)
    let query: string;
    const params: unknown[] = [];

    if (hasFilter) {
      query = `
        SELECT a.id, a.candidate_id, a.job_id, a.pipeline_stage, a.score, a.recommendation,
               a.score_summary as summary, a.strengths, a.gaps, a.cover_letter,
               a.created_at, a.updated_at,
               c.name, c.email, c.phone, c.linkedin, c.cv_filename, c.cv_path,
               c.current_title, c.years_experience,
               j.title as job_title, j.department
        FROM applications a
        JOIN candidates c ON c.id = a.candidate_id
        JOIN jobs j ON j.id = a.job_id
        WHERE 1=1
      `;
      if (jobId)    { query += ' AND a.job_id = ?';         params.push(jobId); }
      if (stage)    { query += ' AND a.pipeline_stage = ?';  params.push(stage); }
      if (minScore) { query += ' AND a.score >= ?';          params.push(parseInt(minScore)); }
      const sortCol = sort === 'score' ? 'a.score' : `a.${['created_at','updated_at'].includes(sort) ? sort : 'created_at'}`;
      query += ` ORDER BY ${sortCol} ${order === 'ASC' ? 'ASC' : 'DESC'}`;
    } else {
      // No filter: all candidates, with their best/latest application if any
      query = `
        SELECT a.id, c.id as candidate_id, a.job_id, a.pipeline_stage, a.score, a.recommendation,
               a.score_summary as summary, a.strengths, a.gaps, a.cover_letter,
               COALESCE(a.created_at, c.created_at) as created_at,
               COALESCE(a.updated_at, c.created_at) as updated_at,
               c.name, c.email, c.phone, c.linkedin, c.cv_filename, c.cv_path,
               c.current_title, c.years_experience,
               j.title as job_title, j.department
        FROM candidates c
        LEFT JOIN applications a ON a.id = (
          SELECT id FROM applications WHERE candidate_id = c.id
          ORDER BY created_at DESC LIMIT 1
        )
        LEFT JOIN jobs j ON j.id = a.job_id
        ORDER BY c.created_at DESC
      `;
    }

    const apps = db.prepare(query).all(...params);
    return NextResponse.json(apps);
  } catch (err) {
    console.error('[GET /api/applications]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const db = getDb();

  const contentType = req.headers.get('content-type') || '';

  // ── Shortcut: JSON body with existing candidate_id ──
  if (contentType.includes('application/json')) {
    const body = await req.json();
    const { candidate_id, job_id, pipeline_stage, cover_letter, score, recommendation, score_summary } = body;
    if (!candidate_id || !job_id) {
      return NextResponse.json({ error: 'candidate_id et job_id requis' }, { status: 400 });
    }
    const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(candidate_id) as Record<string, string> | undefined;
    if (!candidate) return NextResponse.json({ error: 'Candidat introuvable' }, { status: 404 });
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id) as Record<string, string> | undefined;
    if (!job) return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 });

    const appId = uuidv4();
    const stage = pipeline_stage || 'Présélectionné';
    db.prepare(`INSERT OR IGNORE INTO applications (id, candidate_id, job_id, cover_letter, pipeline_stage) VALUES (?, ?, ?, ?, ?)`)
      .run(appId, candidate_id, job_id, cover_letter || '', stage);
    db.prepare(`INSERT INTO pipeline_history (id, application_id, to_stage) VALUES (?, ?, ?)`)
      .run(uuidv4(), appId, stage);

    if (score != null) {
      // Score already computed from matching — use it directly, skip re-scoring
      db.prepare(`UPDATE applications SET score=?, recommendation=?, score_summary=?, updated_at=? WHERE id=?`)
        .run(score, recommendation || 'À évaluer', score_summary || null, new Date().toISOString(), appId);
    } else {
      // Score async in background
      scoreCV(appId, candidate.cv_text || '', job, candidate.cv_path || '').catch(() => {});
    }

    return NextResponse.json({ application_id: appId }, { status: 201 });
  }

  // ── Standard form submission (public apply form) ──
  const formData = await req.formData();

  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const phone = formData.get('phone') as string || '';
  const linkedin = formData.get('linkedin') as string || '';
  const jobId = formData.get('job_id') as string;
  const coverLetter = formData.get('cover_letter') as string || '';
  const cvFile = formData.get('cv') as File | null;
  const contractPreference = formData.get('contract_preference') as string || 'CDI';
  const currentSalary      = formData.get('current_salary') as string || '';
  const desiredSalary      = formData.get('desired_salary') as string || '';
  const tjm                = formData.get('tjm') as string || '';
  const noticePeriod       = formData.get('notice_period') as string || '';

  if (!name || !email || !jobId) {
    return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 });
  }

  const job = db.prepare('SELECT * FROM jobs WHERE id = ? AND status = ?').get(jobId, 'active') as Record<string, string> | undefined;
  if (!job) return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 });

  // Save CV + extract text
  let cvFilename = '';
  let cvPath = '';
  let cvText = '';

  if (cvFile && cvFile.size > 0) {
    const buffer = Buffer.from(await cvFile.arrayBuffer());
    const ext = cvFile.name.split('.').pop()?.toLowerCase() || 'pdf';
    cvFilename = cvFile.name;
    const uploadDir = path.join(process.cwd(), 'uploads');
    await mkdir(uploadDir, { recursive: true });
    const savedName = `${uuidv4()}.${ext}`;
    cvPath = path.join(uploadDir, savedName);
    await writeFile(cvPath, buffer);

    // Extract text synchronously before scoring
    try {
      if (ext === 'pdf') {
        // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse');
        const parsed = await pdfParse(buffer);
        cvText = parsed.text || '';
        console.log(`[CV] PDF extracted: ${cvText.length} chars`);
      } else if (ext === 'docx' || ext === 'doc') {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        cvText = result.value || '';
        console.log(`[CV] DOCX extracted: ${cvText.length} chars`);
      }
    } catch (e) {
      console.error('[CV] Extraction error:', e);
    }
  }

  // Create or update candidate — always deduplicate by email
  let candidate = db.prepare('SELECT * FROM candidates WHERE email = ?').get(email) as Record<string, string> | undefined;
  if (!candidate) {
    const candidateId = uuidv4();
    db.prepare(`INSERT INTO candidates (id, name, email, phone, linkedin, cv_filename, cv_path, cv_text, contract_preference, current_salary, desired_salary, tjm, notice_period)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(candidateId, name, email, phone, linkedin, cvFilename, cvPath, cvText, contractPreference, currentSalary, desiredSalary, tjm, noticePeriod);
    candidate = { id: candidateId };
  } else {
    // Only update fields that are non-empty in the new submission (don't overwrite existing data with blanks)
    const updates: string[] = ['name = ?', 'phone = CASE WHEN ? != \'\' THEN ? ELSE phone END'];
    const vals: unknown[] = [name, phone, phone];
    if (linkedin)   { updates.push('linkedin = ?');    vals.push(linkedin); }
    if (cvFilename) { updates.push('cv_filename = ?'); vals.push(cvFilename); }
    if (cvPath)     { updates.push('cv_path = ?');     vals.push(cvPath); }
    if (cvText)     { updates.push('cv_text = ?');     vals.push(cvText); }
    // Only overwrite pretentions if the candidate actually filled something (not just defaults)
    const pretentionsFilled = currentSalary || desiredSalary || tjm || noticePeriod;
    if (pretentionsFilled) {
      updates.push('contract_preference = ?'); vals.push(contractPreference);
      if (currentSalary) { updates.push('current_salary = ?'); vals.push(currentSalary); }
      if (desiredSalary) { updates.push('desired_salary = ?'); vals.push(desiredSalary); }
      if (tjm)           { updates.push('tjm = ?');            vals.push(tjm); }
      if (noticePeriod)  { updates.push('notice_period = ?');  vals.push(noticePeriod); }
    }
    vals.push(candidate.id);
    db.prepare(`UPDATE candidates SET ${updates.join(', ')} WHERE id = ?`).run(...vals);
  }

  // Create application
  const appId = uuidv4();
  db.prepare(`INSERT INTO applications (id, candidate_id, job_id, cover_letter, pipeline_stage)
    VALUES (?, ?, ?, ?, 'Nouveau')`).run(appId, candidate.id, jobId, coverLetter);

  db.prepare(`INSERT INTO pipeline_history (id, application_id, to_stage) VALUES (?, ?, 'Nouveau')`)
    .run(uuidv4(), appId);

  // Score CV synchronously — wait for result before responding
  let scoreResult = { score: 0, summary: '', strengths: '', gaps: '', recommendation: 'À évaluer' };
  if (cvPath) {
    // Always score via Claude (supports both text PDFs and image/scanned PDFs)
    scoreResult = await scoreCV(appId, cvText, job, cvPath);
  } else {
    db.prepare(`UPDATE applications SET recommendation='À évaluer', updated_at=? WHERE id=?`)
      .run(new Date().toISOString(), appId);
  }

  return NextResponse.json({
    id: appId,
    success: true,
    score: scoreResult.score,
    recommendation: scoreResult.recommendation,
    summary: scoreResult.summary,
  }, { status: 201 });
}

async function scoreCV(
  appId: string,
  cvText: string,
  job: Record<string, string>,
  cvFilePath?: string,
): Promise<{ score: number; summary: string; strengths: string; gaps: string; recommendation: string }> {
  const fallback = { score: 50, summary: '', strengths: '', gaps: '', recommendation: 'À évaluer' };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your-anthropic-api-key-here') {
    console.warn('[CV] No ANTHROPIC_API_KEY — skipping AI scoring');
    getDb().prepare(`UPDATE applications SET score=50, recommendation='À évaluer', updated_at=? WHERE id=?`)
      .run(new Date().toISOString(), appId);
    return fallback;
  }

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });

    const jobContext = `FICHE DE POSTE:
Titre: ${job.title}
Département: ${job.department}
Expérience requise: ${job.experience}
Formation: ${job.education}
Profil: ${job.profile}
Compétences clés: ${job.keywords}
Missions: ${(job.missions || '').slice(0, 500)}`;

    const jsonInstruction = `Réponds UNIQUEMENT avec ce JSON (sans markdown, sans aucun autre texte):
{
  "score": <entier 0-100>,
  "strengths": "<points forts du candidat pour ce poste, 2-3 phrases>",
  "gaps": "<lacunes ou points faibles par rapport au poste, 1-2 phrases>",
  "summary": "<synthèse du matching en 2 phrases concises>",
  "recommendation": "<exactement l'une de ces 3 valeurs: À retenir | À évaluer | À écarter>"
}

Barème: compétences techniques (35%), expérience (30%), formation (20%), adéquation sectorielle (15%).
Score ≥75 → À retenir, 45-74 → À évaluer, <45 → À écarter.`;

    // Determine if we can use PDF vision (scanned) or text
    const usePdfVision = cvFilePath && path.extname(cvFilePath).toLowerCase() === '.pdf' && cvText.trim().length < 100;

    type MessageContent = { type: 'text'; text: string } | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } };
    const messageContent: MessageContent[] = [];

    if (usePdfVision && cvFilePath) {
      console.log(`[CV] Using PDF vision mode for ${appId}`);
      const pdfBuffer = await readFile(cvFilePath);
      const pdfBase64 = pdfBuffer.toString('base64');
      messageContent.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
      });
      messageContent.push({
        type: 'text',
        text: `Tu es un expert RH senior. Analyse le CV ci-dessus (document PDF) pour le poste "${job.title}" chez GEEKFACT.\n\n${jobContext}\n\n${jsonInstruction}`,
      });
    } else {
      const cvContent = cvText.trim().length > 50 ? cvText.slice(0, 4000) : '(CV non lisible — évalue sur la base du profil général)';
      messageContent.push({
        type: 'text',
        text: `Tu es un expert RH senior. Analyse ce CV pour le poste "${job.title}" chez GEEKFACT.\n\n${jobContext}\n\nCV DU CANDIDAT:\n${cvContent}\n\n${jsonInstruction}`,
      });
    }

    console.log(`[CV] Calling Claude for app ${appId} (vision=${usePdfVision})...`);
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ role: 'user', content: messageContent as any }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}';
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const result = JSON.parse(cleaned);

    const score = Math.min(100, Math.max(0, parseInt(result.score) || 0));
    const recommendation = ['À retenir', 'À évaluer', 'À écarter'].includes(result.recommendation)
      ? result.recommendation
      : score >= 75 ? 'À retenir' : score >= 45 ? 'À évaluer' : 'À écarter';

    getDb().prepare(`
      UPDATE applications
      SET score=?, score_summary=?, strengths=?, gaps=?, recommendation=?, updated_at=?
      WHERE id=?
    `).run(score, result.summary || '', result.strengths || '', result.gaps || '', recommendation, new Date().toISOString(), appId);

    console.log(`[CV] Score for ${appId}: ${score} — ${recommendation}`);
    return { score, summary: result.summary || '', strengths: result.strengths || '', gaps: result.gaps || '', recommendation };

  } catch (e) {
    console.error('[CV] Scoring error:', e);
    getDb().prepare(`UPDATE applications SET score=50, recommendation='À évaluer', updated_at=? WHERE id=?`)
      .run(new Date().toISOString(), appId);
    return fallback;
  }
}
