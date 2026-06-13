'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Settings } from '@/lib/useSettings';
import { RecruitmentProcess, Footer, Empty } from './Classic';

interface Job {
  id: string; title: string; department: string; location: string;
  contract_type: string; description: string; experience: string;
}

const DEPT_COLORS: Record<string, string> = {
  'Data & BI': 'bg-blue-50 text-blue-700', 'Digital': 'bg-violet-50 text-violet-700',
  'Innovation': 'bg-emerald-50 text-emerald-700', 'Finance': 'bg-amber-50 text-amber-700',
  'default': 'bg-gray-100 text-gray-600',
};
function deptColor(d: string) { return DEPT_COLORS[d] || DEPT_COLORS.default; }

export default function MinimalTemplate({ jobs, filtered, s, search, setSearch, dept, setDept, contract, setContract, loading, DEPARTMENTS }: {
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
  const values = [1,2,3,4].map(n => ({ icon: s[`value${n}_icon`], title: s[`value${n}_title`], desc: s[`value${n}_desc`] })).filter(v => v.title);

  return (
    <div className="min-h-screen bg-white">
      {/* Header — ultra minimal */}
      <header className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-sm z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {s.logo_url
              ? <img src={s.logo_url} alt={companyName} className="h-8 w-auto object-contain" />
              : <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: primary }}><span className="text-white font-bold text-xs">{logoInitials}</span></div>
            }
            <span className="font-semibold text-gray-900 text-sm">{companyName}</span>
          </div>
          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-6">
            <a href="#offres" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Offres ({jobs.length})</a>
            <Link href="/hr/dashboard" className="text-sm font-medium transition-colors hover:opacity-80" style={{ color: primary }}>Espace RH →</Link>
          </div>
          {/* Mobile nav */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="sm:hidden flex flex-col gap-1.5 p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <span className={`block w-5 h-0.5 bg-gray-600 transition-transform ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-5 h-0.5 bg-gray-600 transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-gray-600 transition-transform ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
        {menuOpen && (
          <div className="sm:hidden border-t border-gray-100 bg-white px-4 py-3 flex flex-col gap-1">
            <a href="#offres" onClick={() => setMenuOpen(false)} className="py-2.5 px-3 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">Offres ({jobs.length})</a>
            <Link href="/hr/dashboard" onClick={() => setMenuOpen(false)} className="py-2.5 px-3 text-sm font-medium rounded-lg" style={{ color: primary }}>Espace RH →</Link>
          </div>
        )}
      </header>

      {/* Hero — centered, minimal */}
      <section className="py-14 sm:py-24 lg:py-32 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-medium tracking-widest uppercase text-gray-400 mb-6 sm:mb-8">
            <span className="w-6 h-px bg-gray-300" />
            {loading ? '…' : jobs.length} {s.hero_badge || 'postes ouverts'}
            <span className="w-6 h-px bg-gray-300" />
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-7xl font-light text-gray-900 leading-tight tracking-tight mb-5 sm:mb-6">
            {s.hero_title || `Rejoignez ${companyName}`}
          </h1>
          <div className="w-12 h-0.5 mx-auto mb-6 rounded" style={{ backgroundColor: primary }} />
          <p className="text-xl text-gray-500 leading-relaxed mb-10 max-w-2xl mx-auto">{s.hero_subtitle}</p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <a href="#offres" className="inline-flex items-center gap-2 text-white font-medium px-8 py-3.5 rounded-full transition-opacity hover:opacity-90 text-sm" style={{ backgroundColor: primary }}>
              {s.cta_primary || 'Voir les offres'} →
            </a>
            {s.cta_secondary && (
              <a href="#about" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors border border-gray-200 px-8 py-3.5 rounded-full hover:border-gray-400">
                {s.cta_secondary}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Thin divider */}
      <div className="h-px bg-gray-100 max-w-5xl mx-auto" />

      {/* Jobs — list style */}
      <section id="offres" className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-1">{s.jobs_section_title || "Nos offres"}</h2>
            <p className="text-gray-400 text-sm">{s.jobs_section_subtitle}</p>
          </div>
          {/* Minimal filters */}
          <div className="flex flex-wrap gap-3 mb-8">
            <input type="text" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)}
              className="border border-gray-200 rounded-full px-5 py-2 text-sm focus:outline-none focus:ring-1 flex-1 min-w-48" style={{ ['--tw-ring-color' as string]: primary }} />
            <select value={dept} onChange={e => setDept(e.target.value)} className="border border-gray-200 rounded-full px-4 py-2 text-sm bg-white focus:outline-none text-gray-600">
              <option value="">Tous les dép.</option>
              {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
            </select>
            <select value={contract} onChange={e => setContract(e.target.value)} className="border border-gray-200 rounded-full px-4 py-2 text-sm bg-white focus:outline-none text-gray-600">
              <option value="">Tout contrat</option>
              <option>CDI</option><option>CDD</option><option>Stage</option>
            </select>
            {(search || dept || contract) && (
              <button onClick={() => { setSearch(''); setDept(''); setContract(''); }} className="text-sm text-gray-400 hover:text-gray-700 px-3 py-2 rounded-full border border-gray-100 hover:border-gray-200 transition-colors">× Effacer</button>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="animate-pulse h-20 bg-gray-50 rounded-2xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? <Empty /> : (
            <div className="divide-y divide-gray-50">
              {filtered.map(job => (
                <Link key={job.id} href={`/jobs/${job.id}`}
                  className="group flex items-center justify-between py-6 hover:bg-gray-50 -mx-4 px-4 rounded-xl transition-colors">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${primary}12` }}>
                      <span className="text-sm font-bold" style={{ color: primary }}>{job.department.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">{job.title}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${deptColor(job.department)}`}>{job.department}</span>
                        <span className="text-xs text-gray-400">📍 {job.location}</span>
                        {job.experience && <span className="text-xs text-gray-400">· {job.experience}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <span className="text-xs text-gray-400 border border-gray-200 rounded-full px-3 py-1">{job.contract_type}</span>
                    <span className="text-gray-300 group-hover:text-gray-600 transition-colors font-light text-lg">→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* About — minimal */}
      {values.length > 0 && (
        <section id="about" className="py-20 bg-gray-50">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-10">{s.about_title || `Pourquoi ${companyName} ?`}</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {values.map(item => (
                  <div key={item.title} className="bg-white rounded-2xl p-6 border border-gray-100">
                    <div className="text-2xl mb-3">{item.icon}</div>
                    <h3 className="font-semibold text-gray-900 mb-1 text-sm">{item.title}</h3>
                    <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>
                  </div>
                ))}
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
