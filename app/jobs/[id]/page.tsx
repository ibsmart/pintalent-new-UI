'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useSettings, darken } from '@/lib/useSettings';

interface Job {
  id: string; title: string; department: string; location: string;
  contract_type: string; description: string; missions: string;
  profile: string; keywords: string; experience: string; education: string;
}

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scoreData, setScoreData] = useState<{ score: number; recommendation: string; summary: string } | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', linkedin: '', cover_letter: '', contract_preference: 'CDI', current_salary: '', desired_salary: '', tjm: '', notice_period: '' });
  const [cv, setCv] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { settings: s } = useSettings();
  const primary = s.primary_color || '#b91c1c';
  const companyName = s.company_name || 'GEEKFACT';
  const logoInitials = s.logo_initials || 'GF';

  useEffect(() => {
    fetch(`/api/jobs/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setJob(data); setLoading(false); });
  }, [id]);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Nom requis';
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = 'Email invalide';
    if (!cv) e.cv = 'CV requis (PDF ou DOCX)';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    fd.append('job_id', id);
    if (cv) fd.append('cv', cv);
    try {
      const res = await fetch('/api/applications', { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        if (data.score !== undefined) setScoreData({ score: data.score, recommendation: data.recommendation, summary: data.summary });
        setSubmitted(true); setApplying(false);
      } else {
        const data = await res.json();
        setErrors({ submit: data.error || "Erreur lors de l'envoi" });
      }
    } finally { setSubmitting(false); }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 rounded-full" style={{ border: `4px solid ${primary}30`, borderTopColor: primary }} />
    </div>
  );

  if (!job) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4">😕</div>
        <h2 className="text-xl font-semibold mb-2">Offre introuvable</h2>
        <Link href="/" className="hover:underline" style={{ color: primary }}>Retour aux offres</Link>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 max-w-md text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Candidature envoyée !</h2>
        <p className="text-gray-600 mb-2">
          Merci <strong>{form.name}</strong>, votre candidature pour <strong>{job.title}</strong> a bien été reçue.
        </p>
        {scoreData && scoreData.score > 0 && (
          <div className={`mt-4 mb-6 p-4 rounded-xl border text-left ${
            scoreData.score >= 75 ? 'bg-green-50 border-green-200' :
            scoreData.score >= 45 ? 'bg-yellow-50 border-yellow-200' : 'bg-emerald-50 border-emerald-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Score de matching</span>
              <span className={`text-2xl font-bold ${scoreData.score >= 75 ? 'text-green-600' : scoreData.score >= 45 ? 'text-yellow-600' : 'text-emerald-500'}`}>
                {scoreData.score}/100
              </span>
            </div>
            <div className="w-full bg-white/60 rounded-full h-2 mb-3">
              <div className={`h-2 rounded-full ${scoreData.score >= 75 ? 'bg-green-500' : scoreData.score >= 45 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                style={{ width: `${scoreData.score}%` }} />
            </div>
            {scoreData.summary && <p className="text-sm text-gray-700">{scoreData.summary}</p>}
          </div>
        )}
        <p className="text-gray-500 text-sm mb-8">Notre équipe RH analysera votre profil et vous contactera sous 7 jours ouvrés.</p>
        <div className="flex flex-col gap-3">
          <button onClick={() => { setSubmitted(false); setForm({ name:'',email:'',phone:'',linkedin:'',cover_letter:'', contract_preference:'CDI', current_salary:'', desired_salary:'', tjm:'', notice_period:'' }); setCv(null); }}
            className="text-white px-6 py-3 rounded-xl font-medium transition-colors" style={{ backgroundColor: primary }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = darken(primary))}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = primary)}>
            Postuler à une autre offre
          </button>
          <Link href="/" className="text-gray-600 hover:text-gray-900 text-sm">← Retour aux offres</Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden" style={{ backgroundColor: primary }}>
              {s.logo_url ? <img src={s.logo_url} alt={companyName} className="w-7 h-7 object-contain" /> : <span className="text-white font-bold text-xs">{logoInitials}</span>}
            </div>
            <span className="font-semibold text-gray-900">{companyName}</span>
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-500 text-sm truncate">{job.title}</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1 mb-6">← Retour aux offres</Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-8">
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-xs font-medium px-3 py-1 rounded-full" style={{ backgroundColor: `${primary}18`, color: primary }}>{job.department}</span>
                <span className="bg-gray-100 text-gray-700 text-xs font-medium px-3 py-1 rounded-full">{job.contract_type}</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{job.title}</h1>
              <div className="flex flex-wrap gap-4 text-sm text-gray-500 pb-6 border-b border-gray-100">
                <span>📍 {job.location}</span>
                {job.experience && <span>⏱ {job.experience}</span>}
                {job.education && <span>🎓 {job.education}</span>}
              </div>
              <div className="pt-6">
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">{job.description}</p>
              </div>
            </div>

            {job.missions && (
              <div className="bg-white rounded-2xl border border-gray-100 p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Missions</h2>
                <div className="text-gray-700 leading-relaxed whitespace-pre-line">{job.missions}</div>
              </div>
            )}

            {job.profile && (
              <div className="bg-white rounded-2xl border border-gray-100 p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Profil recherché</h2>
                <p className="text-gray-700 leading-relaxed">{job.profile}</p>
                {job.keywords && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {job.keywords.split(',').map(k => (
                      <span key={k.trim()} className="text-xs px-3 py-1 rounded-full border" style={{ backgroundColor: `${primary}08`, color: primary, borderColor: `${primary}30` }}>
                        {k.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar — candidature */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 sticky top-24">
              <h3 className="font-semibold text-gray-900 mb-4">Postuler à ce poste</h3>

              {!applying ? (
                <button onClick={() => setApplying(true)}
                  className="w-full text-white py-4 rounded-xl font-semibold transition-colors text-base"
                  style={{ backgroundColor: primary }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = darken(primary))}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = primary)}>
                  Postuler maintenant
                </button>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {[
                    { key: 'name', label: 'Nom complet *', type: 'text', placeholder: 'Votre nom' },
                    { key: 'email', label: 'Email *', type: 'email', placeholder: 'votre@email.com' },
                    { key: 'phone', label: 'Téléphone', type: 'tel', placeholder: '+212 6xx xx xx xx' },
                    { key: 'linkedin', label: 'LinkedIn (optionnel)', type: 'url', placeholder: 'https://linkedin.com/in/...' },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                      <input type={field.type} value={form[field.key as keyof typeof form]}
                        onChange={e => setForm(f => ({...f, [field.key]: e.target.value}))}
                        placeholder={field.placeholder}
                        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${errors[field.key] ? 'border-emerald-400' : 'border-gray-200'}`}
                        style={{ ['--tw-ring-color' as string]: primary }} />
                      {errors[field.key] && <p className="text-emerald-500 text-xs mt-1">{errors[field.key]}</p>}
                    </div>
                  ))}

                  {/* CV upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CV (PDF ou DOCX) *</label>
                    <div className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${errors.cv ? 'border-emerald-400' : 'border-gray-200 hover:border-gray-400'} ${cv ? 'bg-green-50 border-green-400' : ''}`}
                      onClick={() => document.getElementById('cv-input')?.click()}>
                      {cv ? <div className="text-green-700 text-sm">✓ {cv.name}</div> : <div className="text-gray-500 text-sm">Cliquez pour sélectionner</div>}
                    </div>
                    <input id="cv-input" type="file" accept=".pdf,.docx" className="hidden" onChange={e => setCv(e.target.files?.[0] || null)} />
                    {errors.cv && <p className="text-emerald-500 text-xs mt-1">{errors.cv}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lettre de motivation <span className="text-gray-400 font-normal">(optionnel)</span></label>
                    <textarea value={form.cover_letter} onChange={e => setForm(f => ({...f, cover_letter: e.target.value}))}
                      rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none"
                      style={{ ['--tw-ring-color' as string]: primary }} placeholder="Parlez-nous de votre motivation..." />
                  </div>

                  {/* Prétentions */}
                  <div className="border border-gray-100 rounded-xl p-4 space-y-4 bg-gray-50">
                    <p className="text-sm font-semibold text-gray-700">💼 Prétentions <span className="text-gray-400 font-normal text-xs">(optionnel)</span></p>

                    {/* Type contrat */}
                    <div className="grid grid-cols-2 gap-2">
                      {['CDI', 'Freelance'].map(type => (
                        <button key={type} type="button"
                          onClick={() => setForm(f => ({ ...f, contract_preference: type }))}
                          className={`py-2 rounded-lg border text-sm font-medium transition-all ${
                            form.contract_preference === type
                              ? 'text-white border-transparent'
                              : 'border-gray-200 bg-white text-gray-500'
                          }`}
                          style={form.contract_preference === type ? { backgroundColor: primary } : {}}>
                          {type === 'CDI' ? '🏢 CDI' : '⚡ Freelance'}
                        </button>
                      ))}
                    </div>

                    {/* CDI */}
                    {form.contract_preference === 'CDI' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Salaire actuel</label>
                          <div className="relative">
                            <input type="text" value={form.current_salary}
                              onChange={e => setForm(f => ({ ...f, current_salary: e.target.value }))}
                              placeholder="45 000"
                              className="w-full pl-3 pr-10 py-2 border border-gray-200 bg-white rounded-lg text-sm focus:outline-none focus:ring-1" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">€/an</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Salaire souhaité</label>
                          <div className="relative">
                            <input type="text" value={form.desired_salary}
                              onChange={e => setForm(f => ({ ...f, desired_salary: e.target.value }))}
                              placeholder="55 000"
                              className="w-full pl-3 pr-10 py-2 border border-gray-200 bg-white rounded-lg text-sm focus:outline-none focus:ring-1" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">€/an</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Freelance */}
                    {form.contract_preference === 'Freelance' && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">TJM souhaité</label>
                        <div className="relative">
                          <input type="text" value={form.tjm}
                            onChange={e => setForm(f => ({ ...f, tjm: e.target.value }))}
                            placeholder="650"
                            className="w-full pl-3 pr-14 py-2 border border-gray-200 bg-white rounded-lg text-sm focus:outline-none focus:ring-1" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">€/jour</span>
                        </div>
                      </div>
                    )}

                    {/* Préavis */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5">Préavis</label>
                      <div className="flex flex-wrap gap-1.5">
                        {['Immédiat', '1 mois', '2 mois', '3 mois'].map(p => (
                          <button key={p} type="button"
                            onClick={() => setForm(f => ({ ...f, notice_period: f.notice_period === p ? '' : p }))}
                            className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                              form.notice_period === p ? 'text-white border-transparent' : 'border-gray-200 bg-white text-gray-500'
                            }`}
                            style={form.notice_period === p ? { backgroundColor: primary } : {}}>
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {errors.submit && <p className="text-emerald-500 text-sm">{errors.submit}</p>}

                  <div className="flex gap-2">
                    <button type="submit" disabled={submitting}
                      className="flex-1 text-white py-3 rounded-xl font-semibold disabled:opacity-50 transition-colors text-sm"
                      style={{ backgroundColor: primary }}
                      onMouseEnter={e => !submitting && (e.currentTarget.style.backgroundColor = darken(primary))}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = primary)}>
                      {submitting ? '⏳ Analyse en cours…' : 'Envoyer ma candidature'}
                    </button>
                    <button type="button" onClick={() => setApplying(false)}
                      className="px-4 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm">✕</button>
                  </div>
                </form>
              )}

              <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400 text-center">
                Vos données sont traitées conformément à notre politique de confidentialité
              </div>
            </div>

            {/* Contact */}
            {s.contact_email && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
                <p className="text-xs text-gray-500 mb-1">Une question ?</p>
                <a href={`mailto:${s.contact_email}`} className="text-sm font-medium hover:underline" style={{ color: primary }}>{s.contact_email}</a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
