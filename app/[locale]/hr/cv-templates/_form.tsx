'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────
export type FontStyle = 'modern' | 'executive' | 'minimal' | 'elegant';

export const ALL_SECTIONS = ['summary', 'experience', 'skills', 'education', 'languages'];
export const SECTION_LABELS: Record<string, { label: string; icon: string }> = {
  summary:    { label: 'Résumé / Profil',  icon: '👤' },
  experience: { label: 'Expériences',      icon: '💼' },
  skills:     { label: 'Compétences',      icon: '⚡' },
  education:  { label: 'Formation',        icon: '🎓' },
  languages:  { label: 'Langues',          icon: '🌐' },
};

const COLOR_PALETTES = [
  { name: 'Océan',     primary: '#1e40af', secondary: '#eff6ff', accent: '#3b82f6' },
  { name: 'Émeraude',  primary: '#065f46', secondary: '#ecfdf5', accent: '#10b981' },
  { name: 'Ardoise',   primary: '#1e293b', secondary: '#f8fafc', accent: '#475569' },
  { name: 'Bordeaux',  primary: '#7f1d1d', secondary: '#fff5f5', accent: '#ef4444' },
  { name: 'Violet',    primary: '#4c1d95', secondary: '#f5f3ff', accent: '#7c3aed' },
  { name: 'Charbon',   primary: '#111827', secondary: '#f9fafb', accent: '#374151' },
];

const FAKE_CV = {
  name: 'Sophie Martin',
  title: 'Chef de Projet Digital',
  email: 'sophie.martin@email.com',
  phone: '+33 6 12 34 56 78',
  summary: 'Professionnelle expérimentée en gestion de projets digitaux avec 8 ans d\'expérience dans la transformation numérique des grandes entreprises.',
  experience: [
    { role: 'Chef de Projet Senior', company: 'BNP Paribas', period: '2020 – 2024' },
    { role: 'Consultant Digital', company: 'Capgemini', period: '2016 – 2020' },
  ],
  skills: ['Agile / Scrum', 'Power BI', 'SQL', 'Gestion de projet', 'UX Design'],
  education: [{ degree: 'Master Management Digital', school: 'HEC Paris', year: '2016' }],
  languages: [{ language: 'Français', level: 'Natif' }, { language: 'Anglais', level: 'Courant' }],
};

export interface FormState {
  name: string;
  company_name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_style: FontStyle;
  logo_base64: string;
  logo_width: number;
  logo_height: number;
  sections: string[];
  anonymize_name: boolean;
  anonymize_contact: boolean;
}

export const DEFAULT_FORM: FormState = {
  name: '',
  company_name: '',
  primary_color: '#1e40af',
  secondary_color: '#eff6ff',
  accent_color: '#3b82f6',
  font_style: 'modern',
  logo_base64: '',
  logo_width: 130,
  logo_height: 46,
  sections: ['summary', 'experience', 'skills', 'education', 'languages'],
  anonymize_name: false,
  anonymize_contact: false,
};

// ─── Color Picker ─────────────────────────────────────────────────────
function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 rounded-xl p-2 hover:border-gray-300 transition-colors">
        <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-white shadow cursor-pointer flex-shrink-0" style={{ background: value }}>
          <input type="color" value={value} onChange={e => onChange(e.target.value)}
            className="absolute opacity-0 cursor-pointer" style={{ width: '200%', height: '200%', top: '-50%', left: '-50%' }} />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[10px] text-gray-400 leading-none mb-1">{label}</span>
          <input type="text" value={value.toUpperCase()}
            onChange={e => { const v = e.target.value; if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v); }}
            className="text-sm font-mono font-bold text-gray-800 bg-transparent border-none outline-none w-full"
            maxLength={7} placeholder="#000000" />
        </div>
      </div>
    </div>
  );
}

// ─── Live Preview ──────────────────────────────────────────────────────
export function MiniPreview({ form, scale = 1 }: { form: FormState; scale?: number }) {
  const cv = {
    name: form.anonymize_name ? 'Candidat' : FAKE_CV.name,
    title: FAKE_CV.title,
    email: form.anonymize_contact ? '' : FAKE_CV.email,
    phone: form.anonymize_contact ? '' : FAKE_CV.phone,
  };
  const pc = form.primary_color;
  const lightBg = pc + '18';
  const fs = (n: number) => n * scale;

  if (form.font_style === 'executive') return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', fontSize: fs(10), border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', width: '100%' }}>
      <div style={{ background: pc, padding: `${fs(16)}px ${fs(18)}px` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: fs(18), letterSpacing: -0.3 }}>{cv.name}</div>
            <div style={{ color: 'white', opacity: 0.75, fontSize: fs(9), marginTop: fs(2) }}>{cv.title}</div>
            {cv.email && <div style={{ color: 'white', opacity: 0.55, fontSize: fs(7.5), marginTop: fs(6) }}>{cv.email}  ·  {cv.phone}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            {form.logo_base64 && <img src={form.logo_base64} alt="logo" style={{ height: fs(28), maxWidth: fs(80), objectFit: 'contain', marginBottom: fs(4) }} />}
            {form.company_name && <div style={{ color: 'white', opacity: 0.6, fontSize: fs(7), fontWeight: 700 }}>{form.company_name.toUpperCase()}</div>}
          </div>
        </div>
      </div>
      <div style={{ padding: `${fs(14)}px ${fs(18)}px`, background: 'white' }}>
        {form.sections.includes('summary') && <div style={{ marginBottom: fs(12) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: fs(6), marginBottom: fs(5) }}>
            <div style={{ width: fs(4), height: fs(12), background: pc, borderRadius: 2 }} />
            <span style={{ fontSize: fs(8), fontWeight: 700, color: pc, letterSpacing: 1 }}>PROFIL</span>
          </div>
          <div style={{ background: lightBg, padding: `${fs(6)}px ${fs(8)}px`, borderRadius: 4, fontSize: fs(7.5), color: '#334155' }}>{FAKE_CV.summary.slice(0, 110)}…</div>
        </div>}
        {form.sections.includes('experience') && <div style={{ marginBottom: fs(10) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: fs(6), marginBottom: fs(5) }}>
            <div style={{ width: fs(4), height: fs(12), background: pc, borderRadius: 2 }} />
            <span style={{ fontSize: fs(8), fontWeight: 700, color: pc, letterSpacing: 1 }}>EXPÉRIENCES</span>
          </div>
          {FAKE_CV.experience.map((ex, i) => (
            <div key={i} style={{ display: 'flex', gap: fs(8), marginBottom: fs(6), alignItems: 'flex-start' }}>
              <div style={{ width: fs(7), height: fs(7), borderRadius: '50%', background: pc, marginTop: fs(2), flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: fs(8), fontWeight: 700 }}>{ex.role} <span style={{ color: '#94a3b8', fontWeight: 400 }}>{ex.period}</span></div>
                <div style={{ fontSize: fs(7.5), color: pc }}>{ex.company}</div>
              </div>
            </div>
          ))}
        </div>}
        {form.sections.includes('skills') && <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: fs(6), marginBottom: fs(5) }}>
            <div style={{ width: fs(4), height: fs(12), background: pc, borderRadius: 2 }} />
            <span style={{ fontSize: fs(8), fontWeight: 700, color: pc, letterSpacing: 1 }}>COMPÉTENCES</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: fs(4) }}>
            {FAKE_CV.skills.map(s => <div key={s} style={{ fontSize: fs(7), padding: `${fs(2)}px ${fs(7)}px`, background: lightBg, color: pc, fontWeight: 600, borderRadius: 3 }}>{s}</div>)}
          </div>
        </div>}
      </div>
    </div>
  );

  if (form.font_style === 'minimal') return (
    <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: fs(10), border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', padding: `${fs(20)}px ${fs(22)}px`, background: 'white', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: fs(8) }}>
        <div>
          <div style={{ fontSize: fs(20), fontWeight: 700, color: '#0f172a', letterSpacing: -0.5 }}>{cv.name}</div>
          <div style={{ width: fs(44), height: fs(2.5), background: pc, margin: `${fs(4)}px 0 ${fs(6)}px` }} />
          {cv.title && <div style={{ fontSize: fs(9.5), color: '#475569', marginBottom: fs(4) }}>{cv.title}</div>}
          {cv.email && <div style={{ fontSize: fs(7.5), color: '#94a3b8' }}>{cv.email}  ·  {cv.phone}</div>}
        </div>
        {form.logo_base64 && <img src={form.logo_base64} alt="logo" style={{ height: fs(36), maxWidth: fs(100), objectFit: 'contain' }} />}
      </div>
      {form.company_name && <div style={{ fontSize: fs(7), color: '#94a3b8', marginBottom: fs(8) }}>{form.company_name}</div>}
      <div style={{ borderTop: `1px solid #f1f5f9`, marginBottom: fs(10) }} />
      {form.sections.includes('summary') && <div style={{ marginBottom: fs(10) }}>
        <div style={{ fontSize: fs(7.5), fontWeight: 700, color: pc, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: fs(4) }}>Profil</div>
        <div style={{ fontSize: fs(7.5), color: '#475569' }}>{FAKE_CV.summary.slice(0, 90)}…</div>
      </div>}
      {form.sections.includes('experience') && <div style={{ marginBottom: fs(10) }}>
        <div style={{ fontSize: fs(7.5), fontWeight: 700, color: pc, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: fs(4) }}>Expériences</div>
        {FAKE_CV.experience.map((ex, i) => <div key={i} style={{ marginBottom: fs(5) }}>
          <div style={{ fontSize: fs(8.5), fontWeight: 700 }}>{ex.role} <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: fs(7.5) }}>{ex.period}</span></div>
          <div style={{ fontSize: fs(7.5), color: pc }}>{ex.company}</div>
        </div>)}
      </div>}
      {form.sections.includes('skills') && <div>
        <div style={{ fontSize: fs(7.5), fontWeight: 700, color: pc, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: fs(5) }}>Compétences</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: fs(4) }}>
          {FAKE_CV.skills.map(s => <div key={s} style={{ border: `1px solid ${pc}`, color: pc, fontSize: fs(7), padding: `${fs(2)}px ${fs(7)}px`, borderRadius: 10 }}>{s}</div>)}
        </div>
      </div>}
    </div>
  );

  if (form.font_style === 'elegant') return (
    <div style={{ fontFamily: 'Georgia, serif', fontSize: fs(10), border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', width: '100%' }}>
      <div style={{ background: lightBg, borderLeft: `${fs(5)}px solid ${pc}`, padding: `${fs(14)}px ${fs(18)}px`, textAlign: 'center' }}>
        {form.logo_base64 && <img src={form.logo_base64} alt="logo" style={{ height: fs(30), maxWidth: fs(100), objectFit: 'contain', marginBottom: fs(6), display: 'block', margin: `0 auto ${fs(6)}px` }} />}
        <div style={{ fontSize: fs(18), fontWeight: 700, color: pc }}>{cv.name}</div>
        {cv.title && <div style={{ fontSize: fs(9), color: '#475569', marginTop: fs(3) }}>{cv.title}</div>}
        {cv.email && <div style={{ fontSize: fs(7.5), color: '#94a3b8', marginTop: fs(4) }}>{cv.email}  ·  {cv.phone}</div>}
        {form.company_name && <div style={{ fontSize: fs(7), color: pc, fontWeight: 700, marginTop: fs(3) }}>présenté par {form.company_name}</div>}
      </div>
      <div style={{ background: 'white', padding: `${fs(12)}px 0` }}>
        {[
          { label: 'Profil', section: 'summary', content: () => <div style={{ fontSize: fs(7.5), color: '#475569' }}>{FAKE_CV.summary.slice(0, 80)}…</div> },
          { label: '2020–2024', section: 'experience', content: () => <div>
            <div style={{ fontSize: fs(8.5), fontWeight: 700 }}>{FAKE_CV.experience[0].role}</div>
            <div style={{ fontSize: fs(7.5), color: pc }}>{FAKE_CV.experience[0].company}</div>
          </div> },
          { label: 'Compétences', section: 'skills', content: () => <div style={{ display: 'flex', flexWrap: 'wrap', gap: fs(3) }}>
            {FAKE_CV.skills.map(s => <div key={s} style={{ background: lightBg, color: pc, fontSize: fs(7), padding: `${fs(2)}px ${fs(6)}px`, borderRadius: 3, fontWeight: 600 }}>{s}</div>)}
          </div> },
        ].filter(r => form.sections.includes(r.section)).map((row, i) => (
          <div key={i} style={{ display: 'flex', borderBottom: '1px solid #f8fafc', padding: `${fs(7)}px 0` }}>
            <div style={{ width: fs(90), paddingLeft: fs(14), paddingRight: fs(8), fontSize: fs(7.5), fontWeight: 700, color: pc, textAlign: 'right', flexShrink: 0 }}>{row.label.toUpperCase()}</div>
            <div style={{ width: 1, background: '#e2e8f0', margin: `0 ${fs(12)}px` }} />
            <div style={{ flex: 1, paddingRight: fs(14) }}>{row.content()}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // Sidebar Pro (modern)
  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', fontSize: fs(10), lineHeight: 1.4, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', width: '100%', display: 'flex' }}>
      <div style={{ width: fs(120), background: pc, color: 'white', padding: `${fs(14)}px ${fs(10)}px`, flexShrink: 0 }}>
        {form.logo_base64 && <div style={{ marginBottom: fs(8), textAlign: 'center' }}>
          <img src={form.logo_base64} alt="logo" style={{ maxWidth: fs(80), maxHeight: fs(30), objectFit: 'contain', display: 'inline-block' }} />
        </div>}
        {form.company_name && <div style={{ fontSize: fs(7.5), fontWeight: 700, textAlign: 'center', marginBottom: fs(8), opacity: 0.85 }}>{form.company_name}</div>}
        <div style={{ width: fs(44), height: fs(44), borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: `0 auto ${fs(8)}px`, fontSize: fs(20), fontWeight: 700, color: pc }}>{cv.name.charAt(0)}</div>
        <div style={{ fontSize: fs(9), fontWeight: 700, textAlign: 'center', marginBottom: fs(4) }}>{cv.name}</div>
        <div style={{ fontSize: fs(7.5), textAlign: 'center', color: form.secondary_color, marginBottom: fs(10) }}>{cv.title}</div>
        {form.sections.includes('skills') && <div>
          <div style={{ fontSize: fs(7), fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: fs(3), borderBottom: `1px solid ${form.secondary_color}40`, paddingBottom: fs(2) }}>Compétences</div>
          {FAKE_CV.skills.slice(0, 4).map(s => <div key={s} style={{ fontSize: fs(6.5), marginBottom: fs(2), opacity: 0.9 }}>• {s}</div>)}
        </div>}
      </div>
      <div style={{ flex: 1, padding: `${fs(14)}px ${fs(12)}px`, background: '#ffffff' }}>
        <div style={{ marginBottom: fs(8) }}>
          <div style={{ fontSize: fs(16), fontWeight: 700, color: pc }}>{cv.name}</div>
          <div style={{ fontSize: fs(8.5), color: '#64748b', marginTop: fs(2) }}>{cv.title}</div>
          <div style={{ height: fs(2), background: pc, marginTop: fs(5), borderRadius: 1 }} />
        </div>
        {form.sections.includes('summary') && <div style={{ marginBottom: fs(8) }}>
          <div style={{ fontSize: fs(7.5), fontWeight: 700, color: pc, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: fs(2) }}>Profil</div>
          <div style={{ height: 0.5, background: '#e2e8f0', marginBottom: fs(3) }} />
          <div style={{ fontSize: fs(7), color: '#374151', lineHeight: 1.5 }}>{FAKE_CV.summary.slice(0, 100)}…</div>
        </div>}
        {form.sections.includes('experience') && <div>
          <div style={{ fontSize: fs(7.5), fontWeight: 700, color: pc, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: fs(2) }}>Expériences</div>
          <div style={{ height: 0.5, background: '#e2e8f0', marginBottom: fs(3) }} />
          {FAKE_CV.experience.map(e => <div key={e.role} style={{ marginBottom: fs(5) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: fs(7.5), fontWeight: 700 }}>{e.role}</div>
              <div style={{ fontSize: fs(6.5), color: '#9ca3af' }}>{e.period}</div>
            </div>
            <div style={{ fontSize: fs(7), color: pc, fontWeight: 600 }}>{e.company}</div>
          </div>)}
        </div>}
      </div>
    </div>
  );
}

// ─── Main Form Component ───────────────────────────────────────────────
interface TemplateFormPageProps { editingId?: string; }

export default function TemplateFormPage({ editingId }: TemplateFormPageProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editingId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingId) return;
    fetch(`/api/cv-templates/${editingId}`).then(r => r.json()).then(t => {
      setForm({
        name: t.name, company_name: t.company_name || '',
        primary_color: t.primary_color, secondary_color: t.secondary_color, accent_color: t.accent_color,
        font_style: t.font_style as FontStyle, logo_base64: t.logo_base64 || '',
        logo_width: t.logo_width || 130, logo_height: t.logo_height || 46,
        sections: JSON.parse(t.sections) as string[],
        anonymize_name: t.anonymize_name === 1, anonymize_contact: t.anonymize_contact === 1,
      });
      setLoading(false);
    });
  }, [editingId]);

  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, logo_base64: reader.result as string }));
    reader.readAsDataURL(file);
  }, []);

  const toggleSection = useCallback((s: string) => {
    setForm(f => ({ ...f, sections: f.sections.includes(s) ? f.sections.filter(x => x !== s) : [...f.sections, s] }));
  }, []);

  async function saveTemplate() {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = { ...form, sections: form.sections, show_photo: false };
    if (editingId) {
      await fetch(`/api/cv-templates/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
      await fetch('/api/cv-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    setSaving(false);
    router.push('/hr/cv-templates');
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full" />
    </div>
  );

  const STYLES: { id: FontStyle; label: string; desc: string; preview: React.ReactNode }[] = [
    { id: 'modern',    label: 'Sidebar Pro',  desc: 'Colonne colorée + contenu',
      preview: <div style={{ display: 'flex', height: 48, borderRadius: 4, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
        <div style={{ width: 18, background: form.primary_color }} />
        <div style={{ flex: 1, background: 'white', padding: '4px 5px' }}>
          <div style={{ height: 5, background: form.primary_color, borderRadius: 1, width: '60%', marginBottom: 3 }} />
          <div style={{ height: 3, background: '#e5e7eb', borderRadius: 1, width: '80%', marginBottom: 2 }} />
          <div style={{ height: 3, background: '#e5e7eb', borderRadius: 1, width: '70%', marginBottom: 2 }} />
          <div style={{ height: 3, background: '#e5e7eb', borderRadius: 1, width: '75%' }} />
        </div>
      </div> },
    { id: 'executive', label: 'Executive',    desc: 'Header pleine largeur',
      preview: <div style={{ height: 48, borderRadius: 4, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
        <div style={{ height: 16, background: form.primary_color, padding: '4px 6px' }}>
          <div style={{ height: 4, background: 'white', opacity: 0.6, borderRadius: 1, width: '50%' }} />
        </div>
        <div style={{ background: 'white', padding: '4px 6px' }}>
          <div style={{ height: 3, background: '#e5e7eb', borderRadius: 1, width: '80%', marginBottom: 2 }} />
          <div style={{ height: 3, background: '#e5e7eb', borderRadius: 1, width: '65%', marginBottom: 2 }} />
          <div style={{ height: 3, background: form.primary_color + '40', borderRadius: 1, width: '70%' }} />
        </div>
      </div> },
    { id: 'minimal',   label: 'Minimaliste', desc: 'Épuré, ATS-friendly',
      preview: <div style={{ height: 48, background: 'white', borderRadius: 4, overflow: 'hidden', border: '1px solid #e5e7eb', padding: '6px 7px' }}>
        <div style={{ height: 6, background: '#111827', borderRadius: 1, width: '55%', marginBottom: 3 }} />
        <div style={{ height: 2, background: form.primary_color, borderRadius: 1, width: '25%', marginBottom: 4 }} />
        <div style={{ height: 3, background: '#e5e7eb', borderRadius: 1, width: '80%', marginBottom: 2 }} />
        <div style={{ height: 3, background: '#e5e7eb', borderRadius: 1, width: '60%' }} />
      </div> },
    { id: 'elegant',   label: 'Élégant',     desc: 'Label | contenu, header centré',
      preview: <div style={{ height: 48, borderRadius: 4, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
        <div style={{ height: 18, background: form.primary_color + '18', borderLeft: `3px solid ${form.primary_color}`, padding: '4px 6px', textAlign: 'center' }}>
          <div style={{ height: 4, background: form.primary_color, borderRadius: 1, width: '40%', margin: '0 auto 2px' }} />
          <div style={{ height: 3, background: '#94a3b8', borderRadius: 1, width: '55%', margin: '0 auto' }} />
        </div>
        <div style={{ background: 'white', padding: '4px 0' }}>
          {[70, 60, 75].map((w, i) => (
            <div key={i} style={{ display: 'flex', marginBottom: 2, paddingLeft: 6 }}>
              <div style={{ width: 20, height: 3, background: form.primary_color + '80', borderRadius: 1, marginRight: 5, flexShrink: 0 }} />
              <div style={{ height: 3, background: '#e5e7eb', borderRadius: 1, width: `${w}%` }} />
            </div>
          ))}
        </div>
      </div> },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/hr/cv-templates" className="text-gray-400 hover:text-gray-700 text-sm font-medium transition-colors">
            ← Templates CV
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-900">
            {editingId ? 'Modifier le template' : 'Nouveau template'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/hr/cv-templates" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium rounded-xl hover:bg-gray-100 transition-colors">
            Annuler
          </Link>
          <button onClick={saveTemplate} disabled={saving || !form.name.trim()}
            className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 shadow-sm">
            {saving ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Enregistrement…</> : editingId ? '✓ Mettre à jour' : '✓ Créer le template'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT: Form ── */}
        <div className="w-[560px] flex-shrink-0 overflow-y-auto">
          <div className="p-7 space-y-5">

            {/* 1 — Identité */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2.5">
                <span className="w-6 h-6 bg-emerald-600 text-white rounded-lg flex items-center justify-center text-xs font-bold">1</span>
                <h2 className="text-sm font-bold text-gray-900">Identité</h2>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Nom du template <span className="text-emerald-500">*</span></label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ex : Template BNP, Template Standard…"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-gray-50 hover:bg-white transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Entreprise cliente</label>
                  <input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                    placeholder="Ex : BNP Paribas, Total…"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-gray-50 hover:bg-white transition-colors" />
                </div>
              </div>
            </section>

            {/* 2 — Mise en page */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2.5">
                <span className="w-6 h-6 bg-emerald-600 text-white rounded-lg flex items-center justify-center text-xs font-bold">2</span>
                <h2 className="text-sm font-bold text-gray-900">Mise en page</h2>
              </div>
              <div className="px-6 py-5 grid grid-cols-2 gap-3">
                {STYLES.map(s => (
                  <button key={s.id} type="button" onClick={() => setForm(f => ({ ...f, font_style: s.id }))}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      form.font_style === s.id ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-gray-200 hover:border-gray-300 bg-gray-50 hover:bg-white'
                    }`}>
                    <div className="mb-2.5">{s.preview}</div>
                    <p className={`text-xs font-bold ${form.font_style === s.id ? 'text-emerald-700' : 'text-gray-700'}`}>{s.label}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{s.desc}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* 3 — Logo */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2.5">
                <span className="w-6 h-6 bg-emerald-600 text-white rounded-lg flex items-center justify-center text-xs font-bold">3</span>
                <h2 className="text-sm font-bold text-gray-900">Logo client</h2>
              </div>
              <div className="px-6 py-5">
                {!form.logo_base64 ? (
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-7 hover:border-emerald-300 hover:bg-emerald-50 transition-all group">
                    <span className="text-3xl group-hover:scale-110 transition-transform">🖼️</span>
                    <span className="text-sm font-medium text-gray-500 group-hover:text-emerald-600">Cliquer pour uploader le logo</span>
                    <span className="text-xs text-gray-400">PNG, JPG — fond transparent recommandé</span>
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
                        <div className="w-16 h-12 flex items-center justify-center bg-white rounded-lg border border-gray-100">
                          <img src={form.logo_base64} alt="Logo" className="max-h-10 max-w-14 object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-700">Logo chargé</p>
                          <p className="text-xs text-gray-400 mt-0.5">Apparaît en haut du CV</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button type="button" onClick={() => fileInputRef.current?.click()}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-50 border border-blue-200 transition-colors whitespace-nowrap">
                          ✏️ Changer
                        </button>
                        <button type="button" onClick={() => setForm(f => ({ ...f, logo_base64: '' }))}
                          className="text-xs font-medium text-emerald-500 hover:text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-50 border border-emerald-200 transition-colors whitespace-nowrap">
                          🗑 Supprimer
                        </button>
                      </div>
                    </div>
                    {/* Dimensions */}
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 mb-2.5 uppercase tracking-wide">Dimensions dans le document Word</p>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-xs text-gray-500 w-14">Largeur</span>
                          <input type="number" min={40} max={300} value={form.logo_width}
                            onChange={e => setForm(f => ({ ...f, logo_width: parseInt(e.target.value) || 130 }))}
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-center font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white" />
                          <span className="text-xs text-gray-400">px</span>
                        </div>
                        <span className="text-gray-300 text-lg">×</span>
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-xs text-gray-500 w-14">Hauteur</span>
                          <input type="number" min={20} max={150} value={form.logo_height}
                            onChange={e => setForm(f => ({ ...f, logo_height: parseInt(e.target.value) || 46 }))}
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-center font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white" />
                          <span className="text-xs text-gray-400">px</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>
            </section>

            {/* 4 — Couleurs */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2.5">
                <span className="w-6 h-6 bg-emerald-600 text-white rounded-lg flex items-center justify-center text-xs font-bold">4</span>
                <h2 className="text-sm font-bold text-gray-900">Couleurs</h2>
              </div>
              <div className="px-6 py-5 space-y-5">
                {/* Palettes prédéfinies */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">Palettes prédéfinies</p>
                  <div className="grid grid-cols-3 gap-2">
                    {COLOR_PALETTES.map(p => (
                      <button key={p.name} type="button"
                        onClick={() => setForm(f => ({ ...f, primary_color: p.primary, secondary_color: p.secondary, accent_color: p.accent }))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all hover:shadow-sm ${
                          form.primary_color === p.primary ? 'border-gray-400 bg-gray-50 shadow-sm' : 'border-gray-200 hover:border-gray-300'
                        }`}>
                        <div className="flex gap-0.5 flex-shrink-0">
                          <div className="w-4 h-6 rounded-l-md" style={{ background: p.primary }} />
                          <div className="w-3 h-6" style={{ background: p.accent }} />
                          <div className="w-3 h-6 rounded-r-md" style={{ background: p.secondary }} />
                        </div>
                        <span className="text-xs font-medium text-gray-600">{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pickers manuels */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">Personnaliser</p>
                  <div className="grid grid-cols-3 gap-3">
                    <ColorPicker label="Principale" value={form.primary_color} onChange={v => setForm(f => ({ ...f, primary_color: v }))} />
                    <ColorPicker label="Secondaire" value={form.secondary_color} onChange={v => setForm(f => ({ ...f, secondary_color: v }))} />
                    <ColorPicker label="Accent" value={form.accent_color} onChange={v => setForm(f => ({ ...f, accent_color: v }))} />
                  </div>
                </div>
              </div>
            </section>

            {/* 5 — Sections */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2.5">
                <span className="w-6 h-6 bg-emerald-600 text-white rounded-lg flex items-center justify-center text-xs font-bold">5</span>
                <h2 className="text-sm font-bold text-gray-900">Sections à inclure</h2>
              </div>
              <div className="px-6 py-5">
                <div className="flex flex-wrap gap-2">
                  {ALL_SECTIONS.map(s => {
                    const active = form.sections.includes(s);
                    return (
                      <button key={s} type="button" onClick={() => toggleSection(s)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all ${
                          active
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                        }`}>
                        <span>{SECTION_LABELS[s].icon}</span>
                        <span>{SECTION_LABELS[s].label}</span>
                        {active && <span className="text-emerald-200 text-xs ml-0.5">✓</span>}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-3">{form.sections.length} section{form.sections.length > 1 ? 's' : ''} sélectionnée{form.sections.length > 1 ? 's' : ''}</p>
              </div>
            </section>

            {/* 6 — Anonymisation */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2.5">
                <span className="w-6 h-6 bg-emerald-600 text-white rounded-lg flex items-center justify-center text-xs font-bold">6</span>
                <h2 className="text-sm font-bold text-gray-900">Anonymisation</h2>
              </div>
              <div className="px-6 py-5 space-y-2">
                {[
                  { key: 'anonymize_name' as const, title: 'Anonymiser le nom', desc: 'Remplace le nom par "Candidat"', icon: '👤' },
                  { key: 'anonymize_contact' as const, title: 'Anonymiser les contacts', desc: 'Masque email, téléphone, LinkedIn', icon: '🔒' },
                ].map(({ key, title, desc, icon }) => (
                  <button key={key} type="button" onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${
                      form[key] ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{icon}</span>
                      <div>
                        <p className={`text-sm font-semibold ${form[key] ? 'text-amber-800' : 'text-gray-700'}`}>{title}</p>
                        <p className="text-xs text-gray-400">{desc}</p>
                      </div>
                    </div>
                    <div className={`relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0 ${form[key] ? 'bg-amber-500' : 'bg-gray-300'}`}
                      style={{ height: 22, width: 40 }}>
                      <div className={`absolute top-[3px] w-4 h-4 bg-white rounded-full shadow transition-transform ${form[key] ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <div className="flex justify-end pb-6">
              <button onClick={saveTemplate} disabled={saving || !form.name.trim()}
                className="px-8 py-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
                {saving ? 'Enregistrement…' : editingId ? 'Mettre à jour le template' : 'Créer le template'}
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Preview ── */}
        <div className="flex-1 bg-slate-100 border-l border-gray-200 sticky top-[73px] h-[calc(100vh-73px)] overflow-y-auto">
          <div className="p-7 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-800">Aperçu en direct</h3>
                <p className="text-xs text-gray-400 mt-0.5">Mis à jour à chaque modification</p>
              </div>
              <span className="text-xs bg-white text-gray-500 px-2.5 py-1.5 rounded-lg border border-gray-200 shadow-sm">données fictives</span>
            </div>

            {/* Preview card */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden ring-1 ring-gray-200 flex-1">
              <MiniPreview form={form} scale={1.9} />
            </div>

            {/* Palette summary */}
            <div className="mt-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="grid grid-cols-3 divide-x divide-gray-100">
                {[
                  { label: 'Principale', color: form.primary_color },
                  { label: 'Secondaire', color: form.secondary_color },
                  { label: 'Accent',     color: form.accent_color },
                ].map(({ label, color }) => (
                  <div key={label} className="flex items-center gap-2.5 px-3 py-2.5">
                    <div className="w-8 h-8 rounded-lg flex-shrink-0 shadow-sm border border-white ring-1 ring-gray-200" style={{ background: color }} />
                    <div>
                      <p className="text-[10px] text-gray-400 leading-none">{label}</p>
                      <p className="text-xs font-mono font-bold text-gray-700 mt-0.5 uppercase">{color}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 px-3 py-2 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-base">
                  {({ modern: '▐', executive: '▬', minimal: '—', elegant: '│' } as Record<string, string>)[form.font_style]}
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 leading-none">Mise en page</p>
                  <p className="text-xs font-bold text-gray-700 mt-0.5">{STYLES.find(s => s.id === form.font_style)?.label}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
