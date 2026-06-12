import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

interface CvTemplate {
  id: string; name: string; primary_color: string; secondary_color: string;
  accent_color: string; font_style: string; logo_base64: string; logo_width: number; logo_height: number; company_name: string;
  show_photo: number; anonymize_name: number; anonymize_contact: number; sections: string;
}

interface Candidate {
  id: string; name: string; email: string; phone: string; linkedin: string;
  cv_text: string; current_title: string; years_experience: string;
}

interface StructuredCV {
  name: string; title: string; email: string; phone: string; linkedin: string;
  summary: string;
  experience: { company: string; role: string; period: string; bullets: string[]; tech_stack?: string }[];
  skills: string[];
  education: { school: string; degree: string; year: string; details?: string }[];
  languages: { language: string; level: string }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawLogo(doc: any, logo_base64: string, x: number, y: number, maxW: number, maxH: number): number {
  if (!logo_base64) return 0;
  try {
    const match = logo_base64.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) return 0;
    const imgBuffer = Buffer.from(match[2], 'base64');
    doc.image(imgBuffer, x, y, { fit: [maxW, maxH] });
    return maxH + 4;
  } catch { return 0; }
}

const BULLET = '•'; // U+2022 BULLET — safe in Helvetica WinAnsi (▸ is not)
const PAGE_H = 841.89;
const PAGE_BOTTOM_MARGIN = 40;

// Render bullet list + optional tech stack with automatic page-break support.
// onPageBreak() is called when a new page is needed; it should draw bg/chrome and return the new starting y.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderBullets(
  doc: any,
  ex: StructuredCV['experience'][0],
  x: number, startY: number, width: number,
  bodyColor: [number,number,number], accentColor: [number,number,number],
  onPageBreak: () => number = () => 30
): number {
  let my = startY;
  const bullets: string[] = (ex.bullets && ex.bullets.length)
    ? ex.bullets
    : ((ex as unknown as { description?: string }).description ? [(ex as unknown as { description: string }).description] : []);

  for (const bullet of bullets) {
    if (!bullet.trim()) continue;
    const lineH = doc.heightOfString(bullet.trim(), { width: width - 10, lineGap: 1.5 }) + 6;
    if (my + lineH > PAGE_H - PAGE_BOTTOM_MARGIN) {
      doc.addPage();
      my = onPageBreak();
    }
    // Circle bullet — vector, does NOT advance doc.y
    doc.circle(x + 2.5, my + 5, 1.5).fill(accentColor);
    // Reset doc.y = my before text so PDFKit never sees y going backward
    doc.y = my;
    doc.fontSize(8.5).fillColor(bodyColor).font('Helvetica')
      .text(bullet.trim(), x + 10, my, { width: width - 10, lineGap: 1.5 });
    // Track actual cursor position so next bullet never goes "backward"
    my = doc.y + 1;
  }
  if (ex.tech_stack) {
    if (my + 20 > PAGE_H - PAGE_BOTTOM_MARGIN) { doc.addPage(); my = onPageBreak(); }
    my += 2;
    doc.y = my;
    doc.fontSize(7.5).fillColor('#94a3b8').font('Helvetica-Bold').text('Stack : ', x, my, { continued: true });
    doc.fontSize(7.5).fillColor('#94a3b8').font('Helvetica').text(ex.tech_stack, { width: width - 50 });
    // Use actual cursor — stack text can wrap to 2 lines on long stacks
    my = doc.y + 2;
  }
  return my - startY;
}

function hexToRgb(hex: string): [number, number, number] {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [30, 64, 175];
}

function lighten(hex: string, pct = 0.85): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  return [Math.round(r + (255 - r) * pct), Math.round(g + (255 - g) * pct), Math.round(b + (255 - b) * pct)];
}

async function extractStructuredCV(candidate: Candidate, template: CvTemplate): Promise<StructuredCV> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const fallback: StructuredCV = {
    name: template.anonymize_name ? 'Candidat' : candidate.name,
    title: candidate.current_title || '',
    email: template.anonymize_contact ? '' : candidate.email,
    phone: template.anonymize_contact ? '' : (candidate.phone || ''),
    linkedin: template.anonymize_contact ? '' : (candidate.linkedin || ''),
    summary: '', experience: [], skills: [], education: [], languages: [],
  };
  if (!apiKey || !candidate.cv_text) return fallback;
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: `Extrais FIDÈLEMENT toutes les informations de ce CV sans résumer ni paraphraser.
IMPORTANT : pour chaque expérience, conserve INTÉGRALEMENT chaque point de liste (bullet) tel qu'il est écrit dans le CV original. Ne fusionne pas, ne résume pas, ne reformule pas les bullets.
Réponds UNIQUEMENT avec ce JSON valide (sans markdown, sans commentaire) :
{"name":"Prénom Nom","title":"Poste actuel","email":"email","phone":"téléphone","linkedin":"url linkedin ou vide","summary":"Profil tel qu'écrit dans le CV","experience":[{"company":"Entreprise","role":"Poste","period":"Jan 2020 – Juil 2025","bullets":["Point 1 complet tel qu'écrit","Point 2 complet tel qu'écrit"],"tech_stack":"Tech stack si mentionné sinon vide"}],"skills":["Compétence 1","Compétence 2"],"education":[{"school":"École","degree":"Diplôme","year":"2020","details":"Mention, grade, détails si présents sinon vide"}],"languages":[{"language":"Français","level":"Natif"}]}

CV :
${candidate.cv_text.slice(0, 12000)}` }],
    });
    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '{}';
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()) as StructuredCV;
    // Fill in gaps from candidate record if Claude didn't extract them
    if (!parsed.name) parsed.name = candidate.name;
    if (!parsed.title && candidate.current_title) parsed.title = candidate.current_title;
    if (!parsed.email && candidate.email) parsed.email = candidate.email;
    if (!parsed.phone && candidate.phone) parsed.phone = candidate.phone;
    if (!parsed.linkedin && candidate.linkedin) parsed.linkedin = candidate.linkedin;
    if (template.anonymize_name) parsed.name = 'Candidat';
    if (template.anonymize_contact) { parsed.email = ''; parsed.phone = ''; parsed.linkedin = ''; }
    return parsed;
  } catch { return fallback; }
}

// ═══════════════════════════════════════════════════════════
// LAYOUT 1 — SIDEBAR PRO
// Colored sidebar left (1/3), white content right (2/3)
// Avatar circle, skills as bullet list in sidebar
// ═══════════════════════════════════════════════════════════
async function layoutSidebarPro(cv: StructuredCV, t: CvTemplate): Promise<Buffer> {
  const PDFDoc = (await import('pdfkit')).default;
  const [pr, pg, pb] = hexToRgb(t.primary_color);
  const [lr, lg, lb] = lighten(t.primary_color, 0.82);
  const sections = JSON.parse(t.sections) as string[];

  return new Promise((resolve, reject) => {
    const doc = new PDFDoc({ margin: 0, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 595.28, H = PAGE_H, SW = 195, MX = SW + 22, MW = W - MX - 22;

    // Sidebar bg
    doc.rect(0, 0, SW, H).fill([pr, pg, pb]);

    // Logo (top of sidebar)
    let sy = 14;
    if (t.logo_base64) {
      const lh = drawLogo(doc, t.logo_base64, (SW - 80) / 2, sy, 80, 30);
      sy += lh + 4;
    }

    // Avatar circle
    const cx = SW / 2;
    const avatarY = sy + 12;
    doc.circle(cx, avatarY, 38).fill('white');
    doc.fontSize(28).fillColor([pr, pg, pb]).font('Helvetica-Bold')
      .text((cv.name || 'C').charAt(0).toUpperCase(), cx - 16, avatarY - 16);

    sy = avatarY + 44;
    // Name + title in sidebar
    doc.fontSize(12).fillColor('white').font('Helvetica-Bold')
      .text(cv.name, 10, sy, { width: SW - 20, align: 'center' });
    sy += 17;
    if (cv.title) {
      doc.fontSize(8).fillColor([lr, lg, lb]).font('Helvetica')
        .text(cv.title, 10, sy, { width: SW - 20, align: 'center' });
      sy += 14;
    }
    if (t.company_name) {
      doc.fontSize(7.5).fillColor([lr, lg, lb]).font('Helvetica-Bold')
        .text('pour ' + t.company_name, 10, sy, { width: SW - 20, align: 'center' });
      sy += 12;
    }
    sy += 10;

    const sideSection = (label: string) => {
      doc.fontSize(8.5).fillColor('white').font('Helvetica-Bold').text(label, 14, sy);
      sy += 12;
      doc.moveTo(14, sy).lineTo(SW - 14, sy).lineWidth(0.5).stroke([lr, lg, lb]);
      sy += 7;
    };

    // Contact
    const contacts = [
      cv.email && { icon: '✉', v: cv.email },
      cv.phone && { icon: '✆', v: cv.phone },
      cv.linkedin && { icon: 'in', v: cv.linkedin.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//i, '') },
    ].filter(Boolean) as { icon: string; v: string }[];
    if (contacts.length) {
      sideSection('CONTACT');
      for (const c of contacts) {
        doc.fontSize(7).fillColor([lr, lg, lb]).font('Helvetica-Bold').text(c.icon, 14, sy);
        doc.y = sy;
        doc.fillColor('white').font('Helvetica').text(c.v, 30, sy, { width: SW - 38, ellipsis: true });
        sy += 13;
      }
      sy += 4;
    }

    // Skills
    if (sections.includes('skills') && cv.skills.length) {
      sideSection('COMPÉTENCES');
      for (const sk of cv.skills.slice(0, 14)) {
        doc.fontSize(7.5).fillColor('white').font('Helvetica').text(BULLET + '  ' + sk, 14, sy, { width: SW - 28 });
        sy += 12;
        if (sy > H - 50) break;
      }
      sy += 4;
    }

    // Languages
    if (sections.includes('languages') && cv.languages.length && sy + 50 < H - 20) {
      sideSection('LANGUES');
      for (const l of cv.languages) {
        doc.fontSize(7.5).fillColor('white').font('Helvetica').text(l.language, 14, sy);
        doc.y = sy;
        doc.fillColor([lr, lg, lb]).font('Helvetica-Bold').text(l.level, 14, sy, { width: SW - 28, align: 'right' });
        sy += 12;
      }
    }

    // ─── Main area ───
    let my = 28;

    // Name header
    doc.fontSize(24).fillColor([pr, pg, pb]).font('Helvetica-Bold').text(cv.name, MX, my, { width: MW });
    my += 30;
    if (cv.title) {
      doc.fontSize(11).fillColor('#475569').font('Helvetica').text(cv.title, MX, my, { width: MW });
      my += 16;
    }
    doc.rect(MX, my, MW, 2).fill([pr, pg, pb]);
    my += 10;

    // Page break helper — redraws sidebar bg and returns new main-area y
    const newPage = () => {
      doc.addPage();
      doc.rect(0, 0, SW, H).fill([pr, pg, pb]);
      return 28;
    };
    const checkMain = (needed = 60) => { if (my + needed > H - PAGE_BOTTOM_MARGIN) { my = newPage(); } };

    const mainSection = (label: string) => {
      checkMain(30);
      doc.fontSize(9.5).fillColor([pr, pg, pb]).font('Helvetica-Bold').text(label, MX, my);
      my += 13;
      doc.rect(MX, my, 28, 1.5).fill([pr, pg, pb]);
      my += 7;
    };

    if (sections.includes('summary') && cv.summary) {
      mainSection('PROFIL');
      const sh = doc.heightOfString(cv.summary, { width: MW }) + 14;
      checkMain(sh);
      doc.fontSize(9).fillColor('#374151').font('Helvetica').text(cv.summary, MX, my, { width: MW, lineGap: 2 });
      my += sh;
    }

    if (sections.includes('experience') && cv.experience.length) {
      mainSection('EXPÉRIENCES PROFESSIONNELLES');
      for (const ex of cv.experience) {
        checkMain(50);
        doc.rect(MX, my, 3, 28).fill([pr, pg, pb]);
        doc.fontSize(9.5).fillColor('#111827').font('Helvetica-Bold').text(ex.role, MX + 9, my, { width: MW - 70 });
        doc.y = my;
        doc.fontSize(8).fillColor('#6b7280').font('Helvetica').text(ex.period, MX + 9, my, { width: MW - 9, align: 'right' });
        my += 13;
        doc.fontSize(8.5).fillColor([pr, pg, pb]).font('Helvetica-Bold').text(ex.company, MX + 9, my);
        my += 12;
        my += renderBullets(doc, ex, MX + 9, my, MW - 9, [55, 65, 81], [pr, pg, pb], newPage);
        my += 6;
        doc.y = my;
      }
      my += 4;
    }

    if (sections.includes('education') && cv.education.length) {
      mainSection('FORMATION');
      for (const edu of cv.education) {
        checkMain(45);
        doc.fontSize(9.5).fillColor('#111827').font('Helvetica-Bold').text(edu.degree, MX, my, { width: MW - 60 });
        doc.y = my;
        doc.fontSize(8).fillColor('#6b7280').font('Helvetica').text(edu.year, MX, my, { width: MW, align: 'right' });
        my += 13;
        doc.fontSize(8.5).fillColor([pr, pg, pb]).font('Helvetica').text(edu.school, MX, my);
        my += 12;
        if (edu.details) {
          doc.fontSize(7.5).fillColor('#6b7280').font('Helvetica').text(edu.details, MX, my, { width: MW, lineGap: 1 });
          my += doc.heightOfString(edu.details, { width: MW }) + 4;
        } else { my += 6; }
      }
    }

    doc.end();
  });
}

// ═══════════════════════════════════════════════════════════
// LAYOUT 2 — EXECUTIVE BANNER
// Full-width colored header band, single column body,
// section titles with colored left bar accent
// ═══════════════════════════════════════════════════════════
async function layoutExecutive(cv: StructuredCV, t: CvTemplate): Promise<Buffer> {
  const PDFDoc = (await import('pdfkit')).default;
  const [pr, pg, pb] = hexToRgb(t.primary_color);
  const [lr, lg, lb] = lighten(t.primary_color, 0.9);
  const sections = JSON.parse(t.sections) as string[];

  return new Promise((resolve, reject) => {
    const doc = new PDFDoc({ margin: 0, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 595.28, H = 841.89, MX = 45, MW = W - MX * 2;
    const HEADER_H = 140;

    // ─── Full-width header ───
    doc.rect(0, 0, W, HEADER_H).fill([pr, pg, pb]);

    // Diagonal accent shape (bottom-right corner decoration)
    doc.polygon([W - 120, HEADER_H], [W, HEADER_H - 60], [W, HEADER_H])
      .fill([Math.max(0, pr - 30), Math.max(0, pg - 30), Math.max(0, pb - 30)]);

    // Logo + company name top-right
    if (t.logo_base64) {
      drawLogo(doc, t.logo_base64, W - MX - 80, 14, 80, 28);
    }
    if (t.company_name) {
      doc.fontSize(8).fillColor([lr, lg, lb]).font('Helvetica-Bold')
        .text(t.company_name.toUpperCase(), MX, t.logo_base64 ? 46 : 18, { width: MW, align: 'right' });
    }

    // Candidate name
    doc.fontSize(28).fillColor('white').font('Helvetica-Bold').text(cv.name, MX, 38, { width: t.logo_base64 ? MW - 100 : MW });
    let hY = 72;
    if (cv.title) {
      doc.fontSize(12).fillColor([lr, lg, lb]).font('Helvetica').text(cv.title, MX, hY, { width: MW });
      hY += 18;
    }

    // Contact line in header
    const parts = [cv.email, cv.phone, cv.linkedin ? 'linkedin.com/in/' + cv.linkedin.replace(/.*\/in\//i, '') : ''].filter(Boolean);
    if (parts.length) {
      doc.fontSize(8).fillColor([lr, lg, lb]).font('Helvetica').text(parts.join('   ·   '), MX, hY, { width: MW });
    }

    // ─── Body ───
    let my = HEADER_H + 22;

    const newPageExec = () => { doc.addPage(); return HEADER_H + 22; };
    const checkExec = (needed = 60) => { if (my + needed > PAGE_H - PAGE_BOTTOM_MARGIN) { my = newPageExec(); } };

    const mainSection = (label: string) => {
      checkExec(30);
      // Left color bar + label
      doc.rect(MX, my, 4, 12).fill([pr, pg, pb]);
      doc.fontSize(10).fillColor([pr, pg, pb]).font('Helvetica-Bold').text(label, MX + 10, my);
      my += 14;
      doc.moveTo(MX, my).lineTo(W - MX, my).lineWidth(0.4).stroke('#e2e8f0');
      my += 7;
    };

    if (sections.includes('summary') && cv.summary) {
      mainSection('PROFIL PROFESSIONNEL');
      // Light background box
      const sh = doc.heightOfString(cv.summary, { width: MW, lineGap: 2 }) + 14;
      checkExec(sh);
      doc.rect(MX, my, MW, sh).fill([lr, lg, lb]);
      doc.fontSize(9).fillColor('#1e293b').font('Helvetica').text(cv.summary, MX + 10, my + 7, { width: MW - 20, lineGap: 2 });
      my += sh + 14;
    }

    if (sections.includes('experience') && cv.experience.length) {
      mainSection('EXPÉRIENCES');
      for (const ex of cv.experience) {
        checkExec(50);
        // Timeline dot
        doc.circle(MX + 2, my + 5, 4).fill([pr, pg, pb]);
        if (cv.experience.indexOf(ex) < cv.experience.length - 1) {
          doc.moveTo(MX + 2, my + 9).lineTo(MX + 2, my + 44).lineWidth(1).stroke('#cbd5e1');
        }
        doc.fontSize(10).fillColor('#0f172a').font('Helvetica-Bold').text(ex.role, MX + 14, my, { width: MW - 90 });
        doc.y = my;
        doc.fontSize(8.5).fillColor('#64748b').font('Helvetica').text(ex.period, MX + 14, my, { width: MW - 14, align: 'right' });
        my += 14;
        doc.fontSize(9).fillColor([pr, pg, pb]).font('Helvetica-Bold').text(ex.company, MX + 14, my);
        my += 12;
        my += renderBullets(doc, ex, MX + 14, my, MW - 14, [71, 85, 105], [pr, pg, pb], newPageExec);
        my += 6;
        doc.y = my;
      }
      my += 4;
    }

    // Skills in 2-column grid
    if (sections.includes('skills') && cv.skills.length) {
      mainSection('COMPÉTENCES');
      const colW = (MW - 10) / 2;
      const skillRows = Math.ceil(Math.min(cv.skills.length, 12) / 2);
      checkExec(skillRows * 16 + 10);
      for (let i = 0; i < Math.min(cv.skills.length, 12); i++) {
        const x = MX + (i % 2) * (colW + 10);
        const y = my + Math.floor(i / 2) * 16;
        doc.rect(x, y + 2, 5, 5).fill([pr, pg, pb]);
        doc.fontSize(8.5).fillColor('#1e293b').font('Helvetica').text(cv.skills[i], x + 10, y, { width: colW - 12 });
      }
      my += skillRows * 16 + 10;
    }

    if (sections.includes('education') && cv.education.length) {
      mainSection('FORMATION');
      for (const edu of cv.education) {
        checkExec(45);
        doc.fontSize(9.5).fillColor('#0f172a').font('Helvetica-Bold').text(edu.degree, MX + 10, my, { width: MW - 70 });
        doc.y = my;
        doc.fontSize(8.5).fillColor('#64748b').font('Helvetica').text(edu.year, MX + 10, my, { width: MW - 10, align: 'right' });
        my += 13;
        doc.fontSize(8.5).fillColor([pr, pg, pb]).font('Helvetica').text(edu.school, MX + 10, my);
        my += 12;
        if (edu.details) {
          doc.fontSize(7.5).fillColor('#64748b').font('Helvetica').text(edu.details, MX + 10, my, { width: MW - 10, lineGap: 1 });
          my += doc.heightOfString(edu.details, { width: MW - 10 }) + 4;
        } else { my += 6; }
      }
    }

    if (sections.includes('languages') && cv.languages.length) {
      mainSection('LANGUES');
      checkExec(30);
      const lw = MW / Math.min(cv.languages.length, 4);
      for (let i = 0; i < cv.languages.length; i++) {
        const lx = MX + i * lw;
        doc.rect(lx, my, lw - 8, 26).fill([lr, lg, lb]);
        doc.fontSize(8.5).fillColor('#0f172a').font('Helvetica-Bold').text(cv.languages[i].language, lx + 5, my + 4, { width: lw - 16 });
        doc.fontSize(7.5).fillColor([pr, pg, pb]).font('Helvetica').text(cv.languages[i].level, lx + 5, my + 14, { width: lw - 16 });
      }
    }

    doc.end();
  });
}

// ═══════════════════════════════════════════════════════════
// LAYOUT 3 — MINIMALISTE
// Pure white, single column, no decorations
// Name underlined with a thin colored rule, clean typography
// Skills as inline pill tags, ATS-friendly
// ═══════════════════════════════════════════════════════════
async function layoutMinimal(cv: StructuredCV, t: CvTemplate): Promise<Buffer> {
  const PDFDoc = (await import('pdfkit')).default;
  const [pr, pg, pb] = hexToRgb(t.primary_color);
  const sections = JSON.parse(t.sections) as string[];

  return new Promise((resolve, reject) => {
    const doc = new PDFDoc({ margin: 0, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 595.28, H = 841.89, MX = 50, MW = W - MX * 2;

    // ─── Header ───
    let my = 45;

    // Logo top-right
    if (t.logo_base64) {
      drawLogo(doc, t.logo_base64, W - MX - 90, my, 90, 36);
    }
    if (t.company_name) {
      doc.fontSize(8).fillColor('#94a3b8').font('Helvetica').text(t.company_name, MX, my, { width: t.logo_base64 ? MW - 100 : MW, align: 'right' });
      my += 14;
    } else if (t.logo_base64) {
      my += 40;
    }

    doc.fontSize(26).fillColor('#0f172a').font('Helvetica-Bold').text(cv.name, MX, my);
    my += 32;
    // Thin colored rule under name
    doc.rect(MX, my - 6, 60, 2.5).fill([pr, pg, pb]);

    if (cv.title) {
      doc.fontSize(11).fillColor('#475569').font('Helvetica').text(cv.title, MX, my + 2, { width: MW });
      my += 18;
    }

    // Contact inline
    const parts = [cv.email, cv.phone, cv.linkedin ? cv.linkedin.replace(/https?:\/\/(www\.)?/i, '') : ''].filter(Boolean);
    if (parts.length) {
      doc.fontSize(8.5).fillColor('#64748b').font('Helvetica').text(parts.join('   ·   '), MX, my, { width: MW });
      my += 14;
    }

    // Full-width separator
    my += 6;
    doc.moveTo(MX, my).lineTo(W - MX, my).lineWidth(0.3).stroke('#cbd5e1');
    my += 14;

    const secTitle = (label: string) => {
      doc.fontSize(8).fillColor([pr, pg, pb]).font('Helvetica-Bold')
        .text(label.toUpperCase(), MX, my, { characterSpacing: 1.5 });
      my += 13;
      doc.moveTo(MX, my).lineTo(W - MX, my).lineWidth(0.3).stroke('#e2e8f0');
      my += 8;
    };

    const newPageMin = () => { doc.addPage(); return 45; };
    const checkMin = (needed = 60) => { if (my + needed > PAGE_H - PAGE_BOTTOM_MARGIN) { my = newPageMin(); } };

    if (sections.includes('summary') && cv.summary) {
      secTitle('Profil');
      const sh = doc.heightOfString(cv.summary, { width: MW }) + 16;
      checkMin(sh);
      doc.fontSize(9).fillColor('#334155').font('Helvetica').text(cv.summary, MX, my, { width: MW, lineGap: 2 });
      my += sh;
    }

    if (sections.includes('experience') && cv.experience.length) {
      secTitle('Expériences');
      for (const ex of cv.experience) {
        checkMin(50);
        doc.fontSize(10).fillColor('#0f172a').font('Helvetica-Bold').text(ex.role, MX, my, { width: MW - 90 });
        doc.y = my;
        doc.fontSize(8.5).fillColor('#94a3b8').font('Helvetica').text(ex.period, MX, my, { width: MW, align: 'right' });
        my += 14;
        doc.fontSize(8.5).fillColor([pr, pg, pb]).font('Helvetica-Bold').text(ex.company, MX, my);
        my += 12;
        my += renderBullets(doc, ex, MX, my, MW, [71, 85, 105], [pr, pg, pb], newPageMin);
        my += 6;
        doc.y = my; // sync cursor after renderBullets (may have changed pages)
      }
      my += 4;
    }

    // Skills as pill tags
    if (sections.includes('skills') && cv.skills.length) {
      secTitle('Compétences');
      checkMin(30);
      let sx = MX;
      const pillH = 16, pillPad = 8, gap = 6;
      doc.fontSize(8);
      for (const sk of cv.skills.slice(0, 16)) {
        const tw = doc.widthOfString(sk) + pillPad * 2;
        if (sx + tw > W - MX && sx > MX) { sx = MX; my += pillH + gap; checkMin(pillH + gap); }
        doc.rect(sx, my, tw, pillH).stroke([pr, pg, pb]);
        doc.y = my + 4;
        doc.fontSize(8).fillColor([pr, pg, pb]).font('Helvetica').text(sk, sx + pillPad, my + 4, { width: tw - pillPad, lineBreak: false });
        sx += tw + gap;
      }
      my += pillH + 14;
    }

    if (sections.includes('education') && cv.education.length) {
      secTitle('Formation');
      for (const edu of cv.education) {
        checkMin(45);
        doc.fontSize(9.5).fillColor('#0f172a').font('Helvetica-Bold').text(edu.degree, MX, my, { width: MW - 60 });
        doc.y = my;
        doc.fontSize(8.5).fillColor('#94a3b8').font('Helvetica').text(edu.year, MX, my, { width: MW, align: 'right' });
        my += 13;
        doc.fontSize(8.5).fillColor('#475569').font('Helvetica').text(edu.school, MX, my);
        my += 12;
        if (edu.details) {
          doc.fontSize(7.5).fillColor('#94a3b8').font('Helvetica').text(edu.details, MX, my, { width: MW, lineGap: 1 });
          my += doc.heightOfString(edu.details, { width: MW }) + 4;
        } else { my += 6; }
      }
    }

    if (sections.includes('languages') && cv.languages.length) {
      secTitle('Langues');
      checkMin(20);
      doc.fontSize(8.5).fillColor('#334155').font('Helvetica')
        .text(cv.languages.map(l => `${l.language} — ${l.level}`).join('    '), MX, my, { width: MW });
    }

    doc.end();
  });
}

// ═══════════════════════════════════════════════════════════
// LAYOUT 4 — DOUBLE COLONNE ÉLÉGANT
// Narrow left column (labels/dates) | Wide right column (content)
// Top header band with name centered, elegant thin lines
// ═══════════════════════════════════════════════════════════
async function layoutElegant(cv: StructuredCV, t: CvTemplate): Promise<Buffer> {
  const PDFDoc = (await import('pdfkit')).default;
  const [pr, pg, pb] = hexToRgb(t.primary_color);
  const [lr, lg, lb] = lighten(t.primary_color, 0.93);
  const sections = JSON.parse(t.sections) as string[];

  return new Promise((resolve, reject) => {
    const doc = new PDFDoc({ margin: 0, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 595.28, H = 841.89;
    const HEADER_H = 110;
    const LC = 50, LW = 120;  // left label column
    const RC = 185, RW = 370; // right content column

    // ─── Header: full-width light bg ───
    doc.rect(0, 0, W, HEADER_H).fill([lr, lg, lb]);
    // Left accent border
    doc.rect(0, 0, 5, HEADER_H).fill([pr, pg, pb]);

    // Logo centered at top
    let headerY = 16;
    if (t.logo_base64) {
      drawLogo(doc, t.logo_base64, (W - 90) / 2, headerY, 90, 32);
      headerY += 38;
    }

    // Name centered
    doc.fontSize(26).fillColor([pr, pg, pb]).font('Helvetica-Bold')
      .text(cv.name, 20, headerY, { width: W - 40, align: 'center' });
    if (cv.title) {
      doc.fontSize(10).fillColor('#475569').font('Helvetica')
        .text(cv.title, 20, headerY + 31, { width: W - 40, align: 'center' });
    }
    // Contact line
    const parts = [cv.email, cv.phone, cv.linkedin ? cv.linkedin.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//i, 'li/') : ''].filter(Boolean);
    if (parts.length) {
      doc.fontSize(8).fillColor('#64748b').font('Helvetica')
        .text(parts.join('   ·   '), 20, headerY + 49, { width: W - 40, align: 'center' });
    }
    if (t.company_name) {
      doc.fontSize(7.5).fillColor([pr, pg, pb]).font('Helvetica-Bold')
        .text('présenté par ' + t.company_name, 20, headerY + 67, { width: W - 40, align: 'center' });
    }

    let my = HEADER_H + 20;

    const newPageEleg = () => { doc.addPage(); return HEADER_H + 20; };
    const checkEleg = (needed = 60) => { if (my + needed > PAGE_H - PAGE_BOTTOM_MARGIN) { my = newPageEleg(); } };

    const addRow = (label: string, drawContent: () => number) => {
      checkEleg(40);
      const startY = my;
      // Label column
      doc.fontSize(7.5).fillColor([pr, pg, pb]).font('Helvetica-Bold')
        .text(label.toUpperCase(), LC, my, { width: LW, align: 'right', characterSpacing: 0.8 });
      // Vertical separator
      doc.moveTo(RC - 14, startY - 2).lineTo(RC - 14, startY + 40).lineWidth(0.5).stroke('#e2e8f0');
      // Content
      doc.y = my;
      const contentHeight = drawContent();
      // Horizontal rule after row
      my = Math.max(my, startY + contentHeight) + 10;
      doc.moveTo(LC, my).lineTo(W - LC, my).lineWidth(0.3).stroke('#f1f5f9');
      my += 8;
    };

    if (sections.includes('summary') && cv.summary) {
      addRow('Profil', () => {
        doc.fontSize(9).fillColor('#334155').font('Helvetica').text(cv.summary, RC, my, { width: RW, lineGap: 2 });
        const h = doc.heightOfString(cv.summary, { width: RW });
        my += h;
        return h;
      });
    }

    if (sections.includes('experience') && cv.experience.length) {
      for (const ex of cv.experience) {
        addRow(ex.period, () => {
          const startMy = my;
          doc.fontSize(10).fillColor('#0f172a').font('Helvetica-Bold').text(ex.role, RC, my, { width: RW });
          my += 14;
          doc.fontSize(8.5).fillColor([pr, pg, pb]).font('Helvetica-Bold').text(ex.company, RC, my);
          my += 12;
          my += renderBullets(doc, ex, RC, my, RW, [71, 85, 105], [pr, pg, pb], newPageEleg);
          doc.y = my;
          return my - startMy;
        });
      }
    }

    if (sections.includes('skills') && cv.skills.length) {
      addRow('Compétences', () => {
        const startMy = my;
        let sx = RC;
        doc.fontSize(8.5);
        for (const sk of cv.skills.slice(0, 14)) {
          const tw = doc.widthOfString(sk) + 14;
          if (sx + tw > W - LC) { sx = RC; my += 17; checkEleg(17); }
          doc.rect(sx, my, tw, 15).fill([lr, lg, lb]);
          doc.fontSize(8.5).fillColor([pr, pg, pb]).font('Helvetica-Bold').text(sk, sx + 7, my + 3.5, { lineBreak: false });
          sx += tw + 6;
        }
        my += 16;
        return my - startMy;
      });
    }

    if (sections.includes('education') && cv.education.length) {
      for (const edu of cv.education) {
        addRow(edu.year, () => {
          const startMy = my;
          doc.fontSize(9.5).fillColor('#0f172a').font('Helvetica-Bold').text(edu.degree, RC, my, { width: RW });
          my += 13;
          doc.fontSize(8.5).fillColor('#475569').font('Helvetica').text(edu.school, RC, my);
          my += 12;
          if (edu.details) {
            doc.fontSize(7.5).fillColor('#94a3b8').font('Helvetica').text(edu.details, RC, my, { width: RW, lineGap: 1 });
            my += doc.heightOfString(edu.details, { width: RW }) + 4;
          }
          return my - startMy;
        });
      }
    }

    if (sections.includes('languages') && cv.languages.length) {
      addRow('Langues', () => {
        const startMy = my;
        for (const l of cv.languages) {
          doc.fontSize(8.5).fillColor('#0f172a').font('Helvetica-Bold').text(l.language, RC, my);
          doc.fillColor('#64748b').font('Helvetica').text(l.level, RC + 80, my);
          my += 13;
        }
        return my - startMy;
      });
    }

    doc.end();
  });
}

async function generatePDF(cv: StructuredCV, template: CvTemplate): Promise<Buffer> {
  switch (template.font_style) {
    case 'executive': return layoutExecutive(cv, template);
    case 'minimal':   return layoutMinimal(cv, template);
    case 'elegant':   return layoutElegant(cv, template);
    default:          return layoutSidebarPro(cv, template); // 'modern'
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { candidate_id, format } = await req.json() as { candidate_id: string; format: 'pdf' | 'docx' };
  const db = getDb();

  const template = db.prepare('SELECT * FROM cv_templates WHERE id=?').get(id) as CvTemplate | undefined;
  if (!template) return NextResponse.json({ error: 'Template introuvable' }, { status: 404 });

  const candidate = db.prepare('SELECT * FROM candidates WHERE id=?').get(candidate_id) as Candidate | undefined;
  if (!candidate) return NextResponse.json({ error: 'Candidat introuvable' }, { status: 404 });

  const cv = await extractStructuredCV(candidate, template);

  if (format === 'docx') {
    const { Document, Paragraph, TextRun, AlignmentType, Packer, BorderStyle, ImageRun, TabStopPosition, TabStopType } = await import('docx');
    type DocxParagraph = InstanceType<typeof Paragraph>;
    const primaryHex = template.primary_color.replace('#', '');
    const sections2 = JSON.parse(template.sections) as string[];
    const children: DocxParagraph[] = [];

    const addHeading = (text: string) => {
      children.push(new Paragraph({
        children: [new TextRun({ text, bold: true, color: primaryHex, size: 22, font: 'Calibri' })],
        spacing: { before: 240, after: 60 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: primaryHex } },
      }));
    };

    // Name + logo on the same line: name left, logo right
    {
      const nameRun = new TextRun({ text: cv.name, bold: true, size: 40, color: primaryHex, font: 'Calibri' });
      const nameChildren: InstanceType<typeof TextRun | typeof ImageRun>[] = [nameRun];

      if (template.logo_base64) {
        try {
          const match = template.logo_base64.match(/^data:image\/(\w+);base64,(.+)$/);
          if (match) {
            const imgType = match[1].toLowerCase();
            const imgBuffer = Buffer.from(match[2], 'base64');
            const docxImgType = imgType === 'jpg' || imgType === 'jpeg' ? 'jpg' : imgType === 'gif' ? 'gif' : imgType === 'bmp' ? 'bmp' : 'png';
            nameChildren.push(new TextRun({ text: '\t', font: 'Calibri' }));
            nameChildren.push(new ImageRun({ data: imgBuffer, transformation: { width: template.logo_width || 130, height: template.logo_height || 46 }, type: docxImgType }));
          }
        } catch { /* skip logo on error */ }
      }

      children.push(new Paragraph({
        children: nameChildren,
        tabStops: template.logo_base64 ? [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }] : [],
        spacing: { after: 60 },
      }));
    }
    if (cv.title) children.push(new Paragraph({
      children: [new TextRun({ text: cv.title, size: 24, color: '475569', font: 'Calibri' })],
      spacing: { after: 80 },
    }));
    const contactParts = [cv.email, cv.phone, cv.linkedin].filter(Boolean);
    if (contactParts.length) children.push(new Paragraph({
      children: [new TextRun({ text: contactParts.join('   ·   '), size: 18, color: '64748b', font: 'Calibri' })],
      spacing: { after: 200 },
    }));

    if (sections2.includes('summary') && cv.summary) {
      addHeading('PROFIL');
      children.push(new Paragraph({ children: [new TextRun({ text: cv.summary, size: 20, font: 'Calibri', color: '334155' })], spacing: { after: 160 } }));
    }
    if (sections2.includes('experience') && cv.experience.length) {
      addHeading('EXPÉRIENCES');
      for (const ex of cv.experience) {
        children.push(new Paragraph({ children: [new TextRun({ text: ex.role, bold: true, size: 22, font: 'Calibri' }), new TextRun({ text: `   ${ex.period}`, size: 18, color: '94a3b8', font: 'Calibri' })], spacing: { before: 140 } }));
        children.push(new Paragraph({ children: [new TextRun({ text: ex.company, color: primaryHex, size: 20, bold: true, font: 'Calibri' })], spacing: { after: 60 } }));
        // Bullets
        const bullets2 = (ex.bullets && ex.bullets.length)
          ? ex.bullets
          : ((ex as unknown as { description?: string }).description ? [(ex as unknown as { description: string }).description] : []);
        for (const b of bullets2) {
          if (b.trim()) children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: b.trim(), size: 19, font: 'Calibri', color: '334155' })], spacing: { after: 40 } }));
        }
        if (ex.tech_stack) children.push(new Paragraph({ children: [new TextRun({ text: 'Stack : ', bold: true, size: 17, font: 'Calibri', color: '94a3b8' }), new TextRun({ text: ex.tech_stack, size: 17, font: 'Calibri', color: '94a3b8' })], spacing: { after: 80 } }));
      }
    }
    if (sections2.includes('skills') && cv.skills.length) {
      addHeading('COMPÉTENCES');
      children.push(new Paragraph({ children: [new TextRun({ text: cv.skills.join('   ·   '), size: 20, font: 'Calibri' })], spacing: { after: 100 } }));
    }
    if (sections2.includes('education') && cv.education.length) {
      addHeading('FORMATION');
      for (const edu of cv.education) {
        children.push(new Paragraph({ children: [new TextRun({ text: edu.degree, bold: true, size: 21, font: 'Calibri' }), new TextRun({ text: `   ${edu.year}`, size: 18, color: '94a3b8', font: 'Calibri' })] }));
        children.push(new Paragraph({ children: [new TextRun({ text: edu.school, color: primaryHex, size: 19, font: 'Calibri' })] }));
        if (edu.details) children.push(new Paragraph({ children: [new TextRun({ text: edu.details, size: 17, font: 'Calibri', color: '64748b' })], spacing: { after: 80 } }));
        else children.push(new Paragraph({ children: [], spacing: { after: 60 } }));
      }
    }
    if (sections2.includes('languages') && cv.languages.length) {
      addHeading('LANGUES');
      children.push(new Paragraph({ children: [new TextRun({ text: cv.languages.map(l => `${l.language} (${l.level})`).join('   ·   '), size: 20, font: 'Calibri' })], spacing: { after: 100 } }));
    }

    const docxDoc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(docxDoc);
    const safeName = cv.name.replace(/[^a-z0-9]/gi, '_');
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="CV_${safeName}_${template.name}.docx"`,
      },
    });
  }

  const pdfBuffer = await generatePDF(cv, template);
  const safeName = cv.name.replace(/[^a-z0-9]/gi, '_');
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="CV_${safeName}_${template.name}.pdf"`,
    },
  });
}
