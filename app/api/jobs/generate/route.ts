import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const body = await req.json();
  const { title, department, location, contract_type, experience, education } = body;

  if (!title) return NextResponse.json({ error: 'Intitulé du poste requis' }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your-anthropic-api-key-here') {
    return NextResponse.json({ error: 'Clé API Anthropic non configurée' }, { status: 503 });
  }

  const prompt = `Tu es un expert RH spécialisé dans la rédaction de fiches de poste professionnelles.

Génère une fiche de poste complète et attractive pour le poste suivant :
- Intitulé : ${title}
- Département : ${department || 'Non précisé'}
- Localisation : ${location || 'Non précisée'}
- Type de contrat : ${contract_type || 'Non précisé'}
- Expérience requise : ${experience || 'Non précisée'}
- Formation : ${education || 'Non précisée'}

Réponds UNIQUEMENT avec ce JSON (sans markdown, sans commentaires) :
{
  "description": "Présentation du poste et du contexte (3-4 phrases percutantes)",
  "missions": "- Mission 1\\n- Mission 2\\n- Mission 3\\n- Mission 4\\n- Mission 5",
  "profile": "Profil recherché détaillé : compétences techniques, soft skills, formation attendue (3-4 phrases)",
  "keywords": "Compétence1, Compétence2, Compétence3, Compétence4, Compétence5"
}

La description doit être engageante et donner envie de postuler. Les missions doivent être concrètes. Le profil doit être précis mais accessible.`;

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '{}';
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

    let result: { description: string; missions: string; profile: string; keywords: string };
    try {
      result = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'Réponse Claude non parseable' }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (e: unknown) {
    console.error('[generate job] error:', e);
    return NextResponse.json({ error: 'Erreur lors de la génération' }, { status: 500 });
  }
}
