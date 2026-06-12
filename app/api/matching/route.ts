import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { readFile } from 'fs/promises';
import path from 'path';
import { getSession } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export const maxDuration = 60; // seconds

/* ── helpers ── */
async function getCvText(cvText: string, cvPath: string): Promise<{ text: string; base64Pdf: string | null }> {
  if (cvText && cvText.trim().length >= 100) return { text: cvText.slice(0, 4000), base64Pdf: null };
  // Scanned PDF fallback
  if (cvPath && path.extname(cvPath).toLowerCase() === '.pdf') {
    try {
      const buf = await readFile(cvPath);
      return { text: '', base64Pdf: buf.toString('base64') };
    } catch { /* file missing */ }
  }
  return { text: cvText || '', base64Pdf: null };
}

/* ──────────────────────────────────────────────────────────
   POST /api/matching
   body: { type: 'candidate_to_jobs', candidate_id }
      OR { type: 'job_to_candidates', job_id }
─────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (!hasPermission(session.role, 'matching.run')) return NextResponse.json({ error: 'Permission refusée' }, { status: 403 });

  const db = getDb();
  const body = await req.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey === 'your-anthropic-api-key-here') {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY manquant' }, { status: 500 });
  }

  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey });

  /* ── Candidat → Offres ── */
  if (body.type === 'candidate_to_jobs') {
    const { candidate_id, job_ids } = body;
    const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(candidate_id) as Record<string, string> | undefined;
    if (!candidate) return NextResponse.json({ error: 'Candidat introuvable' }, { status: 404 });

    // Filter by selected job_ids if provided, otherwise all active jobs
    let jobs: Record<string, string>[];
    if (Array.isArray(job_ids) && job_ids.length > 0) {
      const placeholders = job_ids.map(() => '?').join(',');
      jobs = db.prepare(`SELECT id, title, department, contract_type, experience, profile, keywords, missions FROM jobs WHERE status = 'active' AND id IN (${placeholders}) LIMIT 30`).all(...job_ids) as Record<string, string>[];
    } else {
      jobs = db.prepare(`SELECT id, title, department, contract_type, experience, profile, keywords, missions FROM jobs WHERE status = 'active' LIMIT 30`).all() as Record<string, string>[];
    }
    if (jobs.length === 0) return NextResponse.json({ results: [] });

    const { text: cvText, base64Pdf } = await getCvText(candidate.cv_text || '', candidate.cv_path || '');

    const jobList = jobs.map((j, i) =>
      `${i + 1}. ID:${j.id} | ${j.title} (${j.department}) | Exp: ${j.experience || 'N/A'} | Profil: ${(j.profile || '').slice(0, 200)} | Compétences: ${j.keywords || ''}`
    ).join('\n');

    const instruction = `Tu es un expert RH. Évalue la compatibilité de ce candidat avec chaque offre d'emploi.
Réponds UNIQUEMENT avec ce JSON (sans markdown):
[{"job_id":"...","score":0-100,"recommendation":"À retenir|À évaluer|À écarter","reason":"2 phrases max"}]
Trie du score le plus élevé au plus bas. Inclus toutes les offres.

OFFRES:
${jobList}`;

    type MsgContent = { type: 'text'; text: string } | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } };
    const content: MsgContent[] = [];

    if (base64Pdf) {
      content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Pdf } });
      content.push({ type: 'text', text: `Analyse le CV ci-dessus (PDF).\n\n${instruction}` });
    } else {
      content.push({ type: 'text', text: `CV DU CANDIDAT (${candidate.name}):\n${cvText || '(CV non disponible)'}\n\n${instruction}` });
    }

    // max_tokens: 26 jobs × ~80 tokens each = ~2100 min; use 6000 to be safe
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 6000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ role: 'user', content: content as any }],
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '[]';
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

    let results: { job_id: string; score: number; recommendation: string; reason: string }[] = [];
    try {
      results = JSON.parse(cleaned);
    } catch {
      // Claude may have truncated — try to recover partial JSON array
      const partial = cleaned.match(/\[[\s\S]*\}/);
      if (partial) {
        try { results = JSON.parse(partial[0] + ']'); } catch { /* give up */ }
      }
      if (results.length === 0) {
        console.error('[matching] JSON parse failed. Raw:', raw.slice(0, 500));
        return NextResponse.json({ results: [], message: 'Réponse Claude non parseable — réessayez.' });
      }
    }

    // Enrich with job metadata
    const jobMap = Object.fromEntries(jobs.map(j => [j.id, j]));
    const enriched = results.map(r => ({ ...r, ...jobMap[r.job_id] })).filter(r => (r as Record<string,unknown>).title);

    return NextResponse.json({ results: enriched, candidate_name: candidate.name });
  }

  /* ── Offre → Candidats ── */
  if (body.type === 'job_to_candidates') {
    const { job_id } = body;
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id) as Record<string, string> | undefined;
    if (!job) return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 });

    // Get candidates with CV text (prefer those with cv_text, fallback to scanned)
    const candidates = db.prepare(`
      SELECT c.id, c.name, c.email, c.cv_text, c.cv_path, c.cv_filename,
        MAX(a.score) as existing_score
      FROM candidates c
      LEFT JOIN applications a ON a.candidate_id = c.id AND a.job_id = ?
      WHERE c.cv_text IS NOT NULL AND c.cv_text != ''
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT 30
    `).all(job_id) as Record<string, string>[];

    if (candidates.length === 0) {
      return NextResponse.json({ results: [], job_title: job.title, message: 'Aucun candidat avec CV en base' });
    }

    const jobContext = `OFFRE: ${job.title} (${job.department})
Expérience: ${job.experience || 'N/A'} | Formation: ${job.education || 'N/A'}
Profil: ${(job.profile || '').slice(0, 300)}
Compétences: ${job.keywords || ''}
Missions: ${(job.missions || '').slice(0, 300)}`;

    const candidateList = candidates.map((c, i) =>
      `${i + 1}. ID:${c.id} | ${c.name}\nCV: ${(c.cv_text || '').slice(0, 300).replace(/\n+/g, ' ')}`
    ).join('\n\n');

    const prompt = `Tu es un expert RH. Évalue la compatibilité de chaque candidat avec cette offre.

${jobContext}

Réponds UNIQUEMENT avec ce JSON (sans markdown):
[{"candidate_id":"...","score":0-100,"recommendation":"À retenir|À évaluer|À écarter","reason":"2 phrases max"}]
Trie du score le plus élevé au plus bas.

CANDIDATS:
${candidateList}`;

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 6000,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '[]';
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

    let results: { candidate_id: string; score: number; recommendation: string; reason: string }[] = [];
    try {
      results = JSON.parse(cleaned);
    } catch {
      const partial = cleaned.match(/\[[\s\S]*\}/);
      if (partial) {
        try { results = JSON.parse(partial[0] + ']'); } catch { /* give up */ }
      }
      if (results.length === 0) {
        console.error('[matching job_to_candidates] JSON parse failed. Raw:', raw.slice(0, 500));
        return NextResponse.json({ results: [], message: 'Réponse Claude non parseable — réessayez.' });
      }
    }

    const candidateMap = Object.fromEntries(candidates.map(c => [c.id, c]));
    const enriched = results.map(r => ({ ...r, ...candidateMap[r.candidate_id] })).filter(r => (r as Record<string,unknown>).name);

    return NextResponse.json({ results: enriched, job_title: job.title });
  }

  return NextResponse.json({ error: 'Type invalide' }, { status: 400 });
}
