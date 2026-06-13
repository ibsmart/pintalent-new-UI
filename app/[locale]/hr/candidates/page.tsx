'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { usePermissions } from '@/lib/permissions-context';
import { useTranslations } from 'next-intl';

interface Application {
  id: string | null;
  candidate_id: string;
  name: string;
  email: string;
  phone: string;
  job_title: string | null;
  department: string | null;
  score: number | null;
  recommendation: string | null;
  pipeline_stage: string | null;
  created_at: string;
  updated_at: string;
  current_title?: string;
  years_experience?: string;
}

const STAGE_COLORS: Record<string, string> = {
  'Nouveau': 'bg-slate-100 text-slate-700',
  'Présélectionné': 'bg-purple-100 text-purple-700',
  'Entretien': 'bg-yellow-100 text-yellow-700',
  'Test technique': 'bg-orange-100 text-orange-700',
  'Offre': 'bg-blue-100 text-blue-700',
  'Embauché': 'bg-green-100 text-green-700',
  'Rejeté': 'bg-emerald-100 text-emerald-700',
};

const RECO_COLORS: Record<string, string> = {
  'À retenir': 'text-green-600',
  'À évaluer': 'text-yellow-600',
  'À écarter': 'text-emerald-600',
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-green-500' : score >= 45 ? 'bg-yellow-500' : 'bg-emerald-400';
  return (
    <div className="flex items-center gap-2 w-32">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${score}%` }}></div>
      </div>
      <span className="text-sm font-bold text-gray-700 w-6 text-right">{score}</span>
    </div>
  );
}

type AddForm = { name: string; email: string; phone: string; linkedin: string; job_id: string; stage: string; contract_preference: string; current_salary: string; desired_salary: string; tjm: string; notice_period: string };
const EMPTY_ADD: AddForm = { name: '', email: '', phone: '', linkedin: '', job_id: '', stage: 'Présélectionné', contract_preference: 'CDI', current_salary: '', desired_salary: '', tjm: '', notice_period: '' };


type AttachMode = 'manual' | 'auto';
interface MatchResult { job_id: string; title: string; department: string; contract_type: string; score: number; recommendation: string; reason: string }

function CandidatesContent() {
  const t = useTranslations('candidates');
  const tStages = useTranslations('stages');
  const { can } = usePermissions();
  const searchParams = useSearchParams();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<{ id: string; title: string }[]>([]);
  const [filterJob, setFilterJob] = useState(searchParams.get('job_id') || '');
  const [filterStages, setFilterStages] = useState<Set<string>>(new Set());
  const [stageDropOpen, setStageDropOpen] = useState(false);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(EMPTY_ADD);
  const [addCv, setAddCv] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);
  const [attachMode, setAttachMode] = useState<AttachMode>('manual');
  // Auto-matching state (step 2 of the modal)
  const [addedCandidateId, setAddedCandidateId] = useState<string | null>(null);
  const [matchResults, setMatchResults] = useState<MatchResult[] | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [attaching, setAttaching] = useState<string | null>(null);
  const [addedName, setAddedName] = useState('');
  const [addedTitle, setAddedTitle] = useState('');
  const [addedSkills, setAddedSkills] = useState('');
  const [addedYears, setAddedYears] = useState('');
  const [fallbackJobId, setFallbackJobId] = useState('');
  const [fallbackScore, setFallbackScore] = useState<{ score: number; recommendation: string; reason: string } | null>(null);
  const [fallbackScoring, setFallbackScoring] = useState(false);
  // Job selection before matching (max 10)
  const [jobSelection, setJobSelection] = useState<Set<string>>(new Set());
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [addProgress, setAddProgress] = useState<{ label: string; pct: number } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [colSort, setColSort] = useState<{ col: string; dir: 'asc' | 'desc' } | null>(null);
  const [extracting, setExtracting] = useState<Set<string>>(new Set());
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'warning' | 'success' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);

  function showToast(message: string, type: 'error' | 'warning' | 'success' = 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }

  function showConfirm(message: string, onConfirm: () => void) {
    setConfirmModal({ message, onConfirm });
  }

  useEffect(() => {
    fetch('/api/jobs?status=all').then(r => r.json()).then(setJobs);
  }, []);

  useEffect(() => {
    if (!stageDropOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-stage-drop]')) setStageDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [stageDropOpen]);

  const loadApps = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterJob) params.set('job_id', filterJob);
    params.set('sort', sortBy);
    params.set('order', sortOrder);

    fetch(`/api/applications?${params}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) { setApps(data); }
        else { console.error('[loadApps] unexpected response:', data); setApps([]); }
        setLoading(false);
      })
      .catch(e => { console.error('[loadApps] fetch error:', e); setLoading(false); });
  }, [filterJob, sortBy, sortOrder]);

  useEffect(() => { loadApps(); }, [loadApps]);

  function closeAdd() {
    setShowAdd(false); setAddForm(EMPTY_ADD); setAddCv(null);
    setAttachMode('manual'); setAddedCandidateId(null); setAddedName('');
    setMatchResults(null); setAttaching(null); setAddProgress(null);
    setShowJobPicker(false); setJobSelection(new Set());
    setAddedTitle(''); setAddedSkills(''); setAddedYears('');
    setFallbackJobId(''); setFallbackScore(null); setFallbackScoring(false);
    setDuplicateId(null);
  }

  async function addCandidate() {
    setAdding(true);
    setAddProgress({ label: t('progressReadingCv'), pct: 15 });

    const fd = new FormData();
    const formToSend = attachMode === 'auto' ? { ...addForm, job_id: '' } : addForm;
    Object.entries(formToSend).forEach(([k, v]) => fd.append(k, v));
    if (addCv) fd.append('cv', addCv);

    setAddProgress({ label: t('progressExtractingContacts'), pct: 35 });

    let res: Response;
    let data: Record<string, unknown>;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 60_000);
      res = await fetch('/api/candidates', { method: 'POST', body: fd, signal: ctrl.signal });
      clearTimeout(timer);
      data = await res.json();
    } catch {
      setAdding(false); setAddProgress(null);
      showToast(t('toastTimeout'), 'warning');
      return;
    }

    if (!res.ok) {
      setAdding(false); setAddProgress(null);
      showToast((data.error as string) || t('toastExtractError'));
      return;
    }

    setAddProgress({ label: t('progressSaved'), pct: 60 });

    // Candidat déjà existant → afficher le message doublon
    if (data.existing) {
      setAdding(false); setAddProgress(null);
      setDuplicateId(data.candidate_id as string);
      setAddedName((data.name as string) || '');
      loadApps();
      return;
    }

    if (attachMode === 'manual') {
      setAddProgress({ label: t('progressDone'), pct: 100 });
      setTimeout(() => { setAdding(false); setAddProgress(null); closeAdd(); loadApps(); }, 400);
    } else {
      // Step 2 : show job picker before calling Claude
      const candidateId = data.candidate_id as string;
      setAddedCandidateId(candidateId);
      setAddedName((data.name as string) || '');
      setAddedTitle((data.current_title as string) || '');
      setAddedSkills((data.key_skills as string) || '');
      setAddedYears((data.years_experience as string) || '');
      setAdding(false);
      setAddProgress(null);
      // Pre-select all jobs (user can deselect down to ≤10)
      const activeJobs = (jobs as { id: string; title: string }[]).filter(j => j.id);
      setJobSelection(new Set(activeJobs.slice(0, 10).map(j => j.id)));
      setShowJobPicker(true);
      loadApps();
      // Background Claude enrichment — poll after 4s then 8s to get title/skills
      const pollEnrichment = async (attempt: number) => {
        try {
          const r = await fetch(`/api/candidates/${candidateId}`);
          if (!r.ok) return;
          const c = await r.json();
          if (c.current_title) setAddedTitle(c.current_title);
          if (c.years_experience) setAddedYears(c.years_experience);
          if (!c.current_title && attempt < 2) setTimeout(() => pollEnrichment(attempt + 1), 5000);
        } catch { /* ignore */ }
      };
      setTimeout(() => pollEnrichment(1), 4000);
    }
  }

  async function runMatchingOnSelection() {
    if (!addedCandidateId || jobSelection.size === 0) return;
    setShowJobPicker(false);
    setMatchLoading(true);
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 60_000);
      const res = await fetch('/api/matching', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'candidate_to_jobs',
          candidate_id: addedCandidateId,
          job_ids: Array.from(jobSelection),
        }),
        signal: ctrl.signal,
      });
      const data = await res.json();
      setMatchResults(data.results || []);
    } catch {
      setMatchResults([]);
    } finally {
      setMatchLoading(false);
    }
  }

  async function attachToJob(jobId: string, matchScore?: number, matchReco?: string, matchReason?: string) {
    if (!addedCandidateId) return;
    setAttaching(jobId);
    await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidate_id: addedCandidateId,
        job_id: jobId,
        pipeline_stage: addForm.stage || 'Présélectionné',
        cover_letter: '',
        score: matchScore,
        recommendation: matchReco,
        score_summary: matchReason || null,
      }),
    });
    setAttaching(null); closeAdd();
    loadApps();
    setTimeout(loadApps, 8000); // re-fetch once Claude scoring completes
  }

  async function deleteCandidate(candidateId: string, name: string) {
    if (!candidateId) { showToast(t('missingIdWarning'), 'warning'); return; }
    showConfirm(`Supprimer définitivement ${name} ? Toutes ses candidatures seront également supprimées.`, async () => {
      setDeleting(candidateId);
      const res = await fetch(`/api/candidates/${candidateId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      setDeleting(null);
      if (!res.ok) { showToast(data.error || t('toastError')); return; }
      setSelected(prev => { const n = new Set(prev); n.delete(candidateId); return n; });
      loadApps();
  });
  }

  async function extractProfile(candidateIds: string[]) {
    if (candidateIds.length === 0) return;
    setExtracting(prev => { const s = new Set(prev); candidateIds.forEach(id => s.add(id)); return s; });
    try {
      const res = await fetch('/api/candidates/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_ids: candidateIds }),
      });
      const data = await res.json();
      if (res.ok && data.results) {
        setApps(prev => prev.map(app => {
          const found = (data.results as { id: string; current_title: string; years_experience: string }[])
            .find(r => r.id === app.candidate_id);
          if (!found) return app;
          return {
            ...app,
            current_title: found.current_title || app.current_title,
            years_experience: found.years_experience || app.years_experience,
          };
        }));
      }
    } catch (e) {
      console.error('[extractProfile]', e);
      showToast(t('toastProfileError'));
    } finally {
      setExtracting(prev => { const s = new Set(prev); candidateIds.forEach(id => s.delete(id)); return s; });
    }
  }

  async function deleteSelected() {
    showConfirm(`Supprimer définitivement ${selected.size} candidat(s) ? Cette action est irréversible.`, async () => {
      for (const id of selected) {
        await fetch(`/api/candidates/${id}`, { method: 'DELETE' });
      }
      setSelected(new Set());
      loadApps();
    });
  }

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(a => a.candidate_id)));
  }

  function sortByCol(col: string) {
    setColSort(prev => prev?.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
  }

  const filtered = apps.filter(a => {
    if (search) {
      const q = search.toLowerCase().replace(/\s/g, '');
      const phone = (a.phone || '').replace(/\s/g, '');
      const nameMatch = a.name.toLowerCase().includes(search.toLowerCase());
      const emailMatch = a.email.toLowerCase().includes(search.toLowerCase());
      const phoneMatch = phone.includes(q);
      if (!nameMatch && !emailMatch && !phoneMatch) return false;
    }
    if (filterStages.size > 0 && !filterStages.has(a.pipeline_stage ?? '')) return false;
    return true;
  });

  const sortedFiltered = colSort ? [...filtered].sort((a, b) => {
    const dir = colSort.dir === 'asc' ? 1 : -1;
    if (colSort.col === 'name')  return dir * a.name.localeCompare(b.name);
    if (colSort.col === 'score') return dir * ((a.score ?? 0) - (b.score ?? 0));
    if (colSort.col === 'stage') return dir * ((a.pipeline_stage ?? '').localeCompare(b.pipeline_stage ?? ''));
    if (colSort.col === 'date')  return dir * ((a.created_at ?? '').localeCompare(b.created_at ?? ''));
    if (colSort.col === 'job')   return dir * ((a.job_title ?? '').localeCompare(b.job_title ?? ''));
    return 0;
  }) : filtered;

  const toastStyles = {
    error:   { bg: 'bg-red-50 border-red-200',     icon: '❌', text: 'text-red-800' },
    warning: { bg: 'bg-amber-50 border-amber-200', icon: '⚠️', text: 'text-amber-800' },
    success: { bg: 'bg-emerald-50 border-emerald-200', icon: '✅', text: 'text-emerald-800' },
  };

  return (
    <div className="p-8 space-y-6">

      {/* Toast notification */}
      {toast && (() => {
        const s = toastStyles[toast.type];
        return (
          <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-5 py-4 rounded-2xl border shadow-xl max-w-md w-full ${s.bg}`}
            style={{ animation: 'slideUp .2s ease' }}>
            <span className="text-xl flex-shrink-0">{s.icon}</span>
            <p className={`text-sm font-medium flex-1 ${s.text}`}>{toast.message}</p>
            <button onClick={() => setToast(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0 text-lg leading-none">✕</button>
          </div>
        );
      })()}

      {/* Confirm modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 text-lg">🗑</div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">{t('confirmDeleteHeader')}</h3>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">{confirmModal.message}</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium">
                {t('confirmDeleteCancel')}
              </button>
              <button
                onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
                className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-xl font-semibold">
                {t('confirmDeleteOk')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ajout candidat */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={e => e.target === e.currentTarget && closeAdd()}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] flex flex-col">

            {/* ── Doublon détecté ── */}
            {duplicateId ? (
              <div className="flex flex-col items-center py-8 gap-5 text-center">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center text-3xl">⚠️</div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{t('duplicateTitle')}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    <span className="font-semibold text-gray-700">{addedName}</span> {t('duplicateMsg')}
                  </p>
                </div>
                <div className="flex flex-col gap-3 w-full">
                  <Link
                    href={`/hr/candidates/${duplicateId}`}
                    onClick={closeAdd}
                    className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                    {t('duplicateView')}
                  </Link>
                  <button onClick={closeAdd} className="w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50">
                    {t('duplicateClose')}
                  </button>
                </div>
              </div>
            ) :

            /* ── Étape 1 : saisie candidat ── */
            !addedCandidateId ? (
              <>
                <h2 className="text-lg font-bold text-gray-900 mb-1">{t('addTitle')}</h2>
                <p className="text-xs text-gray-400 mb-4">{t('addSubtitle')}</p>
                <div className="space-y-4 overflow-y-auto flex-1">

                  {/* CV — champ principal */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('addCvLabel')} <span className="text-gray-400 font-normal">{t('addCvFormats')}</span></label>
                    <div className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${addCv ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-blue-200 hover:bg-blue-50/30'}`}
                      onClick={() => document.getElementById('add-cv-input')?.click()}>
                      {addCv ? (
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-green-500 text-lg">✓</span>
                          <span className="text-green-700 text-sm font-medium">{addCv.name}</span>
                          <button type="button" onClick={e => { e.stopPropagation(); setAddCv(null); }}
                            className="ml-2 text-green-400 hover:text-emerald-400 text-xs">✕</button>
                        </div>
                      ) : (
                        <div>
                          <div className="text-2xl mb-1">📄</div>
                          <p className="text-sm text-gray-500">{t('addCvDropFull')}</p>
                          <p className="text-xs text-gray-400 mt-1">{t('addCvAutoExtract')}</p>
                        </div>
                      )}
                    </div>
                    <input id="add-cv-input" type="file" accept=".pdf,.docx" className="hidden"
                      onChange={e => setAddCv(e.target.files?.[0] || null)} />
                  </div>

                  {/* Override optionnel */}
                  <details className="group">
                    <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 select-none list-none flex items-center gap-1">
                      <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                      {t('addOverrideManual')}
                    </summary>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {[
                        { key: 'name',     label: t('addName'),  type: 'text',  placeholder: 'Prénom Nom' },
                        { key: 'email',    label: t('addEmail'), type: 'email', placeholder: 'email@exemple.com' },
                        { key: 'phone',    label: t('addPhone'), type: 'text',  placeholder: '+212 6xx xx xx xx' },
                        { key: 'linkedin', label: 'LinkedIn',    type: 'text',  placeholder: 'linkedin.com/in/...' },
                      ].map(f => (
                        <div key={f.key}>
                          <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                          <input type={f.type}
                            value={addForm[f.key as keyof AddForm]}
                            onChange={e => setAddForm(p => ({...p, [f.key]: e.target.value}))}
                            placeholder={f.placeholder}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                        </div>
                      ))}
                    </div>
                  </details>

                  {/* Prétentions */}
                  <details className="group">
                    <summary className="flex items-center justify-between cursor-pointer text-sm font-medium text-gray-700 py-2 border-t border-gray-100 select-none">
                      <span>💼 {t('addSalaryTitle')} <span className="text-gray-400 font-normal">{t('addSalaryOptional')}</span></span>
                      <span className="text-gray-400 group-open:rotate-180 transition-transform">▾</span>
                    </summary>
                    <div className="mt-3 space-y-3">
                      {/* Type contrat */}
                      <div className="grid grid-cols-2 gap-2">
                        {['CDI', 'Freelance'].map(type => (
                          <button key={type} type="button"
                            onClick={() => setAddForm(f => ({ ...f, contract_preference: type }))}
                            className={`py-2 rounded-lg border text-sm font-medium transition-all ${
                              addForm.contract_preference === type
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                : 'border-gray-200 text-gray-500'
                            }`}>
                            {type === 'CDI' ? '🏢 CDI' : '⚡ Freelance'}
                          </button>
                        ))}
                      </div>
                      {/* CDI fields */}
                      {addForm.contract_preference === 'CDI' && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">{t('addCurrentSalary')}</label>
                            <div className="relative">
                              <input type="text" value={addForm.current_salary}
                                onChange={e => setAddForm(f => ({ ...f, current_salary: e.target.value }))}
                                placeholder="45 000" className="w-full pr-10 pl-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400"></span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">{t('addDesiredSalary')}</label>
                            <div className="relative">
                              <input type="text" value={addForm.desired_salary}
                                onChange={e => setAddForm(f => ({ ...f, desired_salary: e.target.value }))}
                                placeholder="55 000" className="w-full pr-10 pl-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400"></span>
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Freelance field */}
                      {addForm.contract_preference === 'Freelance' && (
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">{t('addTjm')}</label>
                          <div className="relative max-w-xs">
                            <input type="text" value={addForm.tjm}
                              onChange={e => setAddForm(f => ({ ...f, tjm: e.target.value }))}
                              placeholder="650" className="w-full pr-14 pl-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">€/jour</span>
                          </div>
                        </div>
                      )}
                      {/* Préavis */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5">{t('addNoticePeriod')}</label>
                        <div className="flex flex-wrap gap-1.5">
                          {['Immédiat', '1 mois', '2 mois', '3 mois'].map(p => (
                            <button key={p} type="button"
                              onClick={() => setAddForm(f => ({ ...f, notice_period: p }))}
                              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                                addForm.notice_period === p
                                  ? 'bg-gray-900 text-white border-gray-900'
                                  : 'border-gray-200 text-gray-600 hover:border-gray-400'
                              }`}>{p}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </details>

                  {/* Mode rattachement */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('addAttachMode')}</label>
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        { mode: 'manual' as AttachMode, icon: '🖐', title: t('addModeManual'), desc: t('addModeManualDesc') },
                        { mode: 'auto'   as AttachMode, icon: '🤖', title: t('addModeAuto'), desc: t('addModeAutoDesc') },
                      ] as { mode: AttachMode; icon: string; title: string; desc: string }[]).map(opt => (
                        <button key={opt.mode} type="button" onClick={() => setAttachMode(opt.mode)}
                          className={`flex flex-col items-start gap-1 p-4 rounded-xl border-2 text-left transition-all ${
                            attachMode === opt.mode
                              ? opt.mode === 'auto' ? 'border-purple-500 bg-purple-50' : 'border-emerald-500 bg-emerald-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}>
                          <span className="text-xl">{opt.icon}</span>
                          <span className={`text-sm font-semibold ${attachMode === opt.mode ? (opt.mode === 'auto' ? 'text-purple-800' : 'text-emerald-800') : 'text-gray-700'}`}>
                            {opt.title}
                          </span>
                          <span className="text-xs text-gray-400 leading-tight">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Manuel : sélecteur + étape */}
                  {attachMode === 'manual' && (
                    <div className="space-y-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{t('addJobOffer')}</label>
                        <select value={addForm.job_id} onChange={e => setAddForm(f => ({...f, job_id: e.target.value}))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                          <option value="">{t('addNoOffer')}</option>
                          {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                        </select>
                      </div>
                      {addForm.job_id && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">{t('addInitialStage')}</label>
                          <div className="flex gap-2">
                            {['Nouveau', 'Présélectionné', 'Entretien'].map(s => (
                              <button key={s} type="button" onClick={() => setAddForm(f => ({...f, stage: s}))}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${addForm.stage === s ? 'bg-emerald-700 text-white border-emerald-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Auto : info */}
                  {attachMode === 'auto' && (
                    <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-xs text-purple-700 leading-relaxed">
                      🤖 {t('addAutoInfo')}
                      {!addCv && <span className="block mt-1 font-semibold text-purple-600">⚠ {t('addAutoNoCv')}</span>}
                    </div>
                  )}
                </div>

                <div className="mt-5 flex-shrink-0 space-y-2">
                  {addProgress ? (
                    <div className={`rounded-xl p-4 ${attachMode === 'auto' ? 'bg-purple-50 border border-purple-100' : 'bg-gray-50 border border-gray-100'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-medium ${attachMode === 'auto' ? 'text-purple-700' : 'text-gray-600'}`}>
                          {addProgress.label}
                        </span>
                        <span className={`text-xs font-bold ${attachMode === 'auto' ? 'text-purple-700' : 'text-gray-600'}`}>
                          {addProgress.pct}%
                        </span>
                      </div>
                      <div className="w-full bg-white rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${attachMode === 'auto' ? 'bg-purple-500' : 'bg-emerald-600'} ${addProgress.pct < 100 ? 'animate-pulse' : ''}`}
                          style={{ width: `${addProgress.pct}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <button onClick={addCandidate}
                        className={`flex-1 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                          attachMode === 'auto' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-emerald-700 hover:bg-emerald-800'
                        }`}>
                        {attachMode === 'auto' ? `🤖 ${t('addBtnAuto')}` : t('addBtnManual')}
                      </button>
                      <button onClick={closeAdd} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                        {t('addCancel')}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* ── Étape 2 : résultats matching ── */
              <>
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">🎯 {t('matchingRecommended')}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">{addedName ? `${addedName} ${t('matchingAddedMsg')}` : t('matchingAdded')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {matchResults !== null && !showJobPicker && (
                      <button onClick={() => { setMatchResults(null); setShowJobPicker(true); }}
                        className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors">
                        {t('matchingModify')}
                      </button>
                    )}
                    <button onClick={closeAdd} className="text-gray-400 hover:text-gray-600 text-xl px-2">✕</button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {/* ── Étape 2a : Sélection des offres ── */}
                  {showJobPicker ? (
                    <div className="space-y-4">
                      {/* Profil extrait du CV */}
                      <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {addedName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 text-sm">{addedName}</p>
                          {addedTitle ? (
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <p className="text-sm text-purple-700 font-medium">{addedTitle}</p>
                              {addedYears && (
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                                  🕐 {addedYears}
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 animate-pulse mt-0.5">Analyse du CV en cours…</p>
                          )}
                          {addedSkills && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {addedSkills.split(',').map(s => s.trim()).filter(Boolean).map(skill => (
                                <span key={skill} className="text-xs bg-white border border-purple-200 text-purple-700 px-2 py-0.5 rounded-full">{skill}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-gray-800 mb-1">{t('matchingSelectOffers')}</p>
                        <p className="text-xs text-gray-400">{t('matchingSelectDesc')}</p>
                      </div>

                      {/* Compteur + actions */}
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-semibold ${jobSelection.size > 10 ? 'text-emerald-600' : 'text-purple-700'}`}>
                          {jobSelection.size}/10 {t('matchingSelected')}
                        </span>
                        <div className="flex gap-2 text-xs">
                          <button onClick={() => setJobSelection(new Set((jobs as {id:string}[]).slice(0,10).map(j=>j.id)))}
                            className="text-purple-600 hover:text-purple-800 font-medium">{t('matchingTop10')}</button>
                          <span className="text-gray-300">|</span>
                          <button onClick={() => setJobSelection(new Set())}
                            className="text-gray-400 hover:text-gray-600 font-medium">{t('matchingClearSelection')}</button>
                        </div>
                      </div>

                      {/* Liste offres */}
                      <div className="border border-gray-100 rounded-xl divide-y divide-gray-50 max-h-64 overflow-y-auto">
                        {(jobs as {id:string; title:string; department?:string}[]).filter(j=>j.id).map(job => {
                          const checked = jobSelection.has(job.id);
                          const limitReached = jobSelection.size >= 10 && !checked;
                          return (
                            <label key={job.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                              checked ? 'bg-purple-50' : limitReached ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50'
                            }`}>
                              <input type="checkbox" checked={checked} disabled={limitReached}
                                onChange={() => {
                                  setJobSelection(prev => {
                                    const s = new Set(prev);
                                    checked ? s.delete(job.id) : s.add(job.id);
                                    return s;
                                  });
                                }}
                                className="w-4 h-4 accent-purple-600 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className={`text-sm font-medium truncate ${checked ? 'text-purple-900' : 'text-gray-700'}`}>{job.title}</p>
                                {job.department && <p className="text-xs text-gray-400">{job.department}</p>}
                              </div>
                            </label>
                          );
                        })}
                      </div>

                      {/* Confirmation enregistrement */}
                      <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-4 py-2.5">
                        <span className="text-green-500">✓</span>
                        <p className="text-sm text-green-700 font-medium">
                          <span className="font-bold">{addedName}</span> {t('matchingRegistered')}
                        </p>
                      </div>

                      <button onClick={runMatchingOnSelection} disabled={jobSelection.size === 0 || jobSelection.size > 10}
                        className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-colors">
                        🎯 {t('matchingLaunch')} {jobSelection.size} {jobSelection.size !== 1 ? t('matchingOffers') : t('matchingOffer')}
                      </button>

                      <button onClick={closeAdd} className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                        {t('matchingFinishNoMatch')}
                      </button>
                    </div>

                  ) : matchLoading ? (
                    <div className="text-center py-16">
                      <div className="animate-spin w-10 h-10 rounded-full mx-auto mb-4" style={{ border: '3px solid #9333ea30', borderTopColor: '#9333ea' }} />
                      <p className="text-gray-500 text-sm">{t('matchingAnalyzing')}</p>
                      <p className="text-xs text-gray-400 mt-1">{t('matchingComparison')} {jobSelection.size} {jobSelection.size !== 1 ? t('matchingOffers') : t('matchingOffer')}</p>
                    </div>
                  ) : !matchResults || matchResults.length === 0 ? (
                    <div className="flex flex-col items-center py-6 gap-5">
                      {/* Icône + message */}
                      <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center text-2xl">😶</div>
                      <div className="text-center">
                        <p className="font-semibold text-gray-800">{t('matchingNoOffers')}</p>
                        <p className="text-sm text-gray-400 mt-1">{t('matchingNoOffersDesc')}</p>
                      </div>

                      {/* Confirmation enregistrement */}
                      <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-4 py-2.5 w-full">
                        <span className="text-green-500 text-lg">✓</span>
                        <p className="text-sm text-green-700 font-medium">
                          {addedName ? <><span className="font-bold">{addedName}</span> {t('matchingRegistered')}</> : t('matchingRegisteredBase')}
                        </p>
                      </div>

                      {/* Rattachement manuel */}
                      <div className="w-full border border-gray-100 rounded-xl p-4 space-y-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('matchingManualAttach')}</p>
                        <select value={fallbackJobId} onChange={e => { setFallbackJobId(e.target.value); setFallbackScore(null); }}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-300">
                          <option value="">{t('matchingChooseOffer')}</option>
                          {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                        </select>

                        {/* Score preview */}
                        {fallbackScore && (
                          <div className={`rounded-xl p-3 border text-sm flex items-center justify-between ${
                            fallbackScore.score >= 75 ? 'bg-green-50 border-green-200' :
                            fallbackScore.score >= 45 ? 'bg-yellow-50 border-yellow-200' : 'bg-emerald-50 border-emerald-200'
                          }`}>
                            <div>
                              <span className={`font-bold text-base ${fallbackScore.score >= 75 ? 'text-green-700' : fallbackScore.score >= 45 ? 'text-yellow-700' : 'text-emerald-600'}`}>
                                {fallbackScore.score}/100
                              </span>
                              <span className={`ml-2 text-xs font-semibold ${fallbackScore.score >= 75 ? 'text-green-600' : fallbackScore.score >= 45 ? 'text-yellow-600' : 'text-emerald-500'}`}>
                                {fallbackScore.recommendation}
                              </span>
                              {fallbackScore.reason && <p className="text-xs text-gray-500 mt-1">{fallbackScore.reason}</p>}
                            </div>
                          </div>
                        )}

                        {!fallbackScore ? (
                          <button onClick={async () => {
                            if (!fallbackJobId || !addedCandidateId) return;
                            setFallbackScoring(true);
                            try {
                              const ctrl = new AbortController();
                              setTimeout(() => ctrl.abort(), 45_000);
                              const res = await fetch('/api/matching', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ type: 'candidate_to_jobs', candidate_id: addedCandidateId }),
                                signal: ctrl.signal,
                              });
                              const data = await res.json();
                              const match = (data.results || []).find((r: MatchResult) => r.job_id === fallbackJobId);
                              setFallbackScore(match ? { score: match.score, recommendation: match.recommendation, reason: match.reason } : { score: 50, recommendation: 'À évaluer', reason: '' });
                            } catch { setFallbackScore({ score: 50, recommendation: 'À évaluer', reason: '' }); }
                            setFallbackScoring(false);
                          }} disabled={!fallbackJobId || fallbackScoring}
                            className="w-full py-2.5 border-2 border-gray-200 hover:border-gray-400 disabled:opacity-40 text-gray-700 rounded-xl text-sm font-semibold transition-colors">
                            {fallbackScoring ? `🤖 ${t('matchingAnalyzing2')}` : `🔍 ${t('matchingAnalyzeCompat')}`}
                          </button>
                        ) : (
                          <button onClick={() => attachToJob(fallbackJobId, fallbackScore.score, fallbackScore.recommendation)}
                            disabled={attaching === fallbackJobId}
                            className="w-full py-2.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors">
                            {attaching === fallbackJobId ? `⏳ ${t('matchingAttaching')}` : `+ ${t('matchingConfirmAttach')}`}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {matchResults.map((r, i) => (
                        <div key={r.job_id} className={`rounded-xl border p-4 transition-all ${i === 0 ? 'border-purple-200 bg-purple-50' : 'border-gray-100 hover:border-gray-200'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${i === 0 ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                                {i + 1}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-gray-900 text-sm">{r.title}</span>
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                    r.recommendation === 'À retenir' ? 'bg-green-100 text-green-700' :
                                    r.recommendation === 'À évaluer' ? 'bg-yellow-100 text-yellow-700' : 'bg-emerald-100 text-emerald-700'
                                  }`}>{r.score}/100</span>
                                </div>
                                <p className="text-xs text-gray-400">{r.department} · {r.contract_type}</p>
                                {r.reason && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{r.reason}</p>}
                                <div className="mt-2 w-full bg-gray-100 rounded-full h-1">
                                  <div className={`h-1 rounded-full ${r.score >= 75 ? 'bg-green-500' : r.score >= 45 ? 'bg-yellow-500' : 'bg-emerald-400'}`}
                                    style={{ width: `${r.score}%` }} />
                                </div>
                              </div>
                            </div>
                            <button onClick={() => attachToJob(r.job_id, r.score, r.recommendation, r.reason)} disabled={attaching === r.job_id}
                              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                i === 0 ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                              } disabled:opacity-50`}>
                              {attaching === r.job_id ? '⏳' : t('matchingAttachBtn')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex-shrink-0">
                  <button onClick={() => { closeAdd(); loadApps(); }} className="w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                    {t('matchingFinishNoAttach')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {filtered.length !== apps.length
              ? <><span className="font-semibold text-gray-800">{filtered.length}</span> / {apps.length} {t('countSuffix')}</>
              : <>{apps.length} {t('countSuffix')}</>}
          </p>
        </div>
        {can('candidates.create') && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            + {t('add')}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input type="text" placeholder={`🔍 ${t('search')}`} value={search} onChange={e => setSearch(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <select value={filterJob} onChange={e => setFilterJob(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
            <option value="">{t('filterAllJobs')}</option>
            {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
          {/* Stage checkbox dropdown */}
          <div className="relative" data-stage-drop>
            <button
              type="button"
              onClick={() => setStageDropOpen(o => !o)}
              className={`w-full flex items-center justify-between border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white transition-colors ${filterStages.size > 0 ? 'border-emerald-400 text-emerald-700 font-medium' : 'border-gray-200 text-gray-700'}`}>
              <span>
                {filterStages.size === 0
                  ? t('filterAllStages')
                  : filterStages.size === 1
                    ? tStages(Array.from(filterStages)[0] as Parameters<typeof tStages>[0])
                    : `${filterStages.size} étapes`}
              </span>
              <span className={`ml-2 transition-transform ${stageDropOpen ? 'rotate-180' : ''} text-gray-400`}>▾</span>
            </button>
            {stageDropOpen && (
              <div className="absolute z-30 top-full mt-1 left-0 w-full bg-white border border-gray-200 rounded-xl shadow-lg py-2 min-w-[180px]">
                <div className="px-3 pb-2 flex items-center justify-between border-b border-gray-100 mb-1">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('filterByStage')}</span>
                  {filterStages.size > 0 && (
                    <button onClick={() => setFilterStages(new Set())} className="text-xs text-emerald-500 hover:text-emerald-700 font-medium">
                      {t('clearFilters')}
                    </button>
                  )}
                </div>
                {(['Nouveau','Présélectionné','Entretien','Test technique','Offre','Embauché','Rejeté'] as const).map(stage => {
                  const checked = filterStages.has(stage);
                  const color = STAGE_COLORS[stage] || 'bg-gray-100 text-gray-700';
                  return (
                    <label key={stage} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setFilterStages(prev => {
                          const s = new Set(prev);
                          checked ? s.delete(stage) : s.add(stage);
                          return s;
                        })}
                        className="w-4 h-4 rounded accent-emerald-600 flex-shrink-0"
                      />
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>{stage}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
            <option value="created_at">{t('sortByDate')}</option>
            <option value="score">{t('sortByScore')}</option>
          </select>
          <select value={sortOrder} onChange={e => setSortOrder(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
            <option value="DESC">{t('sortDesc')}</option>
            <option value="ASC">{t('sortAsc')}</option>
          </select>
        </div>
      </div>

      {/* Barre actions sélection */}
      {selected.size > 0 && (
        <div className="flex items-center gap-4 bg-emerald-50 border border-emerald-100 rounded-xl px-5 py-3 flex-wrap">
          <span className="text-sm font-medium text-emerald-700">{selected.size} {selected.size > 1 ? t('selectionCountPlural') : t('selectionCount')}</span>
          <button
            onClick={() => extractProfile(Array.from(selected))}
            disabled={extracting.size > 0}
            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors">
            {extracting.size > 0 ? '⏳' : '✨'} {t('relaunchExtraction')}
          </button>
          {can('candidates.delete') && (
            <button onClick={deleteSelected} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors">
              🗑 {t('actionsDelete')}
            </button>
          )}
          <button onClick={() => setSelected(new Set())} className="text-sm text-emerald-400 hover:text-emerald-600">{t('addCancel')}</button>
        </div>
      )}

      {/* Barre extraction manquants */}
      {selected.size === 0 && apps.some(a => !a.current_title || !a.years_experience) && (
        <div className="flex items-center gap-3 bg-purple-50 border border-purple-100 rounded-xl px-5 py-3">
          <span className="text-sm text-purple-700">
            <span className="font-semibold">{apps.filter(a => !a.current_title || !a.years_experience).length}</span> {t('extractionMissing')}
          </span>
          <button
            onClick={() => extractProfile(apps.filter(a => !a.current_title || !a.years_experience).map(a => a.candidate_id))}
            disabled={extracting.size > 0}
            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors">
            {extracting.size > 0 ? `⏳ ${extracting.size}…` : `✨ ${t('relaunchExtraction')}`}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin w-6 h-6 border-4 border-emerald-600 border-t-transparent rounded-full"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">👥</div>
            <div className="font-medium">{t('noCandidates')}</div>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-4 w-10">
                  <input type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < filtered.length; }}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded accent-emerald-600 cursor-pointer" />
                </th>
                {([
                  { key: 'name',  label: t('colCandidate') },
                  { key: 'title', label: t('colTitle') },
                  { key: 'exp',   label: t('colExperience') },
                  { key: 'job',   label: t('colJob') },
                  { key: 'score', label: t('colScore') },
                  { key: 'reco',  label: t('colReco') },
                  { key: 'stage', label: t('colStage') },
                  { key: 'date',  label: t('colDate') },
                ] as { key: string; label: string }[]).map(col => (
                  <th key={col.key} onClick={() => col.key !== 'reco' && sortByCol(col.key)}
                    className={`text-left px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide select-none ${col.key !== 'reco' ? 'cursor-pointer hover:text-gray-800' : ''}`}>
                    <span className="flex items-center gap-1">
                      {col.label}
                      {col.key !== 'reco' && (
                        <span className="text-gray-300">
                          {colSort?.col === col.key ? (colSort.dir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                        </span>
                      )}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-4 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedFiltered.map(app => (
                <tr key={app.candidate_id}
                  className={`hover:bg-gray-50 transition-colors ${selected.has(app.candidate_id) ? 'bg-emerald-50/40' : ''}`}>
                  <td className="px-4 py-4">
                    <input type="checkbox"
                      checked={selected.has(app.candidate_id)}
                      onChange={() => toggleSelect(app.candidate_id)}
                      className="w-4 h-4 rounded accent-emerald-600 cursor-pointer" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center font-semibold text-gray-700 text-sm flex-shrink-0">
                        {(app.name || app.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">{app.name || <span className="text-gray-400 italic text-xs">{t('nameExtracting')}</span>}</div>
                        <div className="text-xs text-gray-400">{app.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 max-w-[160px]">
                    {app.current_title
                      ? <span className="text-sm text-gray-700 font-medium line-clamp-2">{app.current_title}</span>
                      : extracting.has(app.candidate_id)
                        ? <span className="text-xs text-purple-500 animate-pulse">Extraction…</span>
                        : (
                          <button
                            onClick={() => extractProfile([app.candidate_id])}
                            title="Relancer l'extraction"
                            className="text-xs text-purple-400 hover:text-purple-600 flex items-center gap-1 transition-colors group">
                            <span className="group-hover:rotate-180 transition-transform duration-300 inline-block">↻</span>
                            <span className="italic text-gray-300 group-hover:text-purple-500">Extraire</span>
                          </button>
                        )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {app.years_experience
                      ? <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-1 rounded-full">🕐 {app.years_experience}</span>
                      : extracting.has(app.candidate_id)
                        ? <span className="text-xs text-purple-500 animate-pulse">…</span>
                        : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-4">
                    {app.job_title
                      ? <><div className="text-sm text-gray-700 font-medium">{app.job_title}</div>
                          <div className="text-xs text-gray-400">{app.department}</div></>
                      : <span className="text-xs text-gray-300 italic">{t('noOffer')}</span>}
                  </td>
                  <td className="px-4 py-4">
                    {app.score ? <ScoreBar score={app.score} /> : <span className="text-xs text-gray-300">–</span>}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-sm font-medium ${RECO_COLORS[app.recommendation ?? ''] || 'text-gray-400'}`}>
                      {app.recommendation || '–'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {app.pipeline_stage
                      ? <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STAGE_COLORS[app.pipeline_stage] || 'bg-gray-100 text-gray-600'}`}>
                          {app.pipeline_stage}
                        </span>
                      : <span className="text-xs text-gray-300">–</span>}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-400 whitespace-nowrap">
                    <div>{new Date(app.created_at || app.updated_at).toLocaleDateString('fr-FR')}</div>
                    <div className="text-xs text-gray-300">{new Date(app.created_at || app.updated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Link href={`/hr/candidates/${app.id ?? app.candidate_id}`} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium whitespace-nowrap">{t('view')}</Link>
                      {can('candidates.delete') && (
                        <button onClick={() => deleteCandidate(app.candidate_id, app.name)}
                          disabled={deleting === app.candidate_id}
                          className="text-gray-300 hover:text-emerald-500 transition-colors disabled:opacity-40 p-1 rounded"
                          title="Supprimer">
                          {deleting === app.candidate_id ? '⏳' : '🗑'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function CandidatesPage() {
  return (
    <Suspense>
      <CandidatesContent />
    </Suspense>
  );
}
