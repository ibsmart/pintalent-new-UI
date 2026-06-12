'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Settings = Record<string, string>;

const TABS = [
  { id: 'template', label: 'Template', icon: '🖼' },
  { id: 'identity', label: 'Identité', icon: '🎨' },
  { id: 'hero', label: 'Hero', icon: '✏️' },
  { id: 'stats', label: 'Statistiques', icon: '📊' },
  { id: 'about', label: 'À propos', icon: '🏢' },
  { id: 'contact', label: 'Contact & Footer', icon: '📬' },
  { id: 'seo', label: 'SEO', icon: '🔍' },
];

const TEMPLATES = [
  {
    id: 'classic',
    label: 'Classique',
    desc: 'Hero gradient coloré, grille de cards, section statistiques.',
    preview: (color: string) => (
      <div className="rounded-xl overflow-hidden border border-gray-200 text-[8px]">
        <div className="h-12 flex items-center justify-center text-white font-bold text-xs" style={{ background: `linear-gradient(135deg, ${color}, #000)` }}>HERO</div>
        <div className="bg-gray-50 p-2 grid grid-cols-3 gap-1">
          {[1,2,3].map(i => <div key={i} className="bg-white rounded h-8 border border-gray-100" />)}
        </div>
      </div>
    ),
  },
  {
    id: 'modern',
    label: 'Moderne',
    desc: 'Layout sombre et audacieux, liste des offres numérotée, stats en cards.',
    preview: (color: string) => (
      <div className="rounded-xl overflow-hidden border border-gray-200 text-[8px]">
        <div className="bg-gray-950 h-16 flex items-end p-2 gap-2">
          <div className="flex-1 h-8 rounded" style={{ backgroundColor: `${color}30` }} />
          <div className="grid grid-cols-2 gap-1 w-16">
            {[1,2,3,4].map(i => <div key={i} className="h-3 bg-gray-800 rounded" />)}
          </div>
        </div>
        <div className="bg-white p-2 space-y-1">
          {[1,2,3].map(i => <div key={i} className="h-5 bg-gray-50 rounded border border-gray-100 flex items-center px-2"><div className="w-4 h-2 rounded bg-gray-200" /></div>)}
        </div>
      </div>
    ),
  },
  {
    id: 'minimal',
    label: 'Minimal',
    desc: 'Design épuré et élégant, typographie légère, liste simple des offres.',
    preview: (color: string) => (
      <div className="rounded-xl overflow-hidden border border-gray-200">
        <div className="bg-white p-3 text-center border-b border-gray-100">
          <div className="w-6 h-0.5 mx-auto mb-1 rounded" style={{ backgroundColor: color }} />
          <div className="h-4 bg-gray-100 rounded w-3/4 mx-auto" />
          <div className="h-2 bg-gray-50 rounded w-1/2 mx-auto mt-1" />
        </div>
        <div className="bg-white p-2 space-y-1.5">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex items-center gap-2 py-0.5 border-b border-gray-50">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: `${color}15` }} />
              <div className="flex-1 h-2 bg-gray-100 rounded" />
              <div className="w-6 h-2 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('identity');

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => { setSettings(data); setLoading(false); });
  }, []);

  const set = (key: string, value: string) =>
    setSettings(s => ({ ...s, [key]: value }));

  async function handleSave() {
    setSaving(true);
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full" />
    </div>
  );

  const primaryColor = settings.primary_color || '#b91c1c';

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Personnalisation de la page carrière</h1>
          <p className="text-gray-500 text-sm mt-1">Modifiez l&apos;apparence et le contenu de votre page publique</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/" target="_blank"
            className="border border-gray-200 bg-white text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2">
            🌐 Voir la page
          </Link>
          <button onClick={handleSave} disabled={saving}
            className="bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-emerald-800 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm">
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enregistrement...</>
            ) : saved ? '✓ Enregistré !' : '💾 Enregistrer'}
          </button>
        </div>
      </div>

      {/* Live preview strip */}
      <div className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="text-xs text-gray-400 bg-gray-50 px-4 py-2 border-b border-gray-100 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400"></span> Aperçu en temps réel
        </div>
        <div className="p-6 text-white rounded-b-2xl flex items-center gap-6" style={{ backgroundColor: primaryColor }}>
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center font-bold text-lg flex-shrink-0">
            {settings.logo_url
              ? <img src={settings.logo_url} alt="logo" className="w-10 h-10 object-contain rounded" />
              : settings.logo_initials || 'GF'}
          </div>
          <div>
            <div className="font-bold text-lg">{settings.company_name || 'GEEKFACT'}</div>
            <div className="opacity-80 text-sm mt-0.5">{settings.hero_title || 'Titre du hero'}</div>
          </div>
          <div className="ml-auto flex gap-3">
            <div className="bg-white/20 rounded-lg px-4 py-2 text-sm font-medium">{settings.cta_primary || 'Voir les offres'}</div>
            <div className="bg-white/10 border border-white/30 rounded-lg px-4 py-2 text-sm">{settings.cta_secondary || 'En savoir plus'}</div>
          </div>
        </div>
      </div>

      {/* Tabs + Content */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-emerald-700 text-emerald-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">

          {/* ---- TEMPLATE ---- */}
          {activeTab === 'template' && (
            <div className="space-y-6">
              <p className="text-sm text-gray-500">Choisissez la mise en page de votre page carrière. La couleur et le contenu restent les mêmes quel que soit le template.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {TEMPLATES.map(tpl => {
                  const active = (settings.template || 'classic') === tpl.id;
                  return (
                    <button key={tpl.id} onClick={() => set('template', tpl.id)}
                      className={`text-left rounded-2xl border-2 p-4 transition-all ${active ? 'border-emerald-700 bg-emerald-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                      <div className="mb-3">{tpl.preview(primaryColor)}</div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-900 text-sm">{tpl.label}</span>
                        {active && <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Actif</span>}
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{tpl.desc}</p>
                    </button>
                  );
                })}
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700">
                💡 N&apos;oubliez pas de cliquer sur <strong>Enregistrer</strong> puis d&apos;ouvrir la page publique pour voir le résultat.
              </div>
            </div>
          )}

          {/* ---- IDENTITÉ ---- */}
          {activeTab === 'identity' && (
            <div className="space-y-6 max-w-2xl">
              <Field label="Nom de l'entreprise" required>
                <input value={settings.company_name || ''} onChange={e => set('company_name', e.target.value)}
                  className={inputCls} placeholder="GEEKFACT" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Initiales du logo" hint="Affichées si pas de logo URL">
                  <input value={settings.logo_initials || ''} onChange={e => set('logo_initials', e.target.value)}
                    className={inputCls} placeholder="GF" maxLength={3} />
                </Field>
                <Field label="Couleur principale">
                  <div className="flex items-center gap-3">
                    <input type="color" value={settings.primary_color || '#b91c1c'}
                      onChange={e => set('primary_color', e.target.value)}
                      className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer p-1" />
                    <input value={settings.primary_color || '#b91c1c'} onChange={e => set('primary_color', e.target.value)}
                      className={inputCls + ' flex-1'} placeholder="#b91c1c" />
                  </div>
                </Field>
              </div>
              <Field label="URL du logo" hint="Lien vers une image (PNG, SVG). Laissez vide pour utiliser les initiales.">
                <input value={settings.logo_url || ''} onChange={e => set('logo_url', e.target.value)}
                  className={inputCls} placeholder="https://..." />
              </Field>
            </div>
          )}

          {/* ---- HERO ---- */}
          {activeTab === 'hero' && (
            <div className="space-y-6 max-w-2xl">
              <Field label="Titre principal" required>
                <input value={settings.hero_title || ''} onChange={e => set('hero_title', e.target.value)}
                  className={inputCls} placeholder="Façonnez l'avenir..." />
              </Field>
              <Field label="Sous-titre">
                <textarea value={settings.hero_subtitle || ''} onChange={e => set('hero_subtitle', e.target.value)}
                  rows={3} className={textareaCls} />
              </Field>
              <Field label="Texte du badge" hint="Le badge avec le nombre de postes ouverts">
                <input value={settings.hero_badge || ''} onChange={e => set('hero_badge', e.target.value)}
                  className={inputCls} placeholder="postes ouverts au recrutement" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Bouton principal (CTA)">
                  <input value={settings.cta_primary || ''} onChange={e => set('cta_primary', e.target.value)}
                    className={inputCls} placeholder="Voir les offres →" />
                </Field>
                <Field label="Bouton secondaire">
                  <input value={settings.cta_secondary || ''} onChange={e => set('cta_secondary', e.target.value)}
                    className={inputCls} placeholder="Découvrir GF" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Titre section offres">
                  <input value={settings.jobs_section_title || ''} onChange={e => set('jobs_section_title', e.target.value)}
                    className={inputCls} />
                </Field>
                <Field label="Sous-titre section offres">
                  <input value={settings.jobs_section_subtitle || ''} onChange={e => set('jobs_section_subtitle', e.target.value)}
                    className={inputCls} />
                </Field>
              </div>
            </div>
          )}

          {/* ---- STATS ---- */}
          {activeTab === 'stats' && (
            <div className="space-y-4 max-w-2xl">
              <p className="text-sm text-gray-500">Chiffres clés affichés dans la bande sous le hero.</p>
              {[1, 2, 3, 4].map(n => (
                <div key={n} className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
                  <Field label={`Valeur ${n}`}>
                    <input value={settings[`stat${n}_value`] || ''} onChange={e => set(`stat${n}_value`, e.target.value)}
                      className={inputCls} placeholder="20+" />
                  </Field>
                  <Field label={`Label ${n}`}>
                    <input value={settings[`stat${n}_label`] || ''} onChange={e => set(`stat${n}_label`, e.target.value)}
                      className={inputCls} placeholder="Pays de présence" />
                  </Field>
                </div>
              ))}
            </div>
          )}

          {/* ---- À PROPOS ---- */}
          {activeTab === 'about' && (
            <div className="space-y-6 max-w-2xl">
              <Field label="Titre de la section">
                <input value={settings.about_title || ''} onChange={e => set('about_title', e.target.value)}
                  className={inputCls} placeholder="Pourquoi nous rejoindre ?" />
              </Field>
              <p className="text-sm text-gray-500">4 valeurs/atouts affichés dans la section À propos.</p>
              {[1, 2, 3, 4].map(n => (
                <div key={n} className="p-4 bg-gray-50 rounded-xl space-y-3 border border-gray-100">
                  <div className="grid grid-cols-4 gap-3">
                    <Field label="Icône (emoji)">
                      <input value={settings[`value${n}_icon`] || ''} onChange={e => set(`value${n}_icon`, e.target.value)}
                        className={inputCls + ' text-center text-xl'} maxLength={2} />
                    </Field>
                    <div className="col-span-3">
                      <Field label="Titre">
                        <input value={settings[`value${n}_title`] || ''} onChange={e => set(`value${n}_title`, e.target.value)}
                          className={inputCls} />
                      </Field>
                    </div>
                  </div>
                  <Field label="Description">
                    <textarea value={settings[`value${n}_desc`] || ''} onChange={e => set(`value${n}_desc`, e.target.value)}
                      rows={2} className={textareaCls} />
                  </Field>
                </div>
              ))}
            </div>
          )}

          {/* ---- CONTACT & FOOTER ---- */}
          {activeTab === 'contact' && (
            <div className="space-y-6 max-w-2xl">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Email de recrutement">
                  <input type="email" value={settings.contact_email || ''} onChange={e => set('contact_email', e.target.value)}
                    className={inputCls} placeholder="recrutement@entreprise.com" />
                </Field>
                <Field label="Téléphone" hint="Optionnel">
                  <input type="tel" value={settings.contact_phone || ''} onChange={e => set('contact_phone', e.target.value)}
                    className={inputCls} placeholder="+212 5xx xx xx xx" />
                </Field>
                <Field label="URL LinkedIn" hint="Optionnel">
                  <input type="url" value={settings.linkedin_url || ''} onChange={e => set('linkedin_url', e.target.value)}
                    className={inputCls} placeholder="https://linkedin.com/company/..." />
                </Field>
                <Field label="Site web" hint="Optionnel">
                  <input type="url" value={settings.website_url || ''} onChange={e => set('website_url', e.target.value)}
                    className={inputCls} placeholder="https://www.entreprise.com" />
                </Field>
              </div>
              <Field label="Texte copyright (footer)">
                <input value={settings.footer_copyright || ''} onChange={e => set('footer_copyright', e.target.value)}
                  className={inputCls} placeholder="© 2024 GEEKFACT Group. Tous droits réservés." />
              </Field>
            </div>
          )}

          {/* ---- SEO ---- */}
          {activeTab === 'seo' && (
            <div className="space-y-6 max-w-2xl">
              <Field label="Titre de la page (onglet navigateur)" hint="Recommandé : 50-60 caractères">
                <input value={settings.meta_title || ''} onChange={e => set('meta_title', e.target.value)}
                  className={inputCls} placeholder="Carrières - GEEKFACT" />
                <div className="text-xs text-gray-400 mt-1">{(settings.meta_title || '').length} / 60</div>
              </Field>
              <Field label="Description meta" hint="Recommandé : 150-160 caractères">
                <textarea value={settings.meta_description || ''} onChange={e => set('meta_description', e.target.value)}
                  rows={3} className={textareaCls} />
                <div className="text-xs text-gray-400 mt-1">{(settings.meta_description || '').length} / 160</div>
              </Field>
              {/* Preview Google */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <div className="text-xs text-gray-400 mb-3">Aperçu résultat Google</div>
                <div className="text-blue-700 text-lg font-medium truncate">{settings.meta_title || 'Carrières - GEEKFACT'}</div>
                <div className="text-green-700 text-sm truncate">{typeof window !== 'undefined' ? window.location.origin : 'https://votre-site.com'}</div>
                <div className="text-gray-600 text-sm mt-1 line-clamp-2">{settings.meta_description || 'Description de votre page carrière...'}</div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Bottom save */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="bg-emerald-700 text-white px-8 py-3 rounded-xl font-medium hover:bg-emerald-800 disabled:opacity-50 transition-colors text-sm">
          {saving ? 'Enregistrement...' : saved ? '✓ Modifications enregistrées !' : '💾 Enregistrer les modifications'}
        </button>
      </div>
    </div>
  );
}

// ---- Helpers ----
const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white';
const textareaCls = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white resize-none';

function Field({ label, children, hint, required }: { label: string; children: React.ReactNode; hint?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-emerald-500">*</span>}
        {hint && <span className="ml-1 text-gray-400 font-normal text-xs">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}
