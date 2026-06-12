'use client';

import { useState, useEffect, useMemo } from 'react';

interface Candidate {
  id: string;
  name: string;
  email: string;
  current_title: string;
  years_experience: number;
}

interface Job {
  id: string;
  title: string;
  location: string;
  contract_type: string;
  department: string;
  status: string;
  experience: string;
}

interface AppEntry {
  candidateId: string;
  jobId: string;
  stage: string;
  jobTitle: string;
}

interface SendResult {
  candidateId: string;
  name: string;
  email: string;
  success: boolean;
  error?: string;
}

const DEFAULT_INTRO = `J'espère que ce message vous trouve bien.

Je me permets de vous contacter car votre profil a retenu toute notre attention. Nous avons actuellement des opportunités qui correspondent parfaitement à votre parcours et à vos compétences.

Je vous invite à découvrir les offres ci-dessous et à postuler directement en ligne si l'une d'elles vous intéresse.`;

const CONTRACT_COLORS: Record<string, string> = {
  CDI: 'bg-emerald-100 text-emerald-700',
  CDD: 'bg-blue-100 text-blue-700',
  Freelance: 'bg-violet-100 text-violet-700',
  Stage: 'bg-amber-100 text-amber-700',
  Alternance: 'bg-cyan-100 text-cyan-700',
};

const STAGE_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  'Présélectionné': { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-400' },
  'Entretien RH':   { bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-400' },
  'Entretien Tech': { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-400' },
  'Entretien':      { bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-400' },
  'Proposition':    { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-400' },
  'Retenu':         { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  'Rejeté':         { bg: 'bg-red-100', text: 'text-red-600', dot: 'bg-red-400' },
};

const FILTER_OPTIONS = [
  { value: 'all',        label: 'Tous' },
  { value: 'none',       label: 'Sans contact' },
  { value: 'active',     label: 'En cours' },
  { value: 'Rejeté',     label: 'Rejetés' },
];

function StageBadge({ stage }: { stage: string }) {
  const s = STAGE_STYLES[stage] || { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {stage}
    </span>
  );
}

export default function ProspectingPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<AppEntry[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('none'); // default: sans contact
  const [autoExclude, setAutoExclude] = useState(true);
  const [subject, setSubject] = useState('Une opportunité pour vous, {{candidat.nom}}');
  const [intro, setIntro] = useState(DEFAULT_INTRO);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    fetch('/api/candidates').then(r => r.json()).then(d => setCandidates(Array.isArray(d) ? d : (d.candidates || [])));
    fetch('/api/jobs').then(r => r.json()).then(d => {
      const all: Job[] = Array.isArray(d) ? d : (d.jobs || []);
      setJobs(all.filter(j => j.status === 'active'));
    });
    fetch('/api/prospecting/applications').then(r => r.json()).then(d => setApplications(Array.isArray(d) ? d : []));
  }, []);

  // Map: candidateId -> { jobId -> stage }
  const appMap = useMemo(() => {
    const map = new Map<string, Map<string, string>>();
    for (const app of applications) {
      if (!map.has(app.candidateId)) map.set(app.candidateId, new Map());
      map.get(app.candidateId)!.set(app.jobId, app.stage);
    }
    return map;
  }, [applications]);

  // For a candidate + selected jobs: get relevant stages
  function getCandidateStagesForSelectedJobs(candidateId: string): { jobId: string; jobTitle: string; stage: string }[] {
    if (selectedJobs.size === 0) return [];
    const candidateApps = appMap.get(candidateId);
    if (!candidateApps) return [];
    const result: { jobId: string; jobTitle: string; stage: string }[] = [];
    for (const jobId of selectedJobs) {
      if (candidateApps.has(jobId)) {
        const job = jobs.find(j => j.id === jobId);
        result.push({ jobId, jobTitle: job?.title || jobId, stage: candidateApps.get(jobId)! });
      }
    }
    return result;
  }

  // Get overall status of a candidate (across ALL jobs)
  function getCandidateOverallStatus(candidateId: string): string | null {
    const candidateApps = appMap.get(candidateId);
    if (!candidateApps || candidateApps.size === 0) return null;
    // Priority: active stages > Rejeté
    const stages = [...candidateApps.values()];
    if (stages.some(s => s !== 'Rejeté')) return 'active';
    return 'Rejeté';
  }

  const filteredCandidates = useMemo(() => {
    const q = search.toLowerCase();
    return candidates.filter(c => {
      // Text search
      if (q && !c.name.toLowerCase().includes(q) && !(c.email || '').toLowerCase().includes(q) && !(c.current_title || '').toLowerCase().includes(q)) return false;

      // Stage filter
      if (stageFilter === 'none') {
        // Aucun contact sur les offres sélectionnées (ou globalement si aucune offre sélectionnée)
        if (selectedJobs.size > 0) {
          const stages = getCandidateStagesForSelectedJobs(c.id);
          if (stages.length > 0) return false;
        } else {
          if (appMap.has(c.id)) return false;
        }
      } else if (stageFilter === 'active') {
        const overall = getCandidateOverallStatus(c.id);
        if (overall !== 'active') return false;
      } else if (stageFilter === 'Rejeté') {
        const candidateApps = appMap.get(c.id);
        if (!candidateApps) return false;
        const stages = [...candidateApps.values()];
        if (!stages.some(s => s === 'Rejeté')) return false;
      }
      // stageFilter === 'all' → no filter

      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, search, stageFilter, selectedJobs, appMap]);

  // Auto-exclude: when autoExclude is ON and jobs change, deselect candidates already in pipeline for those jobs
  useEffect(() => {
    if (!autoExclude || selectedJobs.size === 0) return;
    setSelectedCandidates(prev => {
      const next = new Set(prev);
      for (const candidateId of prev) {
        const stages = getCandidateStagesForSelectedJobs(candidateId);
        if (stages.some(s => s.stage !== 'Rejeté')) next.delete(candidateId);
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJobs, autoExclude]);

  function toggleCandidate(id: string) {
    setSelectedCandidates(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleJob(id: string) {
    setSelectedJobs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedCandidates(prev => {
      const next = new Set(prev);
      filteredCandidates.forEach(c => {
        if (c.email) {
          if (autoExclude && selectedJobs.size > 0) {
            const stages = getCandidateStagesForSelectedJobs(c.id);
            if (stages.some(s => s.stage !== 'Rejeté')) return; // skip already in pipeline
          }
          next.add(c.id);
        }
      });
      return next;
    });
  }

  function clearCandidates() { setSelectedCandidates(new Set()); }

  const canSend = selectedCandidates.size > 0 && selectedJobs.size > 0 && subject.trim() && intro.trim();

  async function handlePreview() {
    if (!selectedJobs.size) return;
    setLoadingPreview(true);
    setShowPreview(true);
    try {
      const res = await fetch('/api/prospecting/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobIds: [...selectedJobs], intro, candidateName: 'Prénom Nom' }),
      });
      const d = await res.json();
      setPreviewHtml(d.html || '');
    } catch {
      setPreviewHtml('<p>Erreur lors de la prévisualisation</p>');
    }
    setLoadingPreview(false);
  }

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    setResults(null);
    try {
      const res = await fetch('/api/prospecting/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateIds: [...selectedCandidates], jobIds: [...selectedJobs], subject, intro }),
      });
      const d = await res.json();
      setResults(d.results || []);
    } catch {
      setResults([]);
    }
    setSending(false);
  }

  const selectedJobsList = jobs.filter(j => selectedJobs.has(j.id));
  const sentCount = results?.filter(r => r.success).length ?? 0;

  // Stats for selected candidates
  const alreadyInPipelineCount = [...selectedCandidates].filter(id => {
    const stages = getCandidateStagesForSelectedJobs(id);
    return stages.some(s => s.stage !== 'Rejeté');
  }).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
            <span className="text-lg">✉️</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">Prospection</h1>
            <p className="text-xs text-gray-500">Envoyez des offres ciblées à vos candidats</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {selectedCandidates.size > 0 && selectedJobs.size > 0 && (
            <div className="text-sm text-gray-500 text-right">
              <span className="font-semibold text-emerald-600">{selectedCandidates.size}</span> candidat{selectedCandidates.size > 1 ? 's' : ''} ·{' '}
              <span className="font-semibold text-emerald-600">{selectedJobs.size}</span> offre{selectedJobs.size > 1 ? 's' : ''}
              {alreadyInPipelineCount > 0 && (
                <span className="ml-1 text-amber-600">· ⚠️ {alreadyInPipelineCount} déjà en cours</span>
              )}
            </div>
          )}
          <button
            onClick={handlePreview}
            disabled={!selectedJobs.size || !intro.trim()}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            👁 Aperçu email
          </button>
          <button
            onClick={handleSend}
            disabled={!canSend || sending}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors flex items-center gap-2 shadow-sm"
          >
            {sending ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Envoi…</>
            ) : (
              <>📤 Envoyer {selectedCandidates.size > 0 ? `(${selectedCandidates.size})` : ''}</>
            )}
          </button>
        </div>
      </div>

      {/* Results banner */}
      {results && (
        <div className={`mx-8 mt-4 p-4 rounded-xl flex items-center justify-between ${sentCount === results.length ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
          <div className="flex items-center gap-3">
            <span className="text-xl">{sentCount === results.length ? '✅' : '⚠️'}</span>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {sentCount}/{results.length} email{results.length > 1 ? 's' : ''} envoyé{results.length > 1 ? 's' : ''}
              </p>
              {results.filter(r => !r.success).map(r => (
                <p key={r.candidateId} className="text-xs text-red-600">{r.name} : {r.error}</p>
              ))}
            </div>
          </div>
          <button onClick={() => setResults(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>
      )}

      <div className="px-8 py-6 flex gap-6" style={{ minHeight: 'calc(100vh - 73px)' }}>

        {/* LEFT — Candidates */}
        <div className="w-[400px] flex-shrink-0 flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 140px)', position: 'sticky', top: '89px' }}>

            {/* Header + search */}
            <div className="px-5 py-4 border-b border-gray-50 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900">Candidats
                  <span className="ml-2 text-xs font-normal text-gray-400">{filteredCandidates.length} résultats</span>
                </h2>
                <div className="flex items-center gap-2">
                  {selectedCandidates.size > 0 && (
                    <button onClick={clearCandidates} className="text-xs text-gray-400 hover:text-gray-600">Effacer</button>
                  )}
                  <button onClick={selectAllFiltered} className="text-xs text-emerald-600 font-medium hover:text-emerald-700">
                    Tout sélectionner
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Nom, email, poste…"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              {/* Stage filters */}
              <div>
                <p className="text-xs text-gray-400 font-medium mb-1.5">Filtrer par statut pipeline</p>
                <div className="flex flex-wrap gap-1.5">
                  {FILTER_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setStageFilter(opt.value)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        stageFilter === opt.value
                          ? 'bg-emerald-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {opt.value === 'none' && '🚫 '}{opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto-exclude toggle */}
              <div className="flex items-center justify-between py-2 px-3 bg-amber-50 rounded-xl border border-amber-100">
                <div>
                  <p className="text-xs font-semibold text-amber-800">Exclure automatiquement</p>
                  <p className="text-xs text-amber-600">Ignore les candidats déjà en cours sur les offres sélectionnées</p>
                </div>
                <div
                  onClick={() => setAutoExclude(!autoExclude)}
                  className={`relative rounded-full cursor-pointer transition-colors flex-shrink-0 ml-3 ${autoExclude ? 'bg-amber-500' : 'bg-gray-300'}`}
                  style={{ width: 40, height: 22 }}
                >
                  <div className={`absolute top-[3px] w-4 h-4 bg-white rounded-full shadow transition-transform ${autoExclude ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
                </div>
              </div>

              {selectedCandidates.size > 0 && (
                <div className="px-3 py-1.5 bg-emerald-50 rounded-lg flex items-center justify-between">
                  <p className="text-xs text-emerald-700 font-medium">{selectedCandidates.size} sélectionné{selectedCandidates.size > 1 ? 's' : ''}</p>
                  {alreadyInPipelineCount > 0 && (
                    <p className="text-xs text-amber-600 font-medium">⚠️ {alreadyInPipelineCount} déjà en cours</p>
                  )}
                </div>
              )}
            </div>

            {/* Candidate list */}
            <div className="overflow-y-auto flex-1">
              {filteredCandidates.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  <p className="text-2xl mb-2">🔍</p>
                  <p>Aucun candidat dans ce filtre</p>
                </div>
              ) : (
                filteredCandidates.map(c => {
                  const selected = selectedCandidates.has(c.id);
                  const hasEmail = !!c.email;
                  const stagesForJobs = getCandidateStagesForSelectedJobs(c.id);
                  const isAlreadyActive = stagesForJobs.some(s => s.stage !== 'Rejeté');
                  const allCandidateApps = appMap.get(c.id);

                  return (
                    <div
                      key={c.id}
                      onClick={() => hasEmail && toggleCandidate(c.id)}
                      className={`flex items-start gap-3 px-5 py-3.5 border-b border-gray-50 transition-colors ${
                        hasEmail ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
                      } ${selected ? 'bg-emerald-50 hover:bg-emerald-50' : isAlreadyActive ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-gray-50'}`}
                    >
                      {/* Checkbox */}
                      <div className={`w-5 h-5 flex-shrink-0 rounded border-2 mt-1 flex items-center justify-center transition-colors ${
                        selected ? 'bg-emerald-500 border-emerald-500' : isAlreadyActive ? 'border-amber-300' : 'border-gray-300'
                      }`}>
                        {selected && <span className="text-white text-xs font-bold">✓</span>}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                          {isAlreadyActive && (
                            <span className="text-xs text-amber-600 flex-shrink-0">⚠️ En cours</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-500 truncate">{c.current_title || '—'}</p>
                          {c.years_experience && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md flex-shrink-0">
                              {c.years_experience}
                            </span>
                          )}
                        </div>
                        {hasEmail ? (
                          <p className="text-xs text-gray-400 truncate">{c.email}</p>
                        ) : (
                          <p className="text-xs text-red-400">Pas d'email</p>
                        )}

                        {/* Pipeline status for selected jobs */}
                        {stagesForJobs.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {stagesForJobs.map(s => (
                              <span key={s.jobId} className="text-xs text-gray-500">
                                <span className="font-medium truncate" style={{ maxWidth: 120, display: 'inline-block', verticalAlign: 'bottom', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                  {s.jobTitle.length > 20 ? s.jobTitle.slice(0, 20) + '…' : s.jobTitle}
                                </span>
                                {' '}→ <StageBadge stage={s.stage} />
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Other jobs (when no jobs selected, show all) */}
                        {selectedJobs.size === 0 && allCandidateApps && allCandidateApps.size > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {[...allCandidateApps.entries()].slice(0, 2).map(([jobId, stage]) => {
                              const job = jobs.find(j => j.id === jobId);
                              return (
                                <StageBadge key={jobId} stage={stage} />
                              );
                            })}
                            {allCandidateApps.size > 2 && (
                              <span className="text-xs text-gray-400">+{allCandidateApps.size - 2} offres</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex-1 flex flex-col gap-4">

          {/* Jobs selection */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900">Offres à proposer</h2>
              {selectedJobs.size > 0 && (
                <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2.5 py-1 rounded-full">
                  {selectedJobs.size} sélectionnée{selectedJobs.size > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="p-4">
              {jobs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Aucune offre active</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {jobs.map(job => {
                    const selected = selectedJobs.has(job.id);
                    // Count candidates already in pipeline for this job
                    const inPipeline = applications.filter(a => a.job_id === job.id || a.jobId === job.id).length;
                    return (
                      <div
                        key={job.id}
                        onClick={() => toggleJob(job.id)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          selected ? 'border-emerald-400 bg-emerald-50' : 'border-gray-100 hover:border-gray-200 bg-gray-50 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-semibold text-gray-900 leading-tight">{job.title}</p>
                          <div className={`w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                            selected ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'
                          }`}>
                            {selected && <span className="text-white text-xs font-bold">✓</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-500">📍 {job.location}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CONTRACT_COLORS[job.contract_type] || 'bg-gray-100 text-gray-600'}`}>
                            {job.contract_type}
                          </span>
                          {job.experience && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md">
                              🎯 {job.experience}
                            </span>
                          )}
                        </div>
                        {inPipeline > 0 && (
                          <p className="text-xs text-gray-400 mt-1.5">{inPipeline} candidat{inPipeline > 1 ? 's' : ''} en pipeline</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Email compose */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="text-sm font-bold text-gray-900">Composer l'email</h2>
              <p className="text-xs text-gray-500 mt-0.5">Utilisez <code className="bg-gray-100 px-1 rounded">{'{{candidat.nom}}'}</code> pour personnaliser</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Objet</label>
                <input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Message d'introduction</label>
                <textarea
                  value={intro}
                  onChange={e => setIntro(e.target.value)}
                  rows={7}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors resize-none leading-relaxed"
                />
                <p className="text-xs text-gray-400 mt-1">Les offres sélectionnées sont ajoutées automatiquement en dessous.</p>
              </div>
            </div>
          </div>

          {/* Summary before send */}
          {selectedJobsList.length > 0 && selectedCandidates.size > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Récapitulatif avant envoi</p>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="p-3 bg-emerald-50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-emerald-600">{selectedCandidates.size}</p>
                  <p className="text-xs text-gray-500">destinataire{selectedCandidates.size > 1 ? 's' : ''}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-blue-600">{selectedJobs.size}</p>
                  <p className="text-xs text-gray-500">offre{selectedJobs.size > 1 ? 's' : ''} incluse{selectedJobs.size > 1 ? 's' : ''}</p>
                </div>
                <div className={`p-3 rounded-xl text-center ${alreadyInPipelineCount > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                  <p className={`text-2xl font-bold ${alreadyInPipelineCount > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{alreadyInPipelineCount}</p>
                  <p className="text-xs text-gray-500">déjà en pipeline</p>
                </div>
              </div>
              {alreadyInPipelineCount > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <p className="text-xs text-amber-700">⚠️ {alreadyInPipelineCount} candidat{alreadyInPipelineCount > 1 ? 's sont' : ' est'} déjà en cours sur au moins une des offres sélectionnées. Activez "Exclure automatiquement" pour les retirer.</p>
                </div>
              )}
              <div className="mt-3 space-y-1.5">
                {selectedJobsList.map(job => (
                  <div key={job.id} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-emerald-500">✓</span>
                    <span className="font-medium">{job.title}</span>
                    <span className="text-gray-400">· {job.location} · {job.contract_type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Aperçu de l'email</h3>
              <button onClick={() => setShowPreview(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">✕</button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {loadingPreview ? (
                <div className="flex items-center justify-center h-48">
                  <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <iframe srcDoc={previewHtml} className="w-full rounded-xl border border-gray-200" style={{ minHeight: '600px' }} title="Email preview" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
