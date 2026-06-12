import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  const db = getDb();
  const { candidate_ids } = await req.json() as { candidate_ids: string[] };

  if (!candidate_ids || candidate_ids.length === 0) {
    return NextResponse.json({ error: 'candidate_ids requis' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your-anthropic-api-key-here') {
    return NextResponse.json({ error: 'Clé API Anthropic manquante' }, { status: 503 });
  }

  const results: { id: string; current_title: string; years_experience: string; key_skills: string }[] = [];

  for (const candidateId of candidate_ids) {
    const candidate = db.prepare('SELECT id, cv_text FROM candidates WHERE id = ?').get(candidateId) as
      { id: string; cv_text: string } | undefined;

    if (!candidate?.cv_text || candidate.cv_text.trim().length < 50) {
      results.push({ id: candidateId, current_title: '', years_experience: '', key_skills: '' });
      continue;
    }

    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey });

      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `Extrais ces 3 informations du CV ci-dessous. Réponds UNIQUEMENT avec ce JSON (sans markdown) :
{"current_title":"poste actuel ou dernier poste ex: Data Architect Senior","key_skills":"3-5 compétences clés séparées par virgule ex: Python, AWS, Machine Learning","years_experience":"X ans"}

RÈGLES IMPORTANTES pour years_experience :
- Liste tous les postes professionnels (full-time, CDD, CDI, freelance) avec leurs dates
- ADDITIONNE les durées de chaque poste
- Pour les postes "Présent" ou "ongoing", utilise 2026 comme date de fin
- Exemple A : poste 1 = 2 ans + poste 2 = 3 ans + poste 3 = 2 ans → "7 ans"
- Exemple B : premier poste 2007 → dernier 2026 = "19 ans"
- Les stages courts (< 6 mois) ne comptent pas dans le total
- Ne jamais retourner seulement la durée du dernier poste

CV COMPLET :
${candidate.cv_text.slice(0, 10000)}`,
        }],
      });

      const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '{}';
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      const extracted = JSON.parse(cleaned) as { current_title?: string; key_skills?: string; years_experience?: string };

      const title = extracted.current_title || '';
      const years = extracted.years_experience || '';

      // Force overwrite — manual re-extraction always replaces existing values
      db.prepare(`UPDATE candidates SET current_title = ?, years_experience = ? WHERE id = ?`)
        .run(title || null, years || null, candidateId);

      results.push({ id: candidateId, current_title: title, years_experience: years, key_skills: extracted.key_skills || '' });
    } catch (e) {
      console.error(`[extract] error for ${candidateId}:`, e);
      results.push({ id: candidateId, current_title: '', years_experience: '', key_skills: '' });
    }
  }

  return NextResponse.json({ results });
}
