'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/permissions-context';
import { useTranslations } from 'next-intl';

interface AppDetail {
  id: string;
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  cv_filename: string;
  cv_text: string;
  candidate_id: string;
  job_id: string;
  job_title: string;
  department: string;
  job_description: string;
  cover_letter: string;
  score: number;
  score_summary: string;
  strengths: string;
  gaps: string;
  recommendation: string;
  pipeline_stage: string;
  created_at: string;
  current_title?: string;
  years_experience?: string;
  // Prétentions
  contract_preference: string;
  current_salary: string;
  desired_salary: string;
  tjm: string;
  notice_period: string;
  history: { id: string; from_stage: string; to_stage: string; changed_at: string }[];
  notes: { id: string; content: string; author: string; created_at: string }[];
}

const STAGES = ['Nouveau', 'Présélectionné', 'Entretien', 'Test technique', 'Offre', 'Embauché', 'Rejeté'];
const SCORE_COLOR = (s: number) => s >= 75 ? 'text-green-600' : s >= 45 ? 'text-yellow-600' : 'text-emerald-500';
const SCORE_BG = (s: number) => s >= 75 ? 'bg-green-50 border-green-200' : s >= 45 ? 'bg-yellow-50 border-yellow-200' : 'bg-emerald-50 border-emerald-200';
const RECO_COLORS: Record<string, string> = {
  'À retenir': 'bg-green-100 text-green-800 border-green-200',
  'À évaluer': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'À écarter': 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

type Tab = 'candidature' | 'analyse' | 'cv' | 'matching' | 'pretentions';

interface MatchResult {
  job_id: string; title: string; department: string; location: string;
  contract_type: string; score: number; recommendation: string; reason: string;
}

export default function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations('candidateDetail');
  const tStages = useTranslations('stages');
  const { can } = usePermissions();
  const { id } = use(params);
  const [app, setApp] = useState<AppDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [moving, setMoving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('candidature');
  const [matchResults, setMatchResults] = useState<MatchResult[] | null>(null);
  const [matching, setMatching] = useState(false);
  const [attaching, setAttaching] = useState<string | null>(null);
  const [attachingBulk, setAttachingBulk] = useState(false);
  const [attached, setAttached] = useState<Set<string>>(new Set());
  const [selectedToAttach, setSelectedToAttach] = useState<Set<string>>(new Set());
  // Job selection for matching
  const [allJobs, setAllJobs] = useState<{ id: string; title: string; department: string; contract_type: string }[]>([]);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const [pretentions, setPretentions] = useState({ contract_preference: 'CDI', current_salary: '', desired_salary: '', tjm: '', notice_period: '' });
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingPretentions, setSavingPretentions] = useState(false);
  const [savedPretentions, setSavedPretentions] = useState(false);
  const [allApplications, setAllApplications] = useState<{ id: string; job_id: string; job_title: string; department: string; pipeline_stage: string; score: number; created_at: string }[]>([]);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [cvTemplates, setCvTemplates] = useState<{ id: string; name: string; company_name: string }[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [exportFormat] = useState<'pdf' | 'docx'>('docx');
  const [exporting, setExporting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/applications/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setApp(d);
        setLoading(false);
        setActiveTab(d?.job_title ? 'candidature' : 'cv');
        if (d) {
          setPretentions({
            contract_preference: d.contract_preference || 'CDI',
            current_salary: d.current_salary || '',
            desired_salary: d.desired_salary || '',
            tjm: d.tjm || '',
            notice_period: d.notice_period || '',
          });
          // Load all applications for this candidate
          const candidateId = d.candidate_id;
          if (candidateId) {
            fetch(`/api/applications?candidate_id=${candidateId}`)
              .then(r => r.json())
              .then(list => setAllApplications(Array.isArray(list) ? list : []))
              .catch(() => {});
          }
          // Load active jobs for matching selection
          fetch('/api/jobs?status=active')
            .then(r => r.json())
            .then(list => {
              if (Array.isArray(list)) {
                setAllJobs(list.map((j: { id: string; title: string; department: string; contract_type: string }) => ({
                  id: j.id, title: j.title, department: j.department, contract_type: j.contract_type,
                })));
                setSelectedJobIds(new Set(list.map((j: { id: string }) => j.id)));
              }
              setJobsLoaded(true);
            })
            .catch(() => setJobsLoaded(true));
        }
      });
  }, [id]);

  async function savePretentions() {
    if (!app) return;
    setSavingPretentions(true);
    await fetch(`/api/candidates/${app.candidate_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pretentions),
    });
    setSavingPretentions(false);
    setSavedPretentions(true);
    setTimeout(() => setSavedPretentions(false), 2000);
  }

  async function changeStage(stage: string) {
    if (!app || moving) return;
    setMoving(true);
    await fetch(`/api/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeline_stage: stage })
    });
    const fresh = await fetch(`/api/applications/${id}`).then(r => r.json());
    setApp(fresh);
    setMoving(false);
  }

  async function submitNote() {
    if (!note.trim() || !app) return;
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ application_id: app.id, content: note, author: 'RH' })
    });
    if (res.ok) {
      const newNote = await res.json();
      setApp(prev => prev ? { ...prev, notes: [newNote, ...prev.notes] } : null);
      setNote('');
      setAddingNote(false);
    }
  }

  async function deleteApp() {
    if (!confirm(t('deleteAppConfirm'))) return;
    await fetch(`/api/applications/${id}`, { method: 'DELETE' });
    router.push('/hr/candidates');
  }

  async function deleteCandidate() {
    if (!app) return;
    if (!confirm(`${t('deleteConfirm')} ${app.name} ? ${t('deleteFullConfirm')}`)) return;
    const res = await fetch(`/api/candidates/${app.candidate_id}`, { method: 'DELETE' });
    if (res.ok) router.push('/hr/candidates');
    else alert(t('toastError'));
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full"></div>
    </div>
  );

  if (!app) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="text-4xl mb-3">😕</div>
        <div>{t('notFound')}</div>
        <Link href="/hr/candidates" className="text-emerald-600 hover:underline text-sm mt-2 block">← {t('notFoundBack')}</Link>
      </div>
    </div>
  );

  async function openExportModal() {
    if (cvTemplates.length === 0) {
      const res = await fetch('/api/cv-templates');
      if (res.ok) {
        const list = await res.json() as { id: string; name: string; company_name: string }[];
        setCvTemplates(list);
        if (list.length > 0) setSelectedTemplateId(list[0].id);
      }
    }
    setShowExportModal(true);
  }

  async function exportCV() {
    if (!app || !selectedTemplateId) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/cv-templates/${selectedTemplateId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_id: app.candidate_id, format: exportFormat }),
      });
      if (!res.ok) throw new Error(t('exportError'));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CV_${app.name.replace(/[^a-z0-9]/gi, '_')}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
      setShowExportModal(false);
    } catch {
      alert(t('exportError'));
    }
    setExporting(false);
  }

  async function runMatching(jobIdsOverride?: string[]) {
    if (!app) return;
    setMatching(true);
    setMatchError(null);
    setActiveTab('matching');
    const jobIds = jobIdsOverride ?? (selectedJobIds.size > 0 ? Array.from(selectedJobIds) : undefined);
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 60_000);
      const res = await fetch('/api/matching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'candidate_to_jobs', candidate_id: app.candidate_id, job_ids: jobIds }),
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (!res.ok) {
        setMatchError(data.error || `${t('matchingServerError')} (${res.status})`);
        setMatchResults([]);
      } else if (data.message) {
        setMatchError(data.message);
        setMatchResults([]);
      } else {
        const results: MatchResult[] = data.results || [];
        setMatchResults(results);
        if (results.length === 0) {
          setMatchError(t('matchingNoResults'));
        } else if (jobIds && jobIds.length === 1 && app.candidate_id) {
          // Single-job rerun: update the application for THAT specific job, not the currently viewed one
          const match = results.find(r => r.job_id === jobIds[0]);
          if (match) {
            const targetAppId = allApplications.find(a => a.job_id === jobIds[0])?.id;
            const appIdToUpdate = targetAppId || (app.job_id === jobIds[0] ? app.id : null);

            if (appIdToUpdate) {
              await fetch(`/api/applications/${appIdToUpdate}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  score: match.score,
                  recommendation: match.recommendation,
                  score_summary: match.reason,
                }),
              });
              // Refresh current view only if we updated the currently viewed application
              if (appIdToUpdate === app.id) {
                const fresh = await fetch(`/api/applications/${app.id}`).then(r => r.json());
                setApp(fresh);
              }
            }

            // Always refresh sidebar list
            const updatedList = await fetch(`/api/applications?candidate_id=${app.candidate_id}`).then(r => r.json()).catch(() => []);
            setAllApplications(Array.isArray(updatedList) ? updatedList : []);
          }
        }
      }
    } catch (e) {
      setMatchError(e instanceof Error ? e.message : t('matchingTimeout'));
      setMatchResults([]);
    }
    setMatching(false);
  }

  async function attachMultiple() {
    if (!app || selectedToAttach.size === 0 || !matchResults) return;
    setAttachingBulk(true);
    const toAttach = matchResults.filter(r => selectedToAttach.has(r.job_id) && !attached.has(r.job_id));
    await Promise.all(toAttach.map(r =>
      fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: app.candidate_id,
          job_id: r.job_id,
          pipeline_stage: 'Présélectionné',
          score: r.score,
          recommendation: r.recommendation,
          score_summary: r.reason || null,
        }),
      })
    ));
    setAttached(prev => { const n = new Set(prev); toAttach.forEach(r => n.add(r.job_id)); return n; });
    setSelectedToAttach(new Set());
    const updatedList = await fetch(`/api/applications?candidate_id=${app.candidate_id}`).then(r => r.json()).catch(() => []);
    setAllApplications(Array.isArray(updatedList) ? updatedList : []);
    setAttachingBulk(false);
  }

  async function attachToJob(jobId: string, score?: number, recommendation?: string, reason?: string) {
    if (!app) return;
    setAttaching(jobId);
    await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidate_id: app.candidate_id,
        job_id: jobId,
        pipeline_stage: 'Présélectionné',
        score,
        recommendation,
        score_summary: reason || null,
      }),
    });
    setAttached(prev => new Set(prev).add(jobId));
    setAttaching(null);
    // Refresh sidebar candidatures list
    fetch(`/api/applications?candidate_id=${app.candidate_id}`)
      .then(r => r.json())
      .then(list => setAllApplications(Array.isArray(list) ? list : []))
      .catch(() => {});
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'candidature',  label: t('tabApplication'),  icon: '📋' },
    { key: 'analyse',      label: t('tabAiAnalysis'),   icon: '🤖' },
    { key: 'cv',           label: t('tabExtractedCv'),  icon: '📄' },
    { key: 'matching',     label: t('tabMatchingJobs'),  icon: '🎯' },
    { key: 'pretentions',  label: t('tabSalary'),       icon: '💼' },
  ];

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/hr/dashboard" className="hover:text-gray-900">Dashboard</Link>
        <span>/</span>
        <Link href="/hr/candidates" className="hover:text-gray-900">{t('breadcrumbCandidates')}</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{app.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-2xl flex items-center justify-center font-bold text-emerald-700 text-2xl">
              {app.name.charAt(0).toUpperCase()}
            </div>
            <div>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === 'Enter') {
                        setSavingName(true);
                        await fetch(`/api/candidates/${app.candidate_id}`, {
                          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: nameInput.trim() }),
                        });
                        setApp(prev => prev ? { ...prev, name: nameInput.trim() } : null);
                        setEditingName(false); setSavingName(false);
                      }
                      if (e.key === 'Escape') setEditingName(false);
                    }}
                    className="text-xl font-bold text-gray-900 border-b-2 border-emerald-400 focus:outline-none bg-transparent w-64"
                  />
                  <button onClick={async () => {
                    setSavingName(true);
                    await fetch(`/api/candidates/${app.candidate_id}`, {
                      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: nameInput.trim() }),
                    });
                    setApp(prev => prev ? { ...prev, name: nameInput.trim() } : null);
                    setEditingName(false); setSavingName(false);
                  }} disabled={savingName} className="text-xs bg-emerald-700 text-white px-2 py-1 rounded-lg font-medium">
                    {savingName ? '…' : '✓'}
                  </button>
                  <button onClick={() => setEditingName(false)} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h1 className="text-2xl font-bold text-gray-900">{app.name}</h1>
                  <button
                    onClick={() => { setNameInput(app.name); setEditingName(true); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 p-1 rounded"
                    title={t('editName')}>
                    ✏️
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {app.current_title && (
                  <span className="text-sm text-gray-600 font-medium">{app.current_title}</span>
                )}
                {app.years_experience && (
                  <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full font-semibold">
                    🕐 {app.years_experience}
                  </span>
                )}
              </div>
              <p className="text-gray-500 text-sm mt-1">{t('candidateFor')} <span className="text-emerald-600 font-medium">{app.job_title}</span></p>
              <p className="text-gray-400 text-xs mt-0.5">{app.department} • {t('receivedOn')} {new Date(app.created_at).toLocaleDateString('fr-FR')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {can('matching.run') && (
              <button onClick={() => runMatching()} disabled={matching}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-60">
                {matching ? `⏳ ${t('aiRelaunchInProgress')}` : `🎯 ${t('matchWithJobs')}`}
              </button>
            )}
            {app.cv_filename && (
              <a href={`/api/cv/${app.candidate_id}`} download
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
                📄 CV
              </a>
            )}
            <button onClick={openExportModal}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
              📤 {t('exportCvBtn')}
            </button>
            {can('candidates.delete') && (
              <button onClick={deleteCandidate} className="text-emerald-400 hover:text-emerald-600 text-sm px-3 py-2 rounded-xl hover:bg-emerald-50 transition-colors">
                🗑 {t('deleteCandidate')}
              </button>
            )}
          </div>
        </div>

        {/* Pipeline stage */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-700 mb-3">{t('currentStage')}</p>
          <div className="flex flex-wrap gap-2">
            {STAGES.map(stage => (
              <button key={stage} onClick={() => changeStage(stage)} disabled={moving}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                  app.pipeline_stage === stage
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                    : 'text-gray-600 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50'
                } disabled:opacity-50`}>
                {stage}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left sidebar */}
        <div className="space-y-4">
          {/* Contact */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">{t('sidebarContact')}</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-gray-400">✉️</span>
                <a href={`mailto:${app.email}`} className="text-sm text-blue-600 hover:underline">{app.email}</a>
              </div>
              {app.phone && (
                <div className="flex items-center gap-3">
                  <span className="text-gray-400">📞</span>
                  <span className="text-sm text-gray-700">{app.phone}</span>
                </div>
              )}
              {app.linkedin && (
                <div className="flex items-center gap-3">
                  <span className="text-gray-400">💼</span>
                  <a href={app.linkedin} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline truncate">LinkedIn</a>
                </div>
              )}
            </div>
          </div>

          {/* Toutes les candidatures */}
          {allApplications.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center justify-between">
                <span>{t('applicationsTitle')}</span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-normal">{allApplications.length}</span>
              </h3>
              <div className="space-y-2">
                {allApplications.map(a => (
                  <div key={a.id} className={`rounded-xl border transition-all ${a.id === id ? 'border-emerald-300 bg-emerald-50' : 'border-gray-100'}`}>
                    <Link href={`/hr/candidates/${a.id}`} className="block p-3 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${a.id === id ? 'text-emerald-700' : 'text-gray-900'}`}>{a.job_title || '—'}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{a.department}</p>
                        </div>
                        {a.score > 0 && (
                          <span className={`text-xs font-bold flex-shrink-0 ${a.score >= 75 ? 'text-green-600' : a.score >= 45 ? 'text-yellow-600' : 'text-emerald-500'}`}>
                            {a.score}%
                          </span>
                        )}
                      </div>
                      <div className="mt-2">
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{a.pipeline_stage}</span>
                      </div>
                    </Link>
                    {/* Footer avec date + bouton supprimer */}
                    <div className="flex items-center justify-between px-3 pb-2 pt-1 border-t border-gray-100 mt-1">
                      <span className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                      <button
                        onClick={async () => {
                          if (!confirm(`${t('applicationDeleteConfirm')} "${a.job_title}" ?`)) return;
                          await fetch(`/api/applications/${a.id}`, { method: 'DELETE' });
                          const remaining = allApplications.filter(x => x.id !== a.id);
                          setAllApplications(remaining);
                          // Rediriger seulement si on supprime la candidature actuellement ouverte
                          if (a.id === id) {
                            const next = remaining[0];
                            router.push(next ? `/hr/candidates/${next.id}` : '/hr/candidates');
                          }
                        }}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 px-2 py-0.5 rounded-md transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        {t('applicationDelete')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Score résumé */}
          <div className={`rounded-2xl border p-5 ${SCORE_BG(app.score)}`}>
            <h3 className="font-semibold text-gray-900 mb-3">{t('scoreTitle')}</h3>
            <div className="flex items-center gap-4 mb-3">
              <div className={`text-5xl font-bold ${SCORE_COLOR(app.score)}`}>{app.score}</div>
              <div>
                <div className="text-gray-600 text-sm font-medium">/ 100</div>
                <div className={`mt-1 text-xs font-semibold px-2 py-0.5 rounded-full border inline-block ${RECO_COLORS[app.recommendation] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                  {app.recommendation || t('aiNotEvaluated')}
                </div>
              </div>
            </div>
            <div className="w-full bg-white/50 rounded-full h-2.5 mb-3">
              <div className={`h-2.5 rounded-full transition-all ${app.score >= 75 ? 'bg-green-500' : app.score >= 45 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                style={{ width: `${app.score}%` }}></div>
            </div>
            {app.score_summary && <p className="text-xs text-gray-700 leading-relaxed">{app.score_summary}</p>}
            <button onClick={() => setActiveTab('analyse')}
              className="mt-3 text-xs text-emerald-600 hover:underline font-medium">
              {t('scoreFullAnalysis')}
            </button>
          </div>

          {/* History */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">{t('pipelineHistoryTitle')}</h3>
            <div className="space-y-2">
              {app.history.map(h => (
                <div key={h.id} className="flex items-center gap-2 text-xs text-gray-600">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full flex-shrink-0"></div>
                  <span>{h.from_stage ? `${h.from_stage} → ` : ''}<strong>{h.to_stage}</strong></span>
                  <span className="text-gray-400 ml-auto">{new Date(h.changed_at).toLocaleDateString('fr-FR')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main content with tabs */}
        <div className="lg:col-span-2">
          {/* Tab bar */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex border-b border-gray-100">
              {tabs.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-5 py-4 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === tab.key
                      ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40'
                      : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`}>
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* ── Onglet Candidature ── */}
              {activeTab === 'candidature' && (
                <div className="space-y-6">
                  {app.cover_letter ? (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">{t('coverLetter')}</h3>
                      <div className="bg-gray-50 rounded-xl p-5 text-gray-700 text-sm leading-relaxed whitespace-pre-line border border-gray-100">
                        {app.cover_letter}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      <div className="text-3xl mb-2">✉️</div>
                      {t('noCoverLetter')}
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900">{t('notesAndComments')}</h3>
                      <button onClick={() => setAddingNote(!addingNote)}
                        className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors font-medium">
                        {addingNote ? t('cancelNote') : t('addNoteBtn')}
                      </button>
                    </div>

                    {addingNote && (
                      <div className="mb-4 p-4 bg-gray-50 rounded-xl">
                        <textarea value={note} onChange={e => setNote(e.target.value)}
                          rows={3} placeholder={t('noteCommentPlaceholder')}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none bg-white" />
                        <div className="flex justify-end gap-2 mt-2">
                          <button onClick={submitNote} disabled={!note.trim()}
                            className="bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-800 disabled:opacity-50 transition-colors">
                            {t('saveNote')}
                          </button>
                        </div>
                      </div>
                    )}

                    {app.notes.length === 0 && !addingNote ? (
                      <div className="text-center text-gray-400 text-sm py-6">{t('noNotes')}</div>
                    ) : (
                      <div className="space-y-3">
                        {app.notes.map(n => (
                          <div key={n.id} className="p-4 bg-gray-50 rounded-xl">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-gray-600">{n.author}</span>
                              <span className="text-xs text-gray-400">{new Date(n.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-sm text-gray-700 leading-relaxed">{n.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Onglet Analyse IA ── */}
              {activeTab === 'analyse' && (
                <div className="space-y-5">
                  {/* Score global */}
                  <div className={`rounded-xl border p-5 ${SCORE_BG(app.score)}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-gray-900">{t('aiGlobalScore')}</span>
                      <span className={`text-3xl font-bold ${SCORE_COLOR(app.score)}`}>{app.score}/100</span>
                    </div>
                    <div className="w-full bg-white/60 rounded-full h-3 mb-3">
                      <div className={`h-3 rounded-full transition-all ${app.score >= 75 ? 'bg-green-500' : app.score >= 45 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                        style={{ width: `${app.score}%` }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold px-3 py-1 rounded-full border ${RECO_COLORS[app.recommendation] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                        {app.recommendation || t('aiNotEvaluated')}
                      </span>
                    </div>
                  </div>

                  {/* Barème */}
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('aiRatingScale')}</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: t('aiSkills'), weight: 35 },
                        { label: t('aiExperience'), weight: 30 },
                        { label: t('aiEducation'), weight: 20 },
                        { label: t('aiSector'), weight: 15 },
                      ].map(item => (
                        <div key={item.label} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                          <span className="text-xs text-gray-600">{item.label}</span>
                          <span className="text-xs font-bold text-gray-800">{item.weight}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Synthèse */}
                  {app.score_summary && (
                    <div className="bg-white rounded-xl border border-gray-100 p-5">
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <span>📝</span> {t('aiSynthesis')}
                      </h4>
                      <p className="text-sm text-gray-700 leading-relaxed">{app.score_summary}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Points forts */}
                    {app.strengths && (
                      <div className="bg-green-50 border border-green-100 rounded-xl p-5">
                        <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2 text-sm">
                          <span>✅</span> {t('aiStrengths')}
                        </h4>
                        <p className="text-sm text-green-900 leading-relaxed">{app.strengths}</p>
                      </div>
                    )}

                    {/* Lacunes */}
                    {app.gaps && (
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5">
                        <h4 className="font-semibold text-emerald-800 mb-2 flex items-center gap-2 text-sm">
                          <span>⚠️</span> {t('aiWatchPoints')}
                        </h4>
                        <p className="text-sm text-emerald-900 leading-relaxed">{app.gaps}</p>
                      </div>
                    )}
                  </div>

                  {!app.score_summary && app.score > 0 && (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
                      <span className="text-xl flex-shrink-0">💡</span>
                      <div>
                        <p className="text-sm font-semibold text-amber-800">{t('aiSynthesisUnavailable')}</p>
                        <p className="text-xs text-amber-700 mt-0.5">{t('aiSynthesisUnavailableDesc')}</p>
                        <button onClick={() => runMatching(app.job_id ? [app.job_id] : undefined)} disabled={matching}
                          className="mt-2 text-xs bg-amber-700 hover:bg-amber-800 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50">
                          {matching ? `⏳ ${t('aiRelaunchInProgress')}` : `🔄 ${t('aiRelaunchMatching')}`}
                        </button>
                      </div>
                    </div>
                  )}
                  {!app.score_summary && app.score === 0 && (
                    <div className="text-center py-10 text-gray-400">
                      <div className="text-4xl mb-3">🤖</div>
                      <p className="text-sm">{t('aiNoAnalysis')}</p>
                      <p className="text-xs mt-1">{t('aiNoAnalysisDesc')}</p>
                    </div>
                  )}

                  {/* Poste ciblé */}
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                    <h4 className="font-semibold text-blue-900 mb-2 text-sm flex items-center gap-2">
                      <span>🎯</span> {t('aiEvaluatedJob')}
                    </h4>
                    <p className="text-sm font-medium text-blue-800">{app.job_title}</p>
                    <p className="text-xs text-blue-600 mt-1">{app.department}</p>
                  </div>
                </div>
              )}

              {/* ── Onglet Matching offres ── */}
              {activeTab === 'matching' && (
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="font-semibold text-gray-900">{t('matchingActive')}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">{t('matchingActiveSubtitle')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {matchResults !== null && (
                        <button onClick={() => setMatchResults(null)}
                          className="text-xs text-gray-400 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                          {t('matchingChangeSelection')}
                        </button>
                      )}
                      <button onClick={() => runMatching()} disabled={matching || selectedJobIds.size === 0}
                        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-60">
                        {matching ? `⏳ ${t('aiRelaunchInProgress')}` : `🔄 ${t('matchingRelaunch')} (${selectedJobIds.size})`}
                      </button>
                    </div>
                  </div>

                  {matching ? (
                    <div className="text-center py-16">
                      <div className="animate-spin w-10 h-10 rounded-full mx-auto mb-4" style={{ border: '3px solid #9333ea30', borderTopColor: '#9333ea' }} />
                      <p className="text-gray-500 text-sm">{t('matchingAnalyzing')}</p>
                    </div>
                  ) : matchResults === null ? (
                    <div className="space-y-4">
                      {/* Header sélection */}
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-500">
                          <span className="font-semibold text-gray-800">{selectedJobIds.size}</span> {t('matchingSelectedOf')} {allJobs.length}
                        </p>
                        <div className="flex gap-2">
                          <button onClick={() => setSelectedJobIds(new Set(allJobs.map(j => j.id)))}
                            className="text-xs text-purple-600 hover:text-purple-800 font-medium">{t('matchingSelectAll')}</button>
                          <span className="text-gray-300">|</span>
                          <button onClick={() => setSelectedJobIds(new Set())}
                            className="text-xs text-gray-400 hover:text-gray-600 font-medium">{t('matchingDeselectAll')}</button>
                        </div>
                      </div>

                      {/* Liste des offres avec checkboxes */}
                      <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50 max-h-72 overflow-y-auto">
                        {allJobs.map(job => {
                          const checked = selectedJobIds.has(job.id);
                          return (
                            <label key={job.id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${checked ? 'bg-purple-50' : 'hover:bg-gray-50'}`}>
                              <input type="checkbox" checked={checked}
                                onChange={() => setSelectedJobIds(prev => {
                                  const s = new Set(prev);
                                  checked ? s.delete(job.id) : s.add(job.id);
                                  return s;
                                })}
                                className="w-4 h-4 accent-purple-600 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className={`text-sm font-medium truncate ${checked ? 'text-purple-900' : 'text-gray-700'}`}>{job.title}</p>
                                <p className="text-xs text-gray-400">{job.department} · {job.contract_type}</p>
                              </div>
                            </label>
                          );
                        })}
                        {allJobs.length === 0 && (
                          <p className="text-center text-sm text-gray-400 py-8">{t('matchingNoActiveJobs')}</p>
                        )}
                      </div>

                      {/* Bouton lancer */}
                      <button onClick={() => runMatching()} disabled={selectedJobIds.size === 0 || !jobsLoaded}
                        className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-colors">
                        🎯 {t('matchingLaunch')} {selectedJobIds.size}
                      </button>
                    </div>
                  ) : matchResults.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-3xl mb-3">😕</div>
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        {matchError ? t('matchingError') : t('matchingNoResults')}
                      </p>
                      {matchError && (
                        <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2 max-w-sm mx-auto mb-3">{matchError}</p>
                      )}
                      {!matchError && <p className="text-xs text-gray-400">{t('matchingNoActiveOffers')}</p>}
                      {!app.cv_text && (
                        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2 max-w-sm mx-auto mt-2">
                          ⚠️ {t('matchingNoCvText')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Bulk action bar */}
                      {selectedToAttach.size > 0 && (
                        <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-xl px-4 py-2.5">
                          <span className="text-sm text-purple-700 font-medium">
                            {selectedToAttach.size} {t('matchingSelected')}
                          </span>
                          <button
                            onClick={attachMultiple}
                            disabled={attachingBulk}
                            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                            {attachingBulk ? '⏳' : '＋'} {t('matchingAttachSelected')} ({selectedToAttach.size})
                          </button>
                        </div>
                      )}

                      {matchResults.map((r, i) => {
                        const isAttached = attached.has(r.job_id);
                        const isSelected = selectedToAttach.has(r.job_id);
                        return (
                        <div key={r.job_id} className={`rounded-xl border p-4 transition-all ${
                          isSelected ? 'border-purple-300 bg-purple-50' :
                          i === 0 ? 'border-purple-200 bg-purple-50/50' : 'border-gray-100 bg-white'
                        }`}>
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              {/* Checkbox (only for non-attached) */}
                              {!isAttached ? (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={e => {
                                    setSelectedToAttach(prev => {
                                      const n = new Set(prev);
                                      e.target.checked ? n.add(r.job_id) : n.delete(r.job_id);
                                      return n;
                                    });
                                  }}
                                  className="mt-1 w-4 h-4 rounded accent-purple-600 flex-shrink-0 cursor-pointer"
                                />
                              ) : (
                                <div className="w-4 h-4 mt-1 flex-shrink-0" />
                              )}
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                                {i + 1}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-gray-900 text-sm">{r.title}</span>
                                  <span className="text-xs text-gray-400">{r.department}</span>
                                  {r.contract_type && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{r.contract_type}</span>}
                                </div>
                                {r.reason && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{r.reason}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <div className="text-right">
                                <div className={`text-xl font-bold ${
                                  r.recommendation === 'À retenir' ? 'text-green-600' :
                                  r.recommendation === 'À évaluer' ? 'text-yellow-600' : 'text-emerald-500'
                                }`}>
                                  {r.score}/100
                                </div>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                  r.recommendation === 'À retenir' ? 'bg-green-100 text-green-700' :
                                  r.recommendation === 'À évaluer' ? 'bg-yellow-100 text-yellow-700' : 'bg-emerald-100 text-emerald-700'
                                }`}>{r.recommendation}</span>
                              </div>
                              {isAttached ? (
                                <div className="flex flex-col items-center gap-1">
                                  <span className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-green-100 text-green-700">
                                    ✓ {t('matchingAttached')}
                                  </span>
                                  <button
                                    onClick={() => runMatching([r.job_id])}
                                    disabled={matching}
                                    className="text-xs text-gray-400 hover:text-purple-600 px-2 py-0.5 rounded hover:bg-purple-50 transition-colors disabled:opacity-40">
                                    {matching ? '⏳' : `🔄 ${t('matchingRelaunchScore')}`}
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => attachToJob(r.job_id, r.score, r.recommendation, r.reason)} disabled={attaching === r.job_id}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                                    i === 0 ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                  }`}>
                                  {attaching === r.job_id ? '⏳' : `＋ ${t('matchingAttach')}`}
                                </button>
                              )}
                            </div>
                          </div>
                          {/* Score bar */}
                          <div className="mt-3 w-full bg-gray-100 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${
                              r.recommendation === 'À retenir' ? 'bg-green-500' :
                              r.recommendation === 'À évaluer' ? 'bg-yellow-500' : 'bg-emerald-400'
                            }`}
                              style={{ width: `${r.score}%` }} />
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Onglet Prétentions ── */}
              {activeTab === 'pretentions' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{t('salaryTitle')}</h3>
                    <p className="text-xs text-gray-400">{t('salarySubtitle')}</p>
                  </div>

                  {/* Type de contrat */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">{t('salaryContractType')}</label>
                    <div className="grid grid-cols-2 gap-3">
                      {['CDI', 'Freelance'].map(type => (
                        <button key={type} type="button"
                          onClick={() => setPretentions(p => ({ ...p, contract_preference: type }))}
                          className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-medium text-sm transition-all ${
                            pretentions.contract_preference === type
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                              : 'border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}>
                          <span>{type === 'CDI' ? '🏢' : '⚡'}</span>
                          <span>{type}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* CDI */}
                  {pretentions.contract_preference === 'CDI' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{t('salaryCurrentLabel')}</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={pretentions.current_salary}
                            onChange={e => setPretentions(p => ({ ...p, current_salary: e.target.value }))}
                            placeholder="Ex : 45 000"
                            className="w-full pl-3 pr-10 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium"></span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{t('salaryDesiredLabel')}</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={pretentions.desired_salary}
                            onChange={e => setPretentions(p => ({ ...p, desired_salary: e.target.value }))}
                            placeholder="Ex : 55 000"
                            className="w-full pl-3 pr-10 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium"></span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Freelance */}
                  {pretentions.contract_preference === 'Freelance' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{t('salaryTjmLabel')}</label>
                      <div className="relative max-w-xs">
                        <input
                          type="text"
                          value={pretentions.tjm}
                          onChange={e => setPretentions(p => ({ ...p, tjm: e.target.value }))}
                          placeholder="Ex : 650"
                          className="w-full pl-3 pr-14 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">€/jour</span>
                      </div>
                    </div>
                  )}

                  {/* Préavis */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">{t('salaryNoticeLabel')}</label>
                    <div className="flex flex-wrap gap-2">
                      {['Immédiat', '1 mois', '2 mois', '3 mois', '6 mois'].map(p => (
                        <button key={p} type="button"
                          onClick={() => setPretentions(prev => ({ ...prev, notice_period: p }))}
                          className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                            pretentions.notice_period === p
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'border-gray-200 text-gray-600 hover:border-gray-400'
                          }`}>
                          {p}
                        </button>
                      ))}
                      <input
                        type="text"
                        value={['Immédiat', '1 mois', '2 mois', '3 mois', '6 mois'].includes(pretentions.notice_period) ? '' : pretentions.notice_period}
                        onChange={e => setPretentions(prev => ({ ...prev, notice_period: e.target.value }))}
                        placeholder={t('salaryNoticePlaceholder')}
                        className="px-4 py-2 rounded-xl text-sm border border-dashed border-gray-300 text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 w-28"
                      />
                    </div>
                  </div>

                  {/* Résumé */}
                  {(pretentions.current_salary || pretentions.desired_salary || pretentions.tjm || pretentions.notice_period) && (
                    <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('salaryResumeSectionTitle')}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                          <p className="text-xs text-gray-400">{t('salaryResumeContract')}</p>
                          <p className="text-sm font-semibold text-gray-900">{pretentions.contract_preference}</p>
                        </div>
                        {pretentions.contract_preference === 'CDI' && pretentions.current_salary && (
                          <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                            <p className="text-xs text-gray-400">{t('salaryResumeCurrentSalary')}</p>
                            <p className="text-sm font-semibold text-gray-900">{pretentions.current_salary} </p>
                          </div>
                        )}
                        {pretentions.contract_preference === 'CDI' && pretentions.desired_salary && (
                          <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                            <p className="text-xs text-gray-400">{t('salaryResumeDesiredSalary')}</p>
                            <p className="text-sm font-semibold text-green-700">{pretentions.desired_salary} </p>
                          </div>
                        )}
                        {pretentions.contract_preference === 'Freelance' && pretentions.tjm && (
                          <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                            <p className="text-xs text-gray-400">{t('salaryResumeTjm')}</p>
                            <p className="text-sm font-semibold text-green-700">{pretentions.tjm} €/jour</p>
                          </div>
                        )}
                        {pretentions.notice_period && (
                          <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                            <p className="text-xs text-gray-400">{t('salaryResumeNotice')}</p>
                            <p className="text-sm font-semibold text-gray-900">{pretentions.notice_period}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Bouton sauvegarde */}
                  <div className="flex justify-end">
                    <button onClick={savePretentions} disabled={savingPretentions}
                      className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        savedPretentions
                          ? 'bg-green-600 text-white'
                          : 'bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-50'
                      }`}>
                      {savingPretentions ? `⏳ ${t('salarySaving')}` : savedPretentions ? `✓ ${t('salarySaved')}` : `💾 ${t('salarySaveBtn')}`}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Onglet CV Extrait ── */}
              {activeTab === 'cv' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">{t('cvExtractedTitle')}</h3>
                      {app.cv_filename && (
                        <p className="text-xs text-gray-400 mt-0.5">{t('cvFile')} {app.cv_filename}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {app.cv_text && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                          {app.cv_text.length.toLocaleString()} {t('cvCharacters')}
                        </span>
                      )}
                      {app.cv_filename && (
                        <a href={`/api/cv/${app.candidate_id}`} download
                          className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1.5 rounded-lg font-medium transition-colors">
                          {t('cvDownload')}
                        </a>
                      )}
                    </div>
                  </div>

                  {app.cv_text && app.cv_text.trim().length > 10 ? (
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 max-h-[600px] overflow-y-auto">
                      <pre className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-mono">
                        {app.cv_text}
                      </pre>
                    </div>
                  ) : (
                    <div className="text-center py-14 text-gray-400">
                      <div className="text-4xl mb-3">📄</div>
                      <p className="text-sm font-medium text-gray-500">
                        {app.cv_filename
                          ? t('cvScanned')
                          : t('cvNoFile')}
                      </p>
                      <p className="text-xs mt-2 text-gray-400">
                        {app.cv_filename
                          ? t('cvScannedDesc')
                          : t('cvNoFileDesc')}
                      </p>
                      {app.cv_filename && (
                        <a href={`/api/cv/${app.candidate_id}`} download
                          className="inline-block mt-4 text-sm bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors">
                          📄 {t('cvDownloadOriginal')}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Export CV Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">{t('exportTitle')}</h3>
              <button onClick={() => setShowExportModal(false)}
                className="text-gray-400 hover:text-gray-700 text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">×</button>
            </div>
            <div className="p-5 space-y-4">
              {/* Template selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('exportTemplateLabel')}</label>
                {cvTemplates.length === 0 ? (
                  <div className="text-sm text-gray-500 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2.5">
                    {t('exportNoTemplate')}{' '}
                    <a href="/hr/cv-templates" className="text-emerald-600 hover:underline font-medium">{t('exportCreateTemplate')}</a>
                  </div>
                ) : (
                  <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    {cvTemplates.map(tpl => (
                      <option key={tpl.id} value={tpl.id}>{tpl.name}{tpl.company_name ? ` — ${tpl.company_name}` : ''}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Format — DOCX only (PDF generation disabled) */}
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
                📘 {t('exportFormatWord')}
              </div>
            </div>
            <div className="flex items-center gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setShowExportModal(false)}
                className="flex-1 py-2.5 text-sm text-gray-600 font-medium rounded-xl hover:bg-gray-100 transition-colors">
                {t('exportCancel')}
              </button>
              <button onClick={exportCV} disabled={exporting || !selectedTemplateId || cvTemplates.length === 0}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                {exporting ? `⏳ ${t('exportSubmitting')}` : `⬇ ${t('exportSubmit')}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
