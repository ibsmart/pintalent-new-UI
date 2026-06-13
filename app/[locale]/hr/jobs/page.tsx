'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePermissions } from '@/lib/permissions-context';
import { useTranslations } from 'next-intl';

interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  contract_type: string;
  experience: string;
  status: string;
  application_count: number;
  avg_score: number;
  created_at: string;
}

const DEPARTMENTS = ['Data & BI', 'Digital', 'Innovation', 'Opérations Bancaires', 'Monétique', 'Crédits', 'Risques & Conformité', 'Produits Bancaires', 'Marchés Financiers', 'Finance', 'Commercial', 'Paiements', 'Ressources Humaines', 'IT & Support'];

interface JobFormData {
  title: string;
  department: string;
  location: string;
  contract_type: string;
  experience: string;
  education: string;
  description: string;
  missions: string;
  profile: string;
  keywords: string;
  status: string;
}

interface ParsedJob {
  title: string;
  department: string;
  location: string;
  contract_type: string;
  experience: string;
  education: string;
  description: string;
  missions: string;
  profile: string;
  keywords: string;
}

const EMPTY_FORM: JobFormData = {
  title: '', department: 'IT & Support', location: 'Casablanca',
  contract_type: 'CDI', experience: '', education: '',
  description: '', missions: '', profile: '', keywords: '', status: 'active'
};

export default function JobsPage() {
  const t = useTranslations('jobs');
  const { can } = usePermissions();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [form, setForm] = useState<JobFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState('');

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDragging, setImportDragging] = useState(false);
  const [importParsing, setImportParsing] = useState(false);
  const [importPreview, setImportPreview] = useState<ParsedJob[] | null>(null);
  const [importCapped, setImportCapped] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSaving, setImportSaving] = useState(false);
  const [importSuccess, setImportSuccess] = useState(0);
  const [editingPreviewIdx, setEditingPreviewIdx] = useState<number | null>(null);
  const [editingPreviewForm, setEditingPreviewForm] = useState<ParsedJob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Matching state
  const [matchingJobId, setMatchingJobId] = useState<string | null>(null);
  const [matchingJobTitle, setMatchingJobTitle] = useState('');
  const [matchResults, setMatchResults] = useState<{ candidate_id: string; name: string; email: string; score: number; recommendation: string; reason: string }[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [attachingIds, setAttachingIds] = useState<Set<string>>(new Set());
  const [attachedIds, setAttachedIds] = useState<Set<string>>(new Set());

  async function attachCandidate(candidateId: string, score: number, recommendation: string) {
    if (!matchingJobId) return;
    setAttachingIds(prev => new Set(prev).add(candidateId));
    try {
      await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: candidateId,
          job_id: matchingJobId,
          pipeline_stage: 'Présélectionné',
          score,
          recommendation,
        }),
      });
      setAttachedIds(prev => new Set(prev).add(candidateId));
    } finally {
      setAttachingIds(prev => { const s = new Set(prev); s.delete(candidateId); return s; });
    }
  }

  async function runMatching(jobId: string, jobTitle: string) {
    setMatchingJobId(jobId); setMatchingJobTitle(jobTitle); setMatchResults([]);
    setMatchLoading(true); setAttachedIds(new Set()); setAttachingIds(new Set());
    const res = await fetch('/api/matching', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'job_to_candidates', job_id: jobId }),
    });
    const data = await res.json();
    setMatchResults(data.results || []);
    setMatchLoading(false);
  }

  function loadJobs() {
    fetch('/api/jobs?status=all')
      .then(r => r.json())
      .then(data => { setJobs(data); setLoading(false); });
  }

  useEffect(() => { loadJobs(); }, []);

  async function generateWithAI() {
    if (!form.title.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/jobs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          department: form.department,
          location: form.location,
          contract_type: form.contract_type,
          experience: form.experience,
          education: form.education,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setForm(f => ({
          ...f,
          description: data.description || f.description,
          missions: data.missions || f.missions,
          profile: data.profile || f.profile,
          keywords: data.keywords || f.keywords,
        }));
      }
    } catch (e) {
      console.error('Generate error:', e);
    }
    setGenerating(false);
  }

  function openNew() { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); }

  function openEdit(job: Job) {
    setEditing(job);
    fetch(`/api/jobs/${job.id}`).then(r => r.json()).then(data => {
      setForm({
        title: data.title, department: data.department, location: data.location,
        contract_type: data.contract_type, experience: data.experience || '',
        education: data.education || '', description: data.description || '',
        missions: data.missions || '', profile: data.profile || '',
        keywords: data.keywords || '', status: data.status
      });
      setShowForm(true);
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editing) {
        await fetch(`/api/jobs/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      } else {
        await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      }
      setShowForm(false);
      loadJobs();
    } finally { setSaving(false); }
  }

  async function toggleStatus(job: Job) {
    await fetch(`/api/jobs/${job.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: job.status === 'active' ? 'inactive' : 'active' }) });
    loadJobs();
  }

  async function deleteJob(job: Job) {
    if (!confirm(`${t('deleteConfirm')} "${job.title}" ?`)) return;
    await fetch(`/api/jobs/${job.id}`, { method: 'DELETE' });
    loadJobs();
  }

  function openImport() {
    setImportFile(null); setImportPreview(null); setImportError('');
    setImportSuccess(0); setImportCapped(false); setShowImport(true);
  }

  function handleImportFileDrop(f: File) {
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    if (!['xlsx', 'xls', 'docx', 'doc'].includes(ext)) {
      setImportError(t('importFormatError')); return;
    }
    setImportError(''); setImportPreview(null); setImportFile(f);
  }

  async function parseAndGenerate() {
    if (!importFile) return;
    setImportParsing(true); setImportError(''); setImportPreview(null);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const res = await fetch('/api/jobs/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setImportError(data.error || t('importAnalysisError')); return; }
      setImportPreview(data.jobs);
      setImportCapped(!!data.capped);
    } catch {
      setImportError(t('importNetworkError'));
    } finally {
      setImportParsing(false);
    }
  }

  async function confirmImport() {
    if (!importPreview) return;
    setImportSaving(true);
    try {
      const res = await fetch('/api/jobs/import?mode=save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobs: importPreview }),
      });
      const data = await res.json();
      if (!res.ok) { setImportError(data.error || t('importError')); return; }
      setImportSuccess(data.inserted);
      setImportPreview(null); setImportFile(null);
      loadJobs();
    } catch {
      setImportError(t('importNetworkError'));
    } finally {
      setImportSaving(false);
    }
  }

  function startEditPreview(idx: number) {
    setEditingPreviewIdx(idx);
    setEditingPreviewForm({ ...importPreview![idx] });
  }

  function saveEditPreview() {
    if (editingPreviewIdx === null || !editingPreviewForm || !importPreview) return;
    const updated = [...importPreview];
    updated[editingPreviewIdx] = editingPreviewForm;
    setImportPreview(updated);
    setEditingPreviewIdx(null);
    setEditingPreviewForm(null);
  }

  const filtered = search
    ? jobs.filter(j => j.title.toLowerCase().includes(search.toLowerCase()) || j.department.toLowerCase().includes(search.toLowerCase()))
    : jobs;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500 text-sm mt-1">{jobs.filter(j => j.status === 'active').length} {t('activeOn')} {jobs.length}</p>
        </div>
        <div className="flex items-center gap-3">
          {can('jobs.create') && (
            <button onClick={openImport}
              className="border border-gray-200 bg-white text-gray-700 px-5 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm">
              📥 {t('import')}
            </button>
          )}
          {can('jobs.create') && (
            <button onClick={openNew}
              className="bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-emerald-800 transition-colors flex items-center gap-2 text-sm">
              {t('add')}
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <input type="text" placeholder={`🔍 ${t('search')}`} value={search} onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>

      {/* Jobs table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin w-6 h-6 border-4 border-emerald-600 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('colJob')}</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('colDept')}</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('colContract')}</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('colApplications')}</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('colStatus')}</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(job => (
                <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-900 text-sm">{job.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">📍 {job.location} {job.experience && `• ${job.experience}`}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{job.department}</td>
                  <td className="px-6 py-4"><span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full">{job.contract_type}</span></td>
                  <td className="px-6 py-4">
                    <Link href={`/hr/candidates?job_id=${job.id}`} className="flex items-center gap-2 hover:text-emerald-700">
                      <span className="text-lg font-bold text-gray-900">{job.application_count}</span>
                      {job.application_count > 0 && <span className="text-xs text-gray-400">{t('avgShort')} {job.avg_score}/100</span>}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <button onClick={() => toggleStatus(job)}
                      className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors ${job.status === 'active' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
                      {job.status === 'active' ? `● ${t('statusActive')}` : `○ ${t('statusInactive')}`}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {can('matching.run') && (
                        <button onClick={() => runMatching(job.id, job.title)}
                          title="Matcher avec les candidats en base"
                          className="text-sm text-purple-500 hover:text-purple-700 px-2 py-1 rounded hover:bg-purple-50">🎯</button>
                      )}
                      {can('jobs.create') && (
                        <button onClick={() => openEdit(job)} className="text-sm text-gray-500 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100">✏️</button>
                      )}
                      {can('jobs.delete') && (
                        <button onClick={() => deleteJob(job)} className="text-sm text-gray-400 hover:text-emerald-600 px-2 py-1 rounded hover:bg-emerald-50">🗑</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ===== MATCHING MODAL ===== */}
      {matchingJobId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={e => e.target === e.currentTarget && setMatchingJobId(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">🎯 {t('matchingTitle')} — {matchingJobTitle}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{t('matchingSubtitle')}</p>
              </div>
              <button onClick={() => setMatchingJobId(null)} className="text-gray-400 hover:text-gray-600 text-xl px-2">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {matchLoading ? (
                <div className="text-center py-16">
                  <div className="animate-spin w-10 h-10 rounded-full mx-auto mb-4" style={{ border: '3px solid #9333ea30', borderTopColor: '#9333ea' }} />
                  <p className="text-gray-500 text-sm">{t('matchingAnalyzing')}</p>
                </div>
              ) : matchResults.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-3">👥</div>
                  <p className="text-sm">{t('matchingNoResults')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {matchResults.map((r, i) => (
                    <div key={r.candidate_id} className={`rounded-xl border p-4 ${i === 0 ? 'border-purple-200 bg-purple-50' : 'border-gray-100'}`}>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                            {i + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 text-sm">{r.name}</div>
                            <div className="text-xs text-gray-400">{r.email}</div>
                            {r.reason && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{r.reason}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-right">
                            <div className={`text-xl font-bold ${r.score >= 75 ? 'text-green-600' : r.score >= 45 ? 'text-yellow-600' : 'text-emerald-500'}`}>{r.score}/100</div>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              r.recommendation === 'À retenir' ? 'bg-green-100 text-green-700' :
                              r.recommendation === 'À évaluer' ? 'bg-yellow-100 text-yellow-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>{r.recommendation}</span>
                          </div>
                          {attachedIds.has(r.candidate_id) ? (
                            <div className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-semibold">
                              ✓ {t('matchingAttached')}
                            </div>
                          ) : (
                            <button
                              onClick={() => attachCandidate(r.candidate_id, r.score, r.recommendation)}
                              disabled={attachingIds.has(r.candidate_id)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
                            >
                              {attachingIds.has(r.candidate_id) ? '⏳' : t('matchingAttach')}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${r.score >= 75 ? 'bg-green-500' : r.score >= 45 ? 'bg-yellow-500' : 'bg-emerald-400'}`}
                          style={{ width: `${r.score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== IMPORT MODAL ===== */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{t('importTitle')}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{t('importAiSubtitle')}</p>
              </div>
              <button onClick={() => setShowImport(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="p-6 space-y-5">

              {/* Success screen */}
              {importSuccess > 0 ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">{importSuccess} {t('importSuccessMsg')}</p>
                  <button onClick={() => setShowImport(false)} className="mt-6 bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-emerald-800 text-sm">{t('importClose')}</button>
                </div>

              ) : editingPreviewIdx !== null && editingPreviewForm ? (
                /* ---- Edit single job in preview ---- */
                <div className="space-y-4">
                  <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
                    <button onClick={() => { setEditingPreviewIdx(null); setEditingPreviewForm(null); }}
                      className="text-sm text-gray-500 hover:text-gray-700">← {t('importBack')}</button>
                    <h3 className="font-semibold text-gray-900">{t('formEditInline')} {editingPreviewForm.title}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">{t('formTitle')}</label>
                      <input value={editingPreviewForm.title} onChange={e => setEditingPreviewForm(f => f && ({...f, title: e.target.value}))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{t('formDept')}</label>
                      <select value={editingPreviewForm.department} onChange={e => setEditingPreviewForm(f => f && ({...f, department: e.target.value}))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                        {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{t('formLocation')}</label>
                      <input value={editingPreviewForm.location} onChange={e => setEditingPreviewForm(f => f && ({...f, location: e.target.value}))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{t('formContract')}</label>
                      <select value={editingPreviewForm.contract_type} onChange={e => setEditingPreviewForm(f => f && ({...f, contract_type: e.target.value}))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                        <option>CDI</option><option>CDD</option><option>Stage</option><option>Freelance</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{t('formExperience')}</label>
                      <input value={editingPreviewForm.experience} onChange={e => setEditingPreviewForm(f => f && ({...f, experience: e.target.value}))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{t('formEducation')}</label>
                      <input value={editingPreviewForm.education} onChange={e => setEditingPreviewForm(f => f && ({...f, education: e.target.value}))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">{t('formDescription')}</label>
                      <textarea value={editingPreviewForm.description} onChange={e => setEditingPreviewForm(f => f && ({...f, description: e.target.value}))}
                        rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">{t('formMissions')}</label>
                      <textarea value={editingPreviewForm.missions} onChange={e => setEditingPreviewForm(f => f && ({...f, missions: e.target.value}))}
                        rows={4} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">{t('formProfile')}</label>
                      <textarea value={editingPreviewForm.profile} onChange={e => setEditingPreviewForm(f => f && ({...f, profile: e.target.value}))}
                        rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">{t('formSkills')}</label>
                      <input value={editingPreviewForm.keywords} onChange={e => setEditingPreviewForm(f => f && ({...f, keywords: e.target.value}))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                    <button onClick={() => { setEditingPreviewIdx(null); setEditingPreviewForm(null); }}
                      className="px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm">{t('formCancel')}</button>
                    <button onClick={saveEditPreview}
                      className="bg-emerald-700 text-white px-5 py-2 rounded-xl font-medium hover:bg-emerald-800 text-sm">{t('formSave')}</button>
                  </div>
                </div>

              ) : importPreview ? (
                /* ---- Preview list ---- */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{importPreview.length} {t('importCount')}</p>
                      {importCapped && <p className="text-xs text-amber-600 mt-0.5">⚠ {t('importCappedWarning')}</p>}
                    </div>
                    <button onClick={() => { setImportPreview(null); setImportFile(null); }} className="text-sm text-gray-400 hover:text-gray-600 underline">← {t('importBack')}</button>
                  </div>
                  <div className="border border-gray-100 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('colJob')}</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('colDept')}</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('colContract')}</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('formExperience')}</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {importPreview.map((job, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">{job.title}</div>
                              {job.description && <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{job.description}</div>}
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-xs">{job.department}</td>
                            <td className="px-4 py-3"><span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">{job.contract_type || 'CDI'}</span></td>
                            <td className="px-4 py-3 text-gray-500 text-xs">{job.experience}</td>
                            <td className="px-4 py-3">
                              <button onClick={() => startEditPreview(i)}
                                className="text-xs text-gray-400 hover:text-emerald-600 px-2 py-1 rounded hover:bg-emerald-50 transition-colors">✏️ {t('formEdit')}</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {importError && <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">{importError}</div>}
                  <button onClick={confirmImport} disabled={importSaving}
                    className="w-full bg-emerald-700 text-white py-3 rounded-xl font-semibold hover:bg-emerald-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                    {importSaving
                      ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('importingLabel')}</>
                      : `✅ ${t('importConfirm')} (${importPreview.length})`}
                  </button>
                </div>

              ) : (
                /* ---- Drop zone ---- */
                <>
                  <div
                    className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer ${importDragging ? 'border-emerald-400 bg-emerald-50' : importFile ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setImportDragging(true); }}
                    onDragLeave={() => setImportDragging(false)}
                    onDrop={e => { e.preventDefault(); setImportDragging(false); const f = e.dataTransfer.files[0]; if (f) handleImportFileDrop(f); }}
                  >
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.docx,.doc" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFileDrop(f); }} />
                    {importFile ? (
                      <div className="space-y-2">
                        <div className="text-3xl">{importFile.name.match(/\.(docx?)/i) ? '📄' : '📊'}</div>
                        <p className="font-semibold text-gray-900">{importFile.name}</p>
                        <p className="text-sm text-gray-500">{(importFile.size / 1024).toFixed(0)} Ko</p>
                        <button type="button" onClick={e => { e.stopPropagation(); setImportFile(null); }} className="text-xs text-gray-400 hover:text-emerald-500 underline">{t('importChange')}</button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="text-4xl">📥</div>
                        <p className="font-semibold text-gray-700">{t('importDrop')}</p>
                        <div className="flex items-center justify-center gap-3 mt-2">
                          <span className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full font-medium">📊 Excel .xlsx .xls</span>
                          <span className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full font-medium">📄 Word .docx .doc</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-800 space-y-1">
                    <p className="font-semibold">✨ {t('importAiTitle')}</p>
                    <p>{t('importAiDesc')}</p>
                  </div>

                  {importError && <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">{importError}</div>}

                  {importFile && (
                    <button onClick={parseAndGenerate} disabled={importParsing}
                      className="w-full bg-emerald-700 text-white py-3 rounded-xl font-medium hover:bg-emerald-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                      {importParsing
                        ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('importAnalyzing')}</>
                        : `✨ ${t('importAnalyzeBtn')}`}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== CREATE/EDIT FORM MODAL ===== */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{editing ? t('formEdit') : t('formAdd')}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('formTitle')} <span className="text-emerald-500">*</span></label>
                  <input type="text" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('formDept')}</label>
                  <select value={form.department} onChange={e => setForm(f => ({...f, department: e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('formLocation')}</label>
                  <input type="text" value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('formContract')}</label>
                  <select value={form.contract_type} onChange={e => setForm(f => ({...f, contract_type: e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                    <option value="">{t('formNotSpecified')}</option>
                    <option>CDI</option><option>CDD</option><option>Stage</option><option>Freelance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('formExperience')}</label>
                  <input type="text" value={form.experience} onChange={e => setForm(f => ({...f, experience: e.target.value}))}
                    placeholder="ex: 5-8 ans" className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('formEducation')}</label>
                  <input type="text" value={form.education} onChange={e => setForm(f => ({...f, education: e.target.value}))}
                    placeholder="ex: Bac+5" className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                {/* AI Generation button */}
                <div className="col-span-2">
                  <div className="flex items-center gap-3 py-1">
                    <div className="flex-1 border-t border-dashed border-gray-200" />
                    <button
                      type="button"
                      onClick={generateWithAI}
                      disabled={generating || !form.title.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                    >
                      {generating ? (
                        <>
                          <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full inline-block" />
                          {t('formGenerating')}
                        </>
                      ) : (
                        <>
                          <span>✨</span>
                          {t('formGenerateAI')}
                        </>
                      )}
                    </button>
                    <div className="flex-1 border-t border-dashed border-gray-200" />
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('formDescription')}</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                    rows={4} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('formMissions')}</label>
                  <textarea value={form.missions} onChange={e => setForm(f => ({...f, missions: e.target.value}))}
                    rows={4} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('formProfile')}</label>
                  <textarea value={form.profile} onChange={e => setForm(f => ({...f, profile: e.target.value}))}
                    rows={3} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('formSkills')}</label>
                  <input type="text" value={form.keywords} onChange={e => setForm(f => ({...f, keywords: e.target.value}))}
                    placeholder="Python, SQL, Machine Learning..." className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('formStatus')}</label>
                  <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                    <option value="active">{t('formStatusActive')}</option>
                    <option value="inactive">{t('formStatusInactive')}</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)}
                className="px-5 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm font-medium">{t('formCancel')}</button>
              <button onClick={handleSave} disabled={saving || !form.title.trim()}
                className="bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-emerald-800 disabled:opacity-50 text-sm">
                {saving ? '...' : t('formSave')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
