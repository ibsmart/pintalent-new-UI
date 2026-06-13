'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface CampaignJob {
  id: string; title: string; department: string; location: string;
  contract_type: string; experience: string; status: string;
  candidate_count: number;
  stage_nouveau: number; stage_preselect: number; stage_entretien: number;
  stage_test: number; stage_offre: number; stage_embauche: number; stage_rejete: number;
}

interface Campaign {
  id: string; name: string; client: string; description: string;
  status: string; created_at: string;
  jobs: CampaignJob[];
}

interface Job { id: string; title: string; department: string; campaign_id: string | null }

interface Application {
  id: string; name: string; score: number; recommendation: string;
  pipeline_stage: string; created_at: string;
}

const PROJ_STATUS: Record<string, { label: string; color: string }> = {
  active:  { label: 'Active',    color: 'bg-green-100 text-green-800 border-green-200' },
  on_hold: { label: 'En pause',  color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  closed:  { label: 'Clôturée', color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const STAGES = ['Nouveau', 'Présélectionné', 'Entretien', 'Test technique', 'Offre', 'Embauché', 'Rejeté'];
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
  'À retenir': 'bg-green-100 text-green-700',
  'À évaluer': 'bg-yellow-100 text-yellow-700',
  'À écarter': 'bg-emerald-100 text-emerald-700',
};
const MINI_STAGES = [
  { key: 'stage_nouveau',    label: 'Nouveau',    color: 'bg-slate-100 text-slate-600' },
  { key: 'stage_preselect',  label: 'Présélec.',  color: 'bg-purple-100 text-purple-700' },
  { key: 'stage_entretien',  label: 'Entretien',  color: 'bg-yellow-100 text-yellow-700' },
  { key: 'stage_test',       label: 'Test',       color: 'bg-orange-100 text-orange-700' },
  { key: 'stage_offre',      label: 'Offre',      color: 'bg-blue-100 text-blue-700' },
  { key: 'stage_embauche',   label: 'Embauché',   color: 'bg-green-100 text-green-700' },
  { key: 'stage_rejete',     label: 'Rejeté',     color: 'bg-emerald-100 text-emerald-600' },
];

/* ── Kanban inline ─────────────────────────────────────────── */
function PipelinePanel({ jobId }: { jobId: string }) {
  const t = useTranslations('projects');
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/applications?job_id=${jobId}`)
      .then(r => r.json()).then(d => { setApps(d); setLoading(false); });
  }, [jobId]);

  async function move(appId: string, stage: string) {
    if (apps.find(a => a.id === appId)?.pipeline_stage === stage) return;
    setApps(prev => prev.map(a => a.id === appId ? { ...a, pipeline_stage: stage } : a));
    await fetch(`/api/applications/${appId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeline_stage: stage })
    });
  }

  const byStage = STAGES.reduce((acc, s) => { acc[s] = apps.filter(a => a.pipeline_stage === s); return acc; }, {} as Record<string, Application[]>);

  if (loading) return <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 rounded-full" style={{ border: '3px solid #dc262630', borderTopColor: '#dc2626' }} /></div>;

  if (apps.length === 0) return (
    <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
      <p className="text-sm">{t('detailNoCandidate')} — <Link href={`/jobs/${jobId}`} target="_blank" className="text-emerald-600 hover:underline">voir l&apos;offre publique</Link></p>
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-2 pb-2" style={{ minWidth: 'max-content' }}>
        {STAGES.map(stage => {
          const stageApps = byStage[stage] || [];
          return (
            <div key={stage} className="w-48 flex-shrink-0 bg-white border border-gray-100 rounded-xl overflow-hidden"
              onDragOver={e => { e.preventDefault(); setDragOver(stage); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text'); if (id) move(id, stage); setDragging(null); setDragOver(null); }}
              style={{ outline: dragOver === stage ? '2px solid #dc2626' : 'none', outlineOffset: '1px' }}>
              <div className={`${STAGE_COLORS[stage]} px-3 py-2 flex items-center justify-between`}>
                <span className="text-xs font-semibold">{stage}</span>
                <span className="text-xs bg-white/60 font-bold px-1.5 py-0.5 rounded-full">{stageApps.length}</span>
              </div>
              <div className="p-2 space-y-2 max-h-56 overflow-y-auto">
                {stageApps.length === 0 && <div className="text-center py-3 text-gray-300 text-xs border border-dashed border-gray-100 rounded-lg">{t('detailDropHere')}</div>}
                {stageApps.map(app => (
                  <div key={app.id} draggable
                    onDragStart={e => { setDragging(app.id); e.dataTransfer.setData('text', app.id); }}
                    onDragEnd={() => { setDragging(null); setDragOver(null); }}
                    className={`bg-white border border-gray-100 rounded-lg p-2 cursor-grab hover:shadow-sm transition-all ${dragging === app.id ? 'opacity-40' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">{app.name.charAt(0)}</div>
                      {app.recommendation && (
                        <span className={`text-xs px-1 py-0.5 rounded-full ${RECO_COLORS[app.recommendation] || 'bg-gray-100 text-gray-600'}`}>
                          {app.recommendation === 'À retenir' ? '✓' : app.recommendation === 'À écarter' ? '✗' : '~'}
                        </span>
                      )}
                    </div>
                    <Link href={`/hr/candidates/${app.id}`} className="block text-xs font-semibold text-gray-900 hover:text-emerald-700 leading-tight mb-1">{app.name}</Link>
                    <div className="flex items-center gap-1">
                      <div className="flex-1 bg-gray-100 rounded-full h-1">
                        <div className={`h-1 rounded-full ${app.score >= 75 ? 'bg-green-500' : app.score >= 45 ? 'bg-yellow-500' : 'bg-emerald-400'}`} style={{ width: `${app.score}%` }} />
                      </div>
                      <span className="text-xs text-gray-400 w-4">{app.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Page principale ───────────────────────────────────────── */
export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations('projects');
  const { id } = use(params);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ name: '', client: '', description: '', status: 'active' });
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkJobIds, setLinkJobIds] = useState<Set<string>>(new Set());
  const router = useRouter();

  async function load() {
    const [camp, jobs] = await Promise.all([
      fetch(`/api/projects/${id}`).then(r => r.ok ? r.json() : null),
      fetch('/api/jobs?status=all').then(r => r.json()),
    ]);
    if (!camp) { router.push('/hr/projects'); return; }
    setCampaign(camp);
    setForm({ name: camp.name, client: camp.client || '', description: camp.description || '', status: camp.status });
    setAllJobs(jobs);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function saveCampaign() {
    await fetch(`/api/projects/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setEditMode(false); load();
  }

  async function deleteCampaign() {
    if (!confirm('Supprimer cette campagne ? Les offres liées seront détachées.')) return;
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    router.push('/hr/projects');
  }

  async function unlinkJob(jobId: string) {
    if (!confirm('Retirer cette offre de la campagne ?')) return;
    await fetch(`/api/jobs/${jobId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaign_id: null }) });
    load();
  }

  async function linkJobs() {
    if (linkJobIds.size === 0) return;
    await Promise.all([...linkJobIds].map(jobId =>
      fetch(`/api/jobs/${jobId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaign_id: id }) })
    ));
    setShowLinkModal(false); setLinkJobIds(new Set()); load();
  }

  function toggleLinkJob(jobId: string) {
    setLinkJobIds(prev => {
      const next = new Set(prev);
      next.has(jobId) ? next.delete(jobId) : next.add(jobId);
      return next;
    });
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin w-8 h-8 rounded-full" style={{ border: '4px solid #dc262630', borderTopColor: '#dc2626' }} /></div>;
  if (!campaign) return null;

  const linkedJobIds = new Set(campaign.jobs.map(j => j.id));
  const availableJobs = allJobs.filter(j => !j.campaign_id || j.campaign_id === id ? !linkedJobIds.has(j.id) : false);
  const totalCandidates = campaign.jobs.reduce((s, j) => s + (j.candidate_count || 0), 0);
  const totalHired = campaign.jobs.reduce((s, j) => s + (j.stage_embauche || 0), 0);
  const st = PROJ_STATUS[campaign.status] || PROJ_STATUS.active;

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/hr/projects" className="hover:text-gray-900">{t('detailBreadcrumb')}</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{campaign.name}</span>
      </div>

      {/* Header campagne */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        {editMode ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nom de la campagne</label>
                <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Client / Donneur d'ordre</label>
                <input value={form.client} onChange={e => setForm(f => ({...f, client: e.target.value}))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
            </div>
            <div className="flex items-center gap-3">
              <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none">
                <option value="active">Active</option>
                <option value="on_hold">En pause</option>
                <option value="closed">Clôturée</option>
              </select>
              <button onClick={saveCampaign} className="bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-800">Enregistrer</button>
              <button onClick={() => setEditMode(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-2xl flex items-center justify-center flex-shrink-0">
                <span className="text-emerald-700 font-bold text-lg">{campaign.name.slice(0, 2).toUpperCase()}</span>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${st.color}`}>{st.label}</span>
                </div>
                {campaign.client && <p className="text-sm text-gray-500">🏢 {campaign.client}</p>}
                {campaign.description && <p className="text-sm text-gray-500 mt-1 max-w-xl">{campaign.description}</p>}
                <p className="text-xs text-gray-400 mt-1">Créée le {new Date(campaign.created_at).toLocaleDateString('fr-FR')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setEditMode(true)} className="text-sm px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">✏️ Modifier</button>
              <button onClick={deleteCampaign} className="text-sm px-3 py-2 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl">🗑</button>
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="mt-5 pt-5 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: t('kpiJobs'), value: campaign.jobs.length, icon: '📋' },
            { label: t('kpiApplications'), value: totalCandidates, icon: '👥' },
            { label: t('kpiHired'), value: totalHired, icon: '🎉', green: true },
            { label: t('kpiFillRate'), value: totalCandidates > 0 ? `${Math.round((totalHired / totalCandidates) * 100)}%` : '—', icon: '📊' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3">
              <span className="text-xl">{s.icon}</span>
              <div>
                <div className={`text-xl font-bold ${s.green ? 'text-green-600' : 'text-gray-900'}`}>{s.value}</div>
                <div className="text-xs text-gray-400">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Offres de la campagne */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{t('detailJobs')} ({campaign.jobs.length})</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowLinkModal(true)}
              className="flex items-center gap-2 border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-xl text-sm font-medium transition-colors">
              🔗 {t('detailAttach')}
            </button>
            <Link href={`/hr/jobs?new=1&campaign_id=${id}`}
              className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
              {t('detailNewJob')}
            </Link>
          </div>
        </div>

        {campaign.jobs.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <div className="text-4xl mb-3">📋</div>
            <h3 className="font-semibold text-gray-900 mb-2">{t('detailNoJobs')}</h3>
            <p className="text-gray-500 text-sm mb-5">Rattachez des offres existantes ou créez-en de nouvelles</p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setShowLinkModal(true)} className="border border-gray-200 text-gray-700 hover:bg-gray-50 px-5 py-2.5 rounded-xl text-sm font-medium">
                🔗 {t('detailAttach')}
              </button>
              <Link href={`/hr/jobs?new=1&campaign_id=${id}`} className="bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-800">
                {t('detailNewJob')}
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {campaign.jobs.map(job => {
              const isExpanded = expandedJob === job.id;
              return (
                <div key={job.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${job.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <h3 className="font-semibold text-gray-900">{job.title}</h3>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{job.department}</span>
                          <span className="text-xs text-gray-400">{job.contract_type}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                          <span>📍 {job.location}</span>
                          {job.experience && <span>⏱ {job.experience}</span>}
                          <span className="text-gray-400">·</span>
                          <span className="font-medium text-gray-700">{job.candidate_count || 0} candidat{(job.candidate_count || 0) > 1 ? 's' : ''}</span>
                        </div>

                        {/* Mini pipeline badges */}
                        <div className="flex flex-wrap gap-1.5">
                          {MINI_STAGES.map(s => {
                            const val = job[s.key as keyof CampaignJob] as number || 0;
                            return (
                              <span key={s.key} className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color} ${val === 0 ? 'opacity-40' : ''}`}>
                                {s.label} {val}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Link href={`/hr/jobs`} className="text-xs text-gray-400 hover:text-gray-700 px-3 py-1.5 border border-gray-100 rounded-lg">
                          ✏️ Éditer
                        </Link>
                        <Link href={`/jobs/${job.id}`} target="_blank" className="text-xs text-gray-400 hover:text-gray-700 px-3 py-1.5 border border-gray-100 rounded-lg">
                          🌐 Voir
                        </Link>
                        <button
                          onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                          className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl border font-medium transition-colors ${
                            isExpanded ? 'bg-emerald-700 text-white border-emerald-700' : 'border-gray-200 text-gray-600 hover:border-emerald-300 hover:bg-emerald-50'
                          }`}>
                          🎯 Pipeline {isExpanded ? '▲' : '▼'}
                        </button>
                        <button onClick={() => unlinkJob(job.id)} className="text-xs text-emerald-300 hover:text-emerald-500 hover:bg-emerald-50 p-2 rounded-lg transition-colors" title="Retirer de la campagne">✕</button>
                      </div>
                    </div>
                  </div>

                  {/* Pipeline inline */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-5 bg-gray-50">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-semibold text-gray-700">Pipeline — {job.title}</h4>
                        <Link href={`/hr/pipeline?job_id=${job.id}`} className="text-xs text-emerald-600 hover:underline font-medium">
                          Ouvrir en plein écran →
                        </Link>
                      </div>
                      <PipelinePanel jobId={job.id} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal rattachement offre existante */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={e => e.target === e.currentTarget && (setShowLinkModal(false), setLinkJobIds(new Set()))}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Rattacher des offres</h2>
              {linkJobIds.size > 0 && (
                <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2.5 py-1 rounded-full">
                  {linkJobIds.size} sélectionnée{linkJobIds.size > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {availableJobs.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm">Aucune offre disponible à rattacher.</p>
                <Link href="/hr/jobs" className="text-emerald-600 hover:underline text-sm mt-2 block">Créer une nouvelle offre</Link>
              </div>
            ) : (
              <>
                {/* Select all */}
                <label className="flex items-center gap-3 px-3 py-2 mb-2 rounded-lg hover:bg-gray-50 cursor-pointer border-b border-gray-100 pb-3">
                  <input type="checkbox"
                    checked={linkJobIds.size === availableJobs.length && availableJobs.length > 0}
                    ref={el => { if (el) el.indeterminate = linkJobIds.size > 0 && linkJobIds.size < availableJobs.length; }}
                    onChange={() => setLinkJobIds(linkJobIds.size === availableJobs.length ? new Set() : new Set(availableJobs.map(j => j.id)))}
                    className="w-4 h-4 rounded accent-emerald-700 cursor-pointer" />
                  <span className="text-sm font-medium text-gray-700">Tout sélectionner</span>
                </label>

                <div className="space-y-1.5 max-h-72 overflow-y-auto mb-4">
                  {availableJobs.map(j => {
                    const checked = linkJobIds.has(j.id);
                    return (
                      <label key={j.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-colors ${checked ? 'border-emerald-300 bg-emerald-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleLinkJob(j.id)}
                          className="w-4 h-4 rounded accent-emerald-700 cursor-pointer flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{j.title}</div>
                          <div className="text-xs text-gray-400">{j.department}{j.campaign_id ? ' · dans une autre campagne' : ' · sans campagne'}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div className="flex gap-3">
                  <button onClick={linkJobs} disabled={linkJobIds.size === 0}
                    className="flex-1 bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-800 disabled:opacity-50 transition-colors">
                    Rattacher {linkJobIds.size > 0 ? `(${linkJobIds.size})` : ''}
                  </button>
                  <button onClick={() => { setShowLinkModal(false); setLinkJobIds(new Set()); }}
                    className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                    Annuler
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
