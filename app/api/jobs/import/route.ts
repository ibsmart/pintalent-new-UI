import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export interface ParsedJob {
  title: string;
  department: string;
  location: string;
  contract_type: string;
  experience: string;
  education: string;
  description: string;
  missions: string;
  profile: string;
  keywords: string;
}

const DEPARTMENTS = [
  'Data & BI', 'Digital', 'Innovation', 'Opérations Bancaires', 'Monétique',
  'Crédits', 'Risques & Conformité', 'Produits Bancaires', 'Marchés Financiers',
  'Finance', 'Commercial', 'Paiements', 'Ressources Humaines', 'IT & Support',
];

function cleanStr(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

// --- Step 1: extract raw titles (and any extra fields) from file ---

async function extractFromExcel(buffer: Buffer): Promise<Partial<ParsedJob>[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx');
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
  if (rows.length === 0) return [];

  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

  const normalizedRows = rows.map(row => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) out[norm(k)] = cleanStr(v);
    return out;
  });

  const pick = (row: Record<string, string>, ...aliases: string[]) => {
    for (const a of aliases) if (row[a]) return row[a];
    return '';
  };

  return normalizedRows
    .filter(r => pick(r, 'title', 'titre', 'intitule', 'poste', 'intitule_du_poste'))
    .map(r => ({
      title: pick(r, 'title', 'titre', 'intitule', 'poste', 'intitule_du_poste'),
      department: pick(r, 'department', 'departement', 'service', 'direction', 'pole') || undefined,
      location: pick(r, 'location', 'localisation', 'lieu', 'ville') || undefined,
      contract_type: pick(r, 'contract_type', 'contrat', 'type_contrat', 'type_de_contrat') || undefined,
      experience: pick(r, 'experience', 'exp', 'annees_experience', 'experience_requise') || undefined,
      education: pick(r, 'education', 'formation', 'diplome', 'niveau_etudes') || undefined,
      description: pick(r, 'description', 'contexte', 'presentation', 'desc') || undefined,
      missions: pick(r, 'missions', 'responsabilites', 'activites', 'taches') || undefined,
      profile: pick(r, 'profile', 'profil', 'profil_recherche', 'competences') || undefined,
      keywords: pick(r, 'keywords', 'mots_cles', 'competences_cles', 'skills', 'tags') || undefined,
    }));
}

async function extractFromWord(buffer: Buffer): Promise<Partial<ParsedJob>[]> {
  const mammoth = await import('mammoth');
  const { value: text } = await mammoth.extractRawText({ buffer });
  if (!text || text.trim().length < 5) return [];

  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  // Ask Claude to analyze the document and extract structured job data directly.
  // It must decide: is this ONE job description, or a LIST of jobs?
  const prompt = `Tu es un expert RH. Analyse ce document Word et extrais les fiches de poste qu'il contient.

RÈGLES IMPORTANTES :
- Si le document décrit UN SEUL poste (même avec plusieurs sections/titres), retourne UN SEUL objet.
- Si le document est une LISTE de postes distincts, retourne un objet par poste.
- Ne confonds PAS les sections d'une fiche de poste (Missions, Profil, Compétences…) avec des offres différentes.
- Un document intitulé "Analytics & AI Architect" ou "Chef de projet Data" = UNE seule offre.

Pour chaque poste trouvé, extrais ces champs (laisse vide si absent) :
- title : intitulé exact du poste
- department : département/direction (Data & BI, Digital, Finance, RH, IT…)
- location : ville (Casablanca par défaut)
- contract_type : CDI / CDD / Freelance (CDI par défaut)
- experience : années d'expérience requises
- education : niveau de formation requis
- description : contexte et présentation du poste (2-3 phrases)
- missions : missions principales (bullet points commençant par "• ")
- profile : profil recherché et compétences (2-3 phrases)
- keywords : compétences clés séparées par des virgules

Retourne UNIQUEMENT un tableau JSON valide, sans markdown, sans texte avant/après.
Exemple pour un seul poste : [{"title":"Analytics & AI Architect","department":"Data & BI",...}]

DOCUMENT :
${text.slice(0, 12000)}`;

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '[]';
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  try {
    let result = JSON.parse(cleaned);
    if (!Array.isArray(result)) result = [result];
    // Filter: must have at least a title
    return (result as Partial<ParsedJob>[]).filter(j => j.title && String(j.title).trim().length > 2);
  } catch {
    console.error('[Import Word] JSON parse failed:', cleaned.slice(0, 200));
    // Last resort: return just the document title as one job
    const firstLine = text.split('\n').map(l => l.trim()).find(l => l.length > 3 && l.length < 150);
    return firstLine ? [{ title: firstLine }] : [];
  }
}

// --- Step 2: generate full job descriptions via Claude for all jobs at once ---

async function generateDescriptions(jobs: Partial<ParsedJob>[], apiKey: string): Promise<ParsedJob[]> {
  // Jobs that already have description + missions + profile don't need generation
  const needsGeneration = jobs.filter(j =>
    !j.description || j.description.trim().length < 20 ||
    !j.missions || j.missions.trim().length < 20
  );
  const alreadyComplete = jobs.filter(j => j.description && j.description.trim().length >= 20) as ParsedJob[];

  if (needsGeneration.length === 0) return alreadyComplete;

  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey });

  const titlesJson = JSON.stringify(needsGeneration.map(j => ({
    title: j.title,
    department: j.department || '',
    location: j.location || '',
    contract_type: j.contract_type || '',
    experience: j.experience || '',
    education: j.education || '',
  })));

  const prompt = `Tu es un expert RH senior chez GEEKFACT, entreprise de services financiers et bancaires au Maroc.

Pour chaque poste dans la liste JSON ci-dessous, génère une fiche de poste complète et réaliste adaptée au secteur bancaire/fintech marocain.

Pour chaque poste, retourne un objet JSON avec ces champs:
- title: reprend exactement le titre fourni
- department: choisis le département le plus adapté parmi: ${DEPARTMENTS.join(', ')}
- location: utilise la valeur fournie ou "Casablanca" par défaut
- contract_type: utilise la valeur fournie ou "CDI" par défaut
- experience: expérience requise réaliste (ex: "3-5 ans", "5-8 ans", "2 ans minimum")
- education: formation requise (ex: "Bac+5 en Informatique", "Bac+5 Finance/Gestion")
- description: 3-4 phrases décrivant le contexte du poste et son rôle stratégique chez GEEKFACT
- missions: liste des 5-7 missions principales, séparées par des sauts de ligne, chacune commençant par "• "
- profile: 3-4 phrases décrivant le profil idéal (compétences techniques et soft skills)
- keywords: 6-10 compétences clés séparées par des virgules

POSTES À GÉNÉRER:
${titlesJson}

Retourne UNIQUEMENT un tableau JSON valide avec autant d'objets que de postes en entrée, dans le même ordre. Sans markdown, sans texte avant ou après.`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '[]';
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  let generated: ParsedJob[] = [];
  try {
    generated = JSON.parse(cleaned);
    if (!Array.isArray(generated)) generated = [generated];
  } catch {
    console.error('[Import] Failed to parse generation JSON:', cleaned.slice(0, 300));
    // Fallback: return with title only
    return [
      ...alreadyComplete,
      ...needsGeneration.map(j => ({
        title: j.title || '',
        department: j.department || 'IT & Support',
        location: j.location || 'Casablanca',
        contract_type: j.contract_type || 'CDI',
        experience: j.experience || '',
        education: j.education || '',
        description: '',
        missions: '',
        profile: '',
        keywords: '',
      })),
    ];
  }

  // Merge: generated fields, but prefer any existing data from the file
  const merged: ParsedJob[] = needsGeneration.map((orig, i) => {
    const gen = generated[i] || {};
    return {
      title: cleanStr(orig.title || gen.title),
      department: cleanStr(orig.department || gen.department) || 'IT & Support',
      location: cleanStr(orig.location || gen.location) || 'Casablanca',
      contract_type: cleanStr(orig.contract_type || gen.contract_type) || 'CDI',
      experience: cleanStr(orig.experience || gen.experience),
      education: cleanStr(orig.education || gen.education),
      description: cleanStr(gen.description),
      missions: cleanStr(gen.missions),
      profile: cleanStr(gen.profile),
      keywords: cleanStr(gen.keywords),
    };
  });

  return [...alreadyComplete, ...merged];
}

// --- Route handler ---

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('mode'); // 'save' to insert into DB

  // Save mode: body is JSON list of jobs from preview
  if (mode === 'save') {
    const body = await req.json().catch(() => null);
    if (!body?.jobs || !Array.isArray(body.jobs)) {
      return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
    }
    const db = getDb();
    let inserted = 0;
    for (const job of body.jobs as ParsedJob[]) {
      if (!job.title) continue;
      db.prepare(`
        INSERT INTO jobs (id, title, department, location, contract_type, experience, education, description, missions, profile, keywords, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `).run(
        uuidv4(), job.title,
        job.department || 'IT & Support',
        job.location || 'Casablanca',
        job.contract_type || 'CDI',
        job.experience || '', job.education || '',
        job.description || '', job.missions || '',
        job.profile || '', job.keywords || '',
      );
      inserted++;
    }
    return NextResponse.json({ inserted });
  }

  // Parse + generate mode
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!['xlsx', 'xls', 'docx', 'doc'].includes(ext)) {
    return NextResponse.json({ error: 'Format non supporté. Utilisez .xlsx, .xls, .docx ou .doc' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey || apiKey.includes('your-anthropic')) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY requis' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let rawJobs: Partial<ParsedJob>[] = [];
  try {
    rawJobs = ext === 'xlsx' || ext === 'xls'
      ? await extractFromExcel(buffer)
      : await extractFromWord(buffer);
  } catch (e) {
    return NextResponse.json({ error: `Erreur de lecture: ${e instanceof Error ? e.message : e}` }, { status: 500 });
  }

  if (rawJobs.length === 0) {
    return NextResponse.json({ error: 'Aucun poste détecté dans le fichier' }, { status: 422 });
  }

  // Cap at 30 jobs per import to avoid timeout
  const capped = rawJobs.slice(0, 30);

  let jobs: ParsedJob[] = [];
  try {
    jobs = await generateDescriptions(capped, apiKey);
  } catch (e) {
    return NextResponse.json({ error: `Erreur de génération: ${e instanceof Error ? e.message : e}` }, { status: 500 });
  }

  return NextResponse.json({ jobs, count: jobs.length, capped: rawJobs.length > 30 });
}
