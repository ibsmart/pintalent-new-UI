import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getSession } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export async function GET() {
  const db = getDb();
  const candidates = db.prepare(`
    SELECT c.*,
      COUNT(a.id) as application_count,
      MAX(a.score) as best_score
    FROM candidates c
    LEFT JOIN applications a ON a.candidate_id = c.id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all();
  return NextResponse.json(candidates);
}

type ExtractedContact = { name: string; email: string; phone: string; linkedin: string; current_title: string; key_skills: string; years_experience: string };
const EMPTY_CONTACT: ExtractedContact = { name: '', email: '', phone: '', linkedin: '', current_title: '', key_skills: '', years_experience: '' };

/* ── Fast regex extraction — no API call, instant ── */
function extractContactFromText(text: string): ExtractedContact {
  const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = text.match(/(\+?[\d\s\-().]{7,20})/);
  const linkedinMatch = text.match(/linkedin\.com\/in\/([a-zA-Z0-9\-_%]+)/i);

  // Name extraction — multiple strategies
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  let name = '';

  for (const line of lines.slice(0, 15)) {
    // Skip lines that look like section headers, emails, URLs, phone numbers
    if (/[@\/\\.com|http|tel:|mob:|tél|email|phone|linkedin|github|adresse|né|born|\d{4}]/i.test(line)) continue;
    if (line.length > 80 || line.length < 3) continue;

    // Strategy 1: Title case — "Prénom Nom" or "Prénom Nom Autre" (2-4 words)
    if (/^[A-ZÀ-ÿ][a-zA-ZÀ-ÿ\-']+([\s\-][A-ZÀ-ÿ][a-zA-ZÀ-ÿ\-']+){1,3}$/.test(line)) {
      name = line; break;
    }
    // Strategy 2: ALL CAPS name — "BELLAMINE ISMAIL" or "JEAN-PIERRE MARTIN"
    if (/^[A-ZÀ-ÿ\-']{2,}([\s][A-ZÀ-ÿ\-']{2,}){1,3}$/.test(line) && line === line.toUpperCase()) {
      // Convert "BELLAMINE ISMAIL" → "Bellamine Ismail"
      name = line.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      break;
    }
  }

  return {
    name,
    email: emailMatch?.[0] || '',
    phone: phoneMatch?.[0]?.trim() || '',
    linkedin: linkedinMatch ? `https://linkedin.com/in/${linkedinMatch[1]}` : '',
    current_title: '',
    key_skills: '',
    years_experience: '',
  };
}

/* ── Background Claude enrichment (non-blocking) ── */
async function enrichCandidateWithClaude(candidateId: string, cvText: string): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your-anthropic-api-key-here') return;
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Extrais les informations de ce CV. Réponds UNIQUEMENT avec ce JSON (sans markdown) :
{"name":"Prénom Nom","email":"email ou vide","phone":"téléphone ou vide","linkedin":"url linkedin ou vide","current_title":"poste actuel ou dernier poste ex: Data Architect Senior","key_skills":"3-5 compétences clés séparées par virgule ex: Python, AWS, Machine Learning","years_experience":"X ans"}

RÈGLES IMPORTANTES pour years_experience :
- Liste tous les postes professionnels (full-time, CDD, CDI, freelance) avec leurs dates
- ADDITIONNE les durées de chaque poste (ne pas soustraire les stages/internship)
- Pour les postes "Présent" ou "ongoing", utilise 2026 comme date de fin
- Exemple A : poste 1 = 2 ans + poste 2 = 3 ans + poste 3 = 2 ans → "7 ans"
- Exemple B : premier poste 2007 → dernier 2026 = "19 ans"
- Les stages courts (< 6 mois) ne comptent pas dans le total
- Ne jamais retourner seulement la durée du dernier poste

CV COMPLET :
${cvText.slice(0, 10000)}`,
      }],
    });
    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '{}';
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const data = JSON.parse(cleaned) as ExtractedContact;
    // Update candidate with enriched data
    const { getDb } = await import('@/lib/db');
    const db = getDb();
    db.prepare(`UPDATE candidates SET
      name = CASE WHEN name = '' OR name IS NULL THEN ? ELSE name END,
      email = CASE WHEN email = '' OR email IS NULL THEN ? ELSE email END,
      phone = CASE WHEN phone = '' OR phone IS NULL THEN ? ELSE phone END,
      linkedin = CASE WHEN linkedin = '' OR linkedin IS NULL THEN ? ELSE linkedin END,
      current_title = CASE WHEN ? != '' THEN ? ELSE current_title END,
      years_experience = CASE WHEN ? != '' THEN ? ELSE years_experience END
      WHERE id = ?`).run(
      data.name || '', data.email || '', data.phone || '', data.linkedin || '',
      data.current_title || '', data.current_title || '',
      data.years_experience || '', data.years_experience || '',
      candidateId
    );
  } catch { /* silent — candidate already saved, enrichment is best-effort */ }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (!hasPermission(session.role, 'candidates.create')) return NextResponse.json({ error: 'Permission refusée' }, { status: 403 });

  const db = getDb();
  const formData = await req.formData();

  let name     = (formData.get('name') as string || '').trim();
  let email    = (formData.get('email') as string || '').trim();
  let phone    = (formData.get('phone') as string || '').trim();
  let linkedin = (formData.get('linkedin') as string || '').trim();
  const jobId  = formData.get('job_id') as string || '';
  const cvFile = formData.get('cv') as File | null;
  const stage  = formData.get('stage') as string || 'Présélectionné';
  const contractPreference = formData.get('contract_preference') as string || 'CDI';
  const currentSalary      = formData.get('current_salary') as string || '';
  const desiredSalary      = formData.get('desired_salary') as string || '';
  const tjm                = formData.get('tjm') as string || '';
  const noticePeriod       = formData.get('notice_period') as string || '';

  // Save CV and extract text
  let cvFilename = '', cvPath = '', cvText = '';
  if (cvFile && cvFile.size > 0) {
    const buffer = Buffer.from(await cvFile.arrayBuffer());
    const ext = cvFile.name.split('.').pop()?.toLowerCase() || 'pdf';
    cvFilename = cvFile.name;
    const uploadDir = path.join(process.cwd(), 'uploads');
    await mkdir(uploadDir, { recursive: true });
    const savedName = `${uuidv4()}.${ext}`;
    cvPath = path.join(uploadDir, savedName);
    await writeFile(cvPath, buffer);

    try {
      if (ext === 'pdf') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse');
        const parsed = await pdfParse(buffer);
        cvText = parsed.text || '';
      } else if (ext === 'docx' || ext === 'doc') {
        const mammoth = await import('mammoth');
        cvText = (await mammoth.extractRawText({ buffer })).value || '';
      }
    } catch { /* ignore */ }
  }

  // Instant regex extraction — no API wait
  let extractedContact: ExtractedContact = EMPTY_CONTACT;
  if (cvText) {
    extractedContact = extractContactFromText(cvText);
    if (!name)     name     = extractedContact.name     || '';
    if (!email)    email    = extractedContact.email    || '';
    if (!phone)    phone    = extractedContact.phone    || phone;
    if (!linkedin) linkedin = extractedContact.linkedin || linkedin;
  }

  if (!name && !email) {
    return NextResponse.json({ error: 'Impossible d\'extraire les coordonnées. Veuillez saisir le nom et l\'email manuellement.' }, { status: 400 });
  }

  // Create or update candidate — check by email first, then by cv_filename as fallback
  let candidate = email
    ? db.prepare('SELECT * FROM candidates WHERE email = ?').get(email) as { id: string } | undefined
    : undefined;

  // Fallback: same CV filename already in DB (re-upload of same file)
  if (!candidate && cvFilename) {
    candidate = db.prepare('SELECT * FROM candidates WHERE cv_filename = ?').get(cvFilename) as { id: string } | undefined;
  }

  const currentTitle    = extractedContact?.current_title    || '';
  const yearsExperience = extractedContact?.years_experience || '';

  const isExisting = !!candidate;

  if (!candidate) {
    const candidateId = uuidv4();
    db.prepare(`INSERT INTO candidates (id, name, email, phone, linkedin, cv_filename, cv_path, cv_text, contract_preference, current_salary, desired_salary, tjm, notice_period, current_title, years_experience) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(candidateId, name, email, phone, linkedin, cvFilename, cvPath, cvText, contractPreference, currentSalary, desiredSalary, tjm, noticePeriod, currentTitle, yearsExperience);
    candidate = { id: candidateId };
  } else {
    db.prepare("UPDATE candidates SET name=?, phone=?, linkedin=?, cv_filename=?, cv_path=?, cv_text=?, contract_preference=?, current_salary=?, desired_salary=?, tjm=?, notice_period=?, current_title=CASE WHEN ? != '' THEN ? ELSE current_title END, years_experience=CASE WHEN ? != '' THEN ? ELSE years_experience END WHERE id=?")
      .run(name, phone, linkedin, cvFilename || null, cvPath || null, cvText || null, contractPreference, currentSalary, desiredSalary, tjm, noticePeriod, currentTitle, currentTitle, yearsExperience, yearsExperience, candidate.id);
  }

  // Fire-and-forget Claude enrichment (title, years_experience, key_skills)
  if (cvText) {
    enrichCandidateWithClaude(candidate.id, cvText).catch(() => {});
  }

  // Optionally create application
  let appId: string | null = null;
  if (jobId) {
    const job = db.prepare('SELECT id FROM jobs WHERE id = ?').get(jobId);
    if (job) {
      appId = uuidv4();
      db.prepare(`INSERT INTO applications (id, candidate_id, job_id, cover_letter, pipeline_stage) VALUES (?, ?, ?, '', ?)`)
        .run(appId, candidate.id, jobId, stage);
      db.prepare(`INSERT INTO pipeline_history (id, application_id, to_stage) VALUES (?, ?, ?)`)
        .run(uuidv4(), appId, stage);
    }
  }

  // Fetch the latest stored data for this candidate (to return current_title etc. even if already existed)
  const stored = db.prepare('SELECT name, current_title, years_experience FROM candidates WHERE id = ?')
    .get(candidate.id) as { name: string; current_title: string; years_experience: string } | undefined;

  return NextResponse.json({
    candidate_id: candidate.id,
    application_id: appId,
    name: stored?.name || name,
    email,
    existing: isExisting,
    current_title: stored?.current_title || (extractedContact as { current_title?: string })?.current_title || '',
    key_skills: (extractedContact as { key_skills?: string })?.key_skills || '',
    years_experience: stored?.years_experience || (extractedContact as { years_experience?: string })?.years_experience || '',
  }, { status: 201 });
}
