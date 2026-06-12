import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { readFile } from 'fs/promises';
import path from 'path';
import type Anthropic from '@anthropic-ai/sdk';

const BASE_SELECT = [
  'SELECT a.*, c.cv_path, c.cv_filename,',
  'j.title, j.profile, j.keywords, j.experience, j.education, j.missions, j.department',
  'FROM applications a',
  'JOIN candidates c ON a.candidate_id = c.id',
  'JOIN jobs j ON a.job_id = j.id',
].join(' ');

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const app_id: string | undefined = body.app_id;
  const db = getDb();

  const apps = app_id
    ? [db.prepare(BASE_SELECT + ' WHERE a.id = ?').get(app_id)]
    : db.prepare(BASE_SELECT + ' WHERE (a.score = 0 OR a.score_summary IS NULL) AND c.cv_path IS NOT NULL AND c.cv_path != ?').all('');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.includes('your-anthropic')) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY non configurée' }, { status: 500 });
  }

  let scored = 0;
  const errors: string[] = [];

  for (const app of apps as Record<string, string>[]) {
    if (!app || !app.cv_path) continue;
    try {
      const buffer = await readFile(app.cv_path);
      const ext = path.extname(app.cv_path).toLowerCase();
      let cvText = '';

      if (ext === '.pdf') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse');
        const parsed = await pdfParse(buffer);
        cvText = parsed.text || '';
      } else if (ext === '.docx' || ext === '.doc') {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        cvText = result.value || '';
      }

      const AnthropicSdk = (await import('@anthropic-ai/sdk')).default;
      const client = new AnthropicSdk({ apiKey });

      const jobContext = [
        'FICHE DE POSTE:',
        `Titre: ${app.title}`,
        `Département: ${app.department}`,
        `Expérience requise: ${app.experience}`,
        `Formation: ${app.education}`,
        `Profil: ${app.profile}`,
        `Compétences clés: ${app.keywords}`,
        `Missions: ${(app.missions || '').slice(0, 500)}`,
      ].join('\n');

      const jsonInstruction = [
        'Réponds UNIQUEMENT avec ce JSON (sans markdown):',
        '{',
        '  "score": <entier 0-100>,',
        '  "strengths": "<points forts, 2-3 phrases>",',
        '  "gaps": "<lacunes, 1-2 phrases>",',
        '  "summary": "<synthèse du matching, 2 phrases>",',
        '  "recommendation": "<À retenir | À évaluer | À écarter>"',
        '}',
        '',
        'Score ≥75 → À retenir, 45-74 → À évaluer, <45 → À écarter.',
      ].join('\n');

      const isPdfScanned = ext === '.pdf' && cvText.trim().length < 100;
      type MessageContent = { type: 'text'; text: string } | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } };
      let messageContent: MessageContent[];

      if (isPdfScanned) {
        console.log(`[Rescore] Using PDF vision for ${app.id}`);
        const pdfBase64 = buffer.toString('base64');
        messageContent = [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: `Tu es un expert RH senior. Analyse le CV ci-dessus pour le poste "${app.title}" chez GEEKFACT.\n\n${jobContext}\n\n${jsonInstruction}` },
        ];
      } else {
        const cvContent = cvText.trim().length > 50 ? cvText.slice(0, 4000) : '(CV non lisible)';
        messageContent = [
          { type: 'text', text: `Tu es un expert RH senior. Analyse ce CV pour le poste "${app.title}" chez GEEKFACT.\n\n${jobContext}\n\nCV DU CANDIDAT:\n${cvContent}\n\n${jsonInstruction}` },
        ];
      }

      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: messageContent as Parameters<Anthropic['messages']['create']>[0]['messages'][0]['content'] }],
      });

      const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}';
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      const result = JSON.parse(cleaned);

      const score = Math.min(100, Math.max(0, parseInt(result.score) || 0));
      const recommendation = ['À retenir', 'À évaluer', 'À écarter'].includes(result.recommendation)
        ? result.recommendation
        : score >= 75 ? 'À retenir' : score >= 45 ? 'À évaluer' : 'À écarter';

      db.prepare(
        'UPDATE applications SET score=?, score_summary=?, strengths=?, gaps=?, recommendation=?, updated_at=? WHERE id=?'
      ).run(score, result.summary || '', result.strengths || '', result.gaps || '', recommendation, new Date().toISOString(), app.id);

      console.log(`[Rescore] ${app.id}: ${score} — ${recommendation}`);
      scored++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${app.id}: ${msg}`);
      console.error(`[Rescore] Error for ${app.id}:`, e);
    }
  }

  return NextResponse.json({ scored, total: apps.length, errors });
}
