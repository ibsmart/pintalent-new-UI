'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface Application {
  id: string;
  name: string;
  email: string;
  job_title: string;
  department: string;
  score: number;
  recommendation: string;
  pipeline_stage: string;
  created_at: string;
}

const STAGES = ['Nouveau', 'Présélectionné', 'Entretien', 'Test technique', 'Offre', 'Embauché', 'Rejeté'];

const STAGE_COLORS: Record<string, { bg: string; border: string; header: string }> = {
  'Nouveau': { bg: 'bg-slate-50', border: 'border-slate-200', header: 'bg-slate-200 text-slate-800' },
  'Présélectionné': { bg: 'bg-purple-50', border: 'border-purple-200', header: 'bg-purple-200 text-purple-800' },
  'Entretien': { bg: 'bg-yellow-50', border: 'border-yellow-200', header: 'bg-yellow-200 text-yellow-800' },
  'Test technique': { bg: 'bg-orange-50', border: 'border-orange-200', header: 'bg-orange-200 text-orange-800' },
  'Offre': { bg: 'bg-blue-50', border: 'border-blue-200', header: 'bg-blue-200 text-blue-800' },
  'Embauché': { bg: 'bg-green-50', border: 'border-green-200', header: 'bg-green-200 text-green-800' },
  'Rejeté': { bg: 'bg-emerald-50', border: 'border-emerald-200', header: 'bg-emerald-200 text-emerald-800' },
};

const RECO_COLORS: Record<string, string> = {
  'À retenir': 'bg-green-100 text-green-700',
  'À évaluer': 'bg-yellow-100 text-yellow-700',
  'À écarter': 'bg-emerald-100 text-emerald-700',
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-green-500' : score >= 45 ? 'bg-yellow-500' : 'bg-emerald-400';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${score}%` }}></div>
      </div>
      <span className="text-xs font-semibold text-gray-600 w-5">{score}</span>
    </div>
  );
}

export default function PipelinePage() {
  const searchParams = useSearchParams();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [filterJob, setFilterJob] = useState(() => searchParams.get('job_id') || '');
  const [jobs, setJobs] = useState<{ id: string; title: string }[]>([]);

  const loadData = useCallback(() => {
    const url = filterJob ? `/api/applications?job_id=${filterJob}` : '/api/applications';
    fetch(url)
      .then(r => r.json())
      .then(data => { setApps(data); setLoading(false); });
  }, [filterJob]);

  useEffect(() => {
    fetch('/api/jobs').then(r => r.json()).then(setJobs);
  }, []);

  useEffect(() => { setLoading(true); loadData(); }, [loadData]);

  async function moveCard(appId: string, newStage: string) {
    const app = apps.find(a => a.id === appId);
    if (!app || app.pipeline_stage === newStage) return;

    setApps(prev => prev.map(a => a.id === appId ? { ...a, pipeline_stage: newStage } : a));

    await fetch(`/api/applications/${appId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeline_stage: newStage })
    });
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    setDragging(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDrop(e: React.DragEvent, stage: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (id) moveCard(id, stage);
    setDragging(null);
    setDragOver(null);
  }

  const byStage = STAGES.reduce((acc, s) => {
    acc[s] = apps.filter(a => a.pipeline_stage === s);
    return acc;
  }, {} as Record<string, Application[]>);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select value={filterJob} onChange={e => setFilterJob(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
            <option value="">Tous les postes</option>
            {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pipeline de recrutement</h1>
            <p className="text-gray-500 text-sm mt-1">Glissez-déposez les candidats entre les étapes</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
          {STAGES.map(stage => {
            const colors = STAGE_COLORS[stage];
            const stageApps = byStage[stage] || [];
            return (
              <div key={stage}
                className={`flex-shrink-0 w-72 ${colors.bg} ${colors.border} border rounded-2xl flex flex-col`}
                onDragOver={e => { e.preventDefault(); setDragOver(stage); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => handleDrop(e, stage)}
                style={{ outline: dragOver === stage ? '2px solid #dc2626' : 'none', outlineOffset: '2px' }}
              >
                {/* Column header */}
                <div className={`${colors.header} rounded-t-2xl px-4 py-3 flex items-center justify-between`}>
                  <span className="font-semibold text-sm">{stage}</span>
                  <span className="bg-white/60 text-current text-xs font-bold px-2 py-0.5 rounded-full">{stageApps.length}</span>
                </div>

                {/* Cards */}
                <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[70vh]">
                  {stageApps.length === 0 && (
                    <div className="text-center text-gray-400 text-xs py-6 border-2 border-dashed border-gray-200 rounded-xl">
                      Déposez ici
                    </div>
                  )}
                  {stageApps.map(app => (
                    <div key={app.id}
                      draggable
                      onDragStart={e => handleDragStart(e, app.id)}
                      onDragEnd={() => { setDragging(null); setDragOver(null); }}
                      className={`bg-white rounded-xl p-4 shadow-sm border border-gray-100 cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${dragging === app.id ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center font-semibold text-gray-700 text-xs flex-shrink-0">
                          {app.name.charAt(0).toUpperCase()}
                        </div>
                        {app.recommendation && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${RECO_COLORS[app.recommendation] || 'bg-gray-100 text-gray-600'}`}>
                            {app.recommendation === 'À retenir' ? '✓' : app.recommendation === 'À écarter' ? '✗' : '~'}
                          </span>
                        )}
                      </div>
                      <Link href={`/hr/candidates/${app.id}`} className="block hover:text-emerald-700">
                        <div className="font-semibold text-gray-900 text-sm mb-0.5">{app.name}</div>
                        <div className="text-xs text-gray-500 truncate mb-3">{app.job_title}</div>
                      </Link>
                      <ScoreBar score={app.score} />
                      <div className="text-xs text-gray-400 mt-2">
                        {new Date(app.created_at).toLocaleDateString('fr-FR')}
                      </div>

                      {/* Quick stage move */}
                      <div className="mt-3 flex gap-1 flex-wrap">
                        {STAGES.filter(s => s !== stage).slice(0, 3).map(s => (
                          <button key={s} onClick={() => moveCard(app.id, s)}
                            className="text-xs text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 px-2 py-0.5 rounded-full border border-gray-100 hover:border-emerald-200 transition-colors">
                            → {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
