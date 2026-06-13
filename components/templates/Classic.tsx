'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Settings, darken } from '@/lib/useSettings';

interface Job {
  id: string; title: string; department: string; location: string;
  contract_type: string; description: string; experience: string;
}

const DEPT_COLORS: Record<string, string> = {
  'Data & BI': 'bg-blue-100 text-blue-800', 'Digital': 'bg-purple-100 text-purple-800',
  'Innovation': 'bg-green-100 text-green-800', 'Risques & Conformité': 'bg-red-100 text-red-800',
  'Finance': 'bg-yellow-100 text-yellow-800', 'default': 'bg-gray-100 text-gray-700',
};
function deptColor(d: string) { return DEPT_COLORS[d] || DEPT_COLORS.default; }

export default function ClassicTemplate({ jobs, filtered, s, search, setSearch, dept, setDept, contract, setContract, loading, DEPARTMENTS }: {
  jobs: Job[]; filtered: Job[]; s: Settings;
  search: string; setSearch: (v: string) => void;
  dept: string; setDept: (v: string) => void;
  contract: string; setContract: (v: string) => void;
  loading: boolean; DEPARTMENTS: string[];
}) {
  const primary = s.primary_color || '#b91c1c';
  const companyName = s.company_name || 'GEEKFACT';
  const logoInitials = s.logo_initials || 'GF';
  const [menuOpen, setMenuOpen] = useState(false);

  const stats = [1,2,3,4].map(n => ({ value: s[`stat${n}_value`], label: s[`stat${n}_label`] })).filter(v => v.value);
  const values = [1,2,3,4].map(n => ({ icon: s[`value${n}_icon`], title: s[`value${n}_title`], desc: s[`value${n}_desc`] })).filter(v => v.title);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3 min-w-0">
            {s.logo_url
              ? <img src={s.logo_url} alt={companyName} className="h-10 w-auto object-contain flex-shrink-0" />
              : <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow flex-shrink-0" style={{ backgroundColor: primary }}><span className="text-white font-bold text-sm">{logoInitials}</span></div>
            }
            <div className="min-w-0">
              <div className="font-bold text-gray-900 text-base leading-tight truncate">{companyName}</div>
              <div className="text-xs text-gray-500">Espace Carrières</div>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="#offres" className="text-sm text-gray-600 hover:text-gray-900 font-medium">Nos offres</a>
            <a href="#about" className="text-sm text-gray-600 hover:text-gray-900 font-medium">À propos</a>
            <Link href="/hr/dashboard" className="text-sm text-white px-4 py-2 rounded-lg font-medium" style={{ backgroundColor: primary }}>Espace RH</Link>
          </nav>

          {/* Mobile hamburger */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden flex flex-col gap-1.5 p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
            <span className={`block w-5 h-0.5 bg-gray-700 transition-transform ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-5 h-0.5 bg-gray-700 transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-gray-700 transition-transform ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 flex flex-col gap-1">
            <a href="#offres" onClick={() => setMenuOpen(false)} className="py-2.5 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg">Nos offres</a>
            <a href="#about" onClick={() => setMenuOpen(false)} className="py-2.5 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg">À propos</a>
            <Link href="/hr/dashboard" onClick={() => setMenuOpen(false)} className="mt-1 py-2.5 px-3 text-sm font-semibold text-white text-center rounded-lg" style={{ backgroundColor: primary }}>Espace RH</Link>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden text-white" style={{ background: `linear-gradient(135deg, ${primary} 0%, ${darken(primary)} 100%)` }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-0 right-20 w-96 h-96 rounded-full bg-white/30 blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-sm mb-5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span>{loading ? '…' : jobs.length} {s.hero_badge || 'postes ouverts'}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold leading-tight mb-4 sm:mb-6">{s.hero_title || `Rejoignez ${companyName}`}</h1>
            <p className="text-base sm:text-lg lg:text-xl opacity-90 mb-6 sm:mb-8 max-w-2xl leading-relaxed">{s.hero_subtitle}</p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <a href="#offres" className="bg-white px-6 py-3.5 rounded-xl font-semibold hover:bg-white/90 transition-colors shadow-lg text-base text-center" style={{ color: primary }}>{s.cta_primary || 'Voir les offres →'}</a>
              {s.cta_secondary && <a href="#about" className="border border-white/30 text-white px-6 py-3.5 rounded-xl font-semibold hover:bg-white/10 transition-colors text-base text-center">{s.cta_secondary}</a>}
            </div>
          </div>
        </div>
        {stats.length > 0 && (
          <div className="relative bg-black/20 border-t border-white/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
              {stats.map(stat => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-white/70 text-sm mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Jobs */}
      <section id="offres" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">{s.jobs_section_title || "Nos offres d'emploi"}</h2>
            <p className="text-gray-600">{s.jobs_section_subtitle}</p>
          </div>
          <Filters s={s} primary={primary} search={search} setSearch={setSearch} dept={dept} setDept={setDept} contract={contract} setContract={setContract} filtered={filtered} DEPARTMENTS={DEPARTMENTS} />
          {loading ? <LoadingSkeleton /> : filtered.length === 0 ? <Empty /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map(job => (
                <Link key={job.id} href={`/jobs/${job.id}`} className="group bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-md hover:border-opacity-50 transition-all flex flex-col" style={{ ['--hover' as string]: primary }}>
                  <div className="flex items-start justify-between mb-4">
                    <span className={`text-xs font-medium px-3 py-1 rounded-full ${deptColor(job.department)}`}>{job.department}</span>
                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">{job.contract_type}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 leading-snug group-hover:opacity-75 transition-opacity">{job.title}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2 mb-4 flex-1">{job.description.slice(0, 120)}…</p>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>📍 {job.location}</span>
                      {job.experience && <span>⏱ {job.experience}</span>}
                    </div>
                    <span className="text-xs font-medium group-hover:translate-x-1 transition-transform" style={{ color: primary }}>Voir →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* About */}
      {values.length > 0 && (
        <section id="about" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-6">{s.about_title || `Pourquoi ${companyName} ?`}</h2>
                <div className="space-y-6">
                  {values.map(item => (
                    <div key={item.title} className="flex gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ backgroundColor: `${primary}18` }}>{item.icon}</div>
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                        <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <RecruitmentProcess primary={primary} />
            </div>
          </div>
        </section>
      )}
      <Footer s={s} primary={primary} companyName={companyName} logoInitials={logoInitials} />
    </div>
  );
}

// ---- Shared sub-components ----

export function Filters({ s, primary, search, setSearch, dept, setDept, contract, setContract, filtered, DEPARTMENTS }: {
  s: Settings; primary: string;
  search: string; setSearch: (v:string)=>void;
  dept: string; setDept: (v:string)=>void;
  contract: string; setContract: (v:string)=>void;
  filtered: Job[]; DEPARTMENTS: string[];
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <input type="text" placeholder="🔍 Rechercher un poste..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0" style={{ ['--tw-ring-color' as string]: primary }} />
        </div>
        <select value={dept} onChange={e => setDept(e.target.value)} className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none">
          <option value="">Tous les départements</option>
          {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
        </select>
        <select value={contract} onChange={e => setContract(e.target.value)} className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none">
          <option value="">Tous les contrats</option>
          <option>CDI</option><option>CDD</option><option>Stage</option>
        </select>
      </div>
      {(search || dept || contract) && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-gray-600">{filtered.length} résultat(s)</span>
          <button onClick={() => { setSearch(''); setDept(''); setContract(''); }} className="text-sm hover:underline" style={{ color: primary }}>Effacer</button>
        </div>
      )}
    </div>
  );
}

export function RecruitmentProcess({ primary }: { primary: string }) {
  const steps = [
    { step: '01', label: 'Candidature en ligne', desc: 'Postulez directement sur notre portail' },
    { step: '02', label: 'Analyse de votre CV', desc: 'Examen par notre équipe RH sous 7 jours' },
    { step: '03', label: 'Entretien RH', desc: 'Discussion sur votre parcours et motivations' },
    { step: '04', label: 'Entretien technique', desc: 'Évaluation de vos compétences métiers' },
    { step: '05', label: "Offre d'embauche", desc: "Proposition et intégration dans l'équipe" },
  ];
  return (
    <div className="rounded-3xl p-10" style={{ background: `linear-gradient(135deg, ${primary}12 0%, ${primary}22 100%)` }}>
      <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">Processus de recrutement</h3>
      <div className="space-y-4">
        {steps.map(step => (
          <div key={step.step} className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm">
            <div className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ backgroundColor: primary }}>{step.step}</div>
            <div>
              <div className="font-semibold text-gray-900 text-sm">{step.label}</div>
              <div className="text-gray-500 text-xs">{step.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Footer({ s, primary, companyName, logoInitials }: { s: Settings; primary: string; companyName: string; logoInitials: string }) {
  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          {s.logo_url
            ? <img src={s.logo_url} alt={companyName} className="h-10 w-auto object-contain brightness-0 invert" />
            : <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: primary }}><span className="text-white font-bold text-sm">{logoInitials}</span></div>
          }
          <div>
            <div className="font-bold">{companyName}</div>
            <div className="text-gray-400 text-sm">Espace Carrières</div>
          </div>
        </div>
        <div className="text-gray-400 text-sm text-center">{s.footer_copyright || `© 2024 ${companyName}. Tous droits réservés.`}</div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          {s.contact_email && <a href={`mailto:${s.contact_email}`} className="hover:text-white transition-colors">{s.contact_email}</a>}
          {s.linkedin_url && <a href={s.linkedin_url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">LinkedIn</a>}
        </div>
      </div>
    </footer>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array(6).fill(0).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-6 animate-pulse border border-gray-100">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" /><div className="h-6 bg-gray-200 rounded w-3/4 mb-4" /><div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function Empty() {
  return (
    <div className="text-center py-20">
      <div className="text-5xl mb-4">🔍</div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">Aucun résultat</h3>
      <p className="text-gray-500">Essayez d&apos;élargir vos critères de recherche</p>
    </div>
  );
}
