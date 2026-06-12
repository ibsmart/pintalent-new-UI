'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface CvTemplate {
  id: string;
  name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_style: string;
  company_name: string;
  anonymize_name: number;
  anonymize_contact: number;
  sections: string;
  logo_base64: string;
  created_at: string;
}

const SECTION_LABELS: Record<string, string> = {
  summary: 'Résumé',
  experience: 'Expériences',
  skills: 'Compétences',
  education: 'Formation',
  languages: 'Langues',
};

const STYLE_LABELS: Record<string, string> = {
  modern: 'Sidebar Pro',
  executive: 'Executive',
  minimal: 'Minimaliste',
  elegant: 'Élégant',
};

export default function CvTemplatesPage() {
  const [templates, setTemplates] = useState<CvTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTemplates(); }, []);

  async function loadTemplates() {
    setLoading(true);
    const res = await fetch('/api/cv-templates');
    if (res.ok) setTemplates(await res.json());
    setLoading(false);
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Supprimer ce template ?')) return;
    await fetch(`/api/cv-templates/${id}`, { method: 'DELETE' });
    loadTemplates();
  }

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates CV</h1>
          <p className="text-gray-500 text-sm mt-1">Créez des modèles de CV personnalisés aux couleurs de vos clients</p>
        </div>
        <Link href="/hr/cv-templates/new"
          className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
          + Nouveau template
        </Link>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-gray-100">
          <div className="text-6xl mb-4">📄</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun template</h3>
          <p className="text-gray-500 text-sm mb-6">Créez votre premier template de CV personnalisé</p>
          <Link href="/hr/cv-templates/new"
            className="inline-block bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-800 transition-colors">
            Créer un template
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.map(t => {
            const sections = JSON.parse(t.sections) as string[];
            return (
              <div key={t.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all group">
                {/* Color strip */}
                <div className="h-2.5" style={{ background: t.primary_color }} />
                <div className="p-5">
                  {/* Logo + name */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {t.logo_base64 ? (
                        <div className="w-10 h-10 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0 p-1">
                          <img src={t.logo_base64} alt="logo" className="max-w-full max-h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
                          style={{ background: t.primary_color }}>
                          {(t.company_name || t.name).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm leading-tight">{t.name}</h3>
                        {t.company_name && <p className="text-xs text-gray-500 mt-0.5">{t.company_name}</p>}
                      </div>
                    </div>
                    {/* Color dots */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-3.5 h-3.5 rounded-full border border-white shadow-sm" style={{ background: t.primary_color }} title="Principale" />
                      <div className="w-3.5 h-3.5 rounded-full border border-white shadow-sm" style={{ background: t.secondary_color }} title="Secondaire" />
                      <div className="w-3.5 h-3.5 rounded-full border border-white shadow-sm" style={{ background: t.accent_color }} title="Accent" />
                    </div>
                  </div>

                  {/* Style badge */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-medium px-2.5 py-1 rounded-lg" style={{ background: t.primary_color + '18', color: t.primary_color }}>
                      {STYLE_LABELS[t.font_style] || t.font_style}
                    </span>
                    {t.anonymize_name === 1 && <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-lg">Anon. nom</span>}
                    {t.anonymize_contact === 1 && <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-lg">Anon. contact</span>}
                  </div>

                  {/* Sections */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {sections.map(s => (
                      <span key={s} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{SECTION_LABELS[s] || s}</span>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString('fr-FR')}</span>
                    <div className="flex items-center gap-1">
                      <Link href={`/hr/cv-templates/${t.id}/edit`}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
                        Modifier
                      </Link>
                      <button onClick={() => deleteTemplate(t.id)}
                        className="text-xs text-emerald-500 hover:text-emerald-700 font-medium px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors">
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
