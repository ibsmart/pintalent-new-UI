'use client';

import Link from 'next/link';
import { Settings, darken } from '@/lib/useSettings';
import { Filters, RecruitmentProcess, Footer, LoadingSkeleton, Empty } from './Classic';

interface Job {
  id: string; title: string; department: string; location: string;
  contract_type: string; description: string; experience: string;
}

export default function ModernTemplate({ jobs, filtered, s, search, setSearch, dept, setDept, contract, setContract, loading, DEPARTMENTS }: {
  jobs: Job[]; filtered: Job[]; s: Settings;
  search: string; setSearch: (v: string) => void;
  dept: string; setDept: (v: string) => void;
  contract: string; setContract: (v: string) => void;
  loading: boolean; DEPARTMENTS: string[];
}) {
  const primary = s.primary_color || '#b91c1c';
  const companyName = s.company_name || 'GEEKFACT';
  const logoInitials = s.logo_initials || 'GF';
  const stats = [1,2,3,4].map(n => ({ value: s[`stat${n}_value`], label: s[`stat${n}_label`] })).filter(v => v.value);
  const values = [1,2,3,4].map(n => ({ icon: s[`value${n}_icon`], title: s[`value${n}_title`], desc: s[`value${n}_desc`] })).filter(v => v.title);

  return (
    <div className="min-h-screen bg-white">
      {/* Header — dark */}
      <header className="bg-gray-950 text-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden" style={{ backgroundColor: primary }}>
              {s.logo_url ? <img src={s.logo_url} alt={companyName} className="w-8 h-8 object-contain" /> : <span className="text-white font-bold text-xs">{logoInitials}</span>}
            </div>
            <span className="font-bold text-lg tracking-tight">{companyName}</span>
          </div>
          <nav className="flex items-center gap-8">
            <a href="#offres" className="text-sm text-gray-400 hover:text-white transition-colors">Offres</a>
            <a href="#about" className="text-sm text-gray-400 hover:text-white transition-colors">À propos</a>
            <Link href="/hr/dashboard" className="text-sm font-semibold px-4 py-2 rounded-lg border transition-colors hover:text-white" style={{ color: primary, borderColor: primary }}>
              Espace RH
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero — split layout */}
      <section className="bg-gray-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider mb-8" style={{ backgroundColor: `${primary}25`, color: primary }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: primary }} />
              {loading ? '…' : jobs.length} {s.hero_badge || 'postes ouverts'}
            </div>
            <h1 className="text-5xl lg:text-7xl font-black leading-none mb-6 tracking-tight">
              {(s.hero_title || `Rejoignez ${companyName}`).split(' ').map((word, i) => (
                <span key={i}>{i === 1 ? <span style={{ color: primary }}>{word} </span> : `${word} `}</span>
              ))}
            </h1>
            <p className="text-gray-400 text-lg leading-relaxed mb-10 max-w-lg">{s.hero_subtitle}</p>
            <div className="flex flex-wrap gap-4">
              <a href="#offres" className="inline-flex items-center gap-2 text-white font-bold px-8 py-4 rounded-2xl transition-colors text-base" style={{ backgroundColor: primary }}>
                {s.cta_primary || 'Voir les offres'} <span>→</span>
              </a>
              {s.cta_secondary && (
                <a href="#about" className="inline-flex items-center gap-2 text-gray-400 hover:text-white font-medium px-8 py-4 rounded-2xl border border-gray-700 hover:border-gray-500 transition-colors text-base">
                  {s.cta_secondary}
                </a>
              )}
            </div>
          </div>
          {/* Right: geometric pattern + stats */}
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl opacity-5" style={{ background: `radial-gradient(circle at 50% 50%, ${primary}, transparent 70%)` }} />
            <div className="grid grid-cols-2 gap-4">
              {stats.map((stat, i) => (
                <div key={i} className="rounded-2xl p-6 border border-gray-800 bg-gray-900">
                  <div className="text-3xl font-black mb-1" style={{ color: primary }}>{stat.value}</div>
                  <div className="text-gray-400 text-sm">{stat.label}</div>
                </div>
              ))}
              {stats.length === 0 && (
                <div className="col-span-2 rounded-2xl p-10 border border-gray-800 bg-gray-900 flex items-center justify-center">
                  <div className="text-6xl font-black text-gray-800">{companyName}</div>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Color band */}
        <div className="h-1 w-full" style={{ background: `linear-gradient(to right, ${primary}, ${darken(primary)})` }} />
      </section>

      {/* Jobs */}
      <section id="offres" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-4xl font-black text-gray-900 tracking-tight">{s.jobs_section_title || 'Nos offres'}</h2>
              <p className="text-gray-500 mt-2">{s.jobs_section_subtitle}</p>
            </div>
            <span className="text-5xl font-black text-gray-100">{filtered.length}</span>
          </div>
          <Filters s={s} primary={primary} search={search} setSearch={setSearch} dept={dept} setDept={setDept} contract={contract} setContract={setContract} filtered={filtered} DEPARTMENTS={DEPARTMENTS} />
          {loading ? <LoadingSkeleton /> : filtered.length === 0 ? <Empty /> : (
            <div className="space-y-4">
              {filtered.map((job, i) => (
                <Link key={job.id} href={`/jobs/${job.id}`}
                  className="group flex items-center justify-between p-6 rounded-2xl border border-gray-100 hover:border-opacity-70 hover:shadow-lg transition-all bg-white"
                  style={{ ['--hover-border' as string]: primary }}>
                  <div className="flex items-center gap-6 flex-1 min-w-0">
                    <span className="text-2xl font-black text-gray-100 w-10 flex-shrink-0 group-hover:text-gray-200 transition-colors">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-gray-900 group-hover:opacity-75 transition-opacity truncate">{job.title}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <span className="font-medium" style={{ color: primary }}>{job.department}</span>
                        <span>·</span><span>📍 {job.location}</span>
                        {job.experience && <><span>·</span><span>⏱ {job.experience}</span></>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-gray-100 text-gray-600">{job.contract_type}</span>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center transition-colors group-hover:text-white" style={{ ['--bg' as string]: primary }}>
                      <span className="text-gray-300 group-hover:text-white transition-colors font-bold">→</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* About */}
      {values.length > 0 && (
        <section id="about" className="py-20 bg-gray-950 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div>
              <h2 className="text-4xl font-black tracking-tight mb-4">{s.about_title || `Pourquoi ${companyName} ?`}</h2>
              <div className="h-1 w-16 rounded mb-10" style={{ backgroundColor: primary }} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {values.map(item => (
                  <div key={item.title} className="rounded-2xl p-6 border border-gray-800 bg-gray-900 hover:border-gray-700 transition-colors">
                    <div className="text-3xl mb-3">{item.icon}</div>
                    <h3 className="font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-900 rounded-3xl p-8 border border-gray-800">
              <RecruitmentProcess primary={primary} />
            </div>
          </div>
        </section>
      )}
      <Footer s={s} primary={primary} companyName={companyName} logoInitials={logoInitials} />
    </div>
  );
}
