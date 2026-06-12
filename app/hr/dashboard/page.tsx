'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface DashboardData {
  totalJobs: number;
  totalApplications: number;
  avgScore: number;
  byStage: { pipeline_stage: string; count: number }[];
  byJob: { id: string; title: string; department: string; count: number; avg_score: number; last_application: string }[];
  recent: { id: string; name: string; email: string; job_title: string; score: number; recommendation: string; pipeline_stage: string; created_at: string }[];
}

const STAGE_COLORS: Record<string, string> = {
  'Nouveau': 'bg-blue-100 text-blue-800',
  'Présélectionné': 'bg-purple-100 text-purple-800',
  'Entretien': 'bg-yellow-100 text-yellow-800',
  'Test technique': 'bg-orange-100 text-orange-800',
  'Offre': 'bg-green-100 text-green-800',
  'Embauché': 'bg-emerald-100 text-emerald-800',
  'Rejeté': 'bg-emerald-100 text-emerald-800',
};

const RECO_COLORS: Record<string, string> = {
  'À retenir': 'text-green-600 bg-green-50',
  'À évaluer': 'text-yellow-600 bg-yellow-50',
  'À écarter': 'text-emerald-600 bg-emerald-50',
};

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-green-500' : score >= 45 ? 'bg-yellow-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${score}%` }}></div>
      </div>
      <span className="text-sm font-semibold text-gray-700">{score}</span>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full"></div>
    </div>
  );

  if (!data) return null;

  const stageMap = Object.fromEntries(data.byStage.map(s => [s.pipeline_stage, s.count]));

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-gray-500 text-sm mt-1">Vue d&apos;ensemble du recrutement GEEKFACT</p>
        </div>
        <div className="text-sm text-gray-400">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Postes actifs', value: data.totalJobs, icon: '📋', color: 'bg-blue-50 border-blue-100', iconBg: 'bg-blue-100' },
          { label: 'Candidatures', value: data.totalApplications, icon: '👥', color: 'bg-green-50 border-green-100', iconBg: 'bg-green-100' },
          { label: 'Score moyen', value: `${data.avgScore}/100`, icon: '⭐', color: 'bg-yellow-50 border-yellow-100', iconBg: 'bg-yellow-100' },
          { label: 'À retenir', value: stageMap['Embauché'] || 0, icon: '✅', color: 'bg-purple-50 border-purple-100', iconBg: 'bg-purple-100' },
        ].map(kpi => (
          <div key={kpi.label} className={`${kpi.color} border rounded-2xl p-6 flex items-center gap-4`}>
            <div className={`w-12 h-12 ${kpi.iconBg} rounded-xl flex items-center justify-center text-2xl`}>{kpi.icon}</div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
              <div className="text-sm text-gray-600">{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline overview */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">Répartition du pipeline</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {['Nouveau', 'Présélectionné', 'Entretien', 'Test technique', 'Offre', 'Embauché', 'Rejeté'].map(stage => (
            <Link key={stage} href={`/hr/pipeline?stage=${encodeURIComponent(stage)}`}
              className="text-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
              <div className="text-2xl font-bold text-gray-900">{stageMap[stage] || 0}</div>
              <div className="text-xs text-gray-500 mt-1 leading-tight">{stage}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By job */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-gray-900">Candidatures par poste</h2>
            <Link href="/hr/jobs" className="text-sm text-emerald-600 hover:underline">Gérer →</Link>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {data.byJob.slice(0, 10).map(job => (
              <Link key={job.id} href={`/hr/candidates?job_id=${job.id}`}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm truncate group-hover:text-emerald-700">{job.title}</div>
                  <div className="text-xs text-gray-400">{job.department}</div>
                </div>
                <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{job.count}</div>
                    <div className="text-xs text-gray-400">candidats</div>
                  </div>
                  {job.count > 0 && (
                    <div className="text-center">
                      <div className="text-sm font-semibold text-gray-600">{Math.round(job.avg_score || 0)}</div>
                      <div className="text-xs text-gray-400">score moy.</div>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-gray-900">Candidatures récentes</h2>
            <Link href="/hr/candidates" className="text-sm text-emerald-600 hover:underline">Voir tout →</Link>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {data.recent.length === 0 ? (
              <div className="text-center text-gray-400 py-8 text-sm">Aucune candidature reçue</div>
            ) : data.recent.map(app => (
              <Link key={app.id} href={`/hr/candidates/${app.id}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center font-semibold text-gray-700 text-sm flex-shrink-0">
                  {app.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm group-hover:text-emerald-700 truncate">{app.name}</div>
                  <div className="text-xs text-gray-400 truncate">{app.job_title}</div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <ScoreBadge score={app.score} />
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STAGE_COLORS[app.pipeline_stage] || 'bg-gray-100 text-gray-600'}`}>
                    {app.pipeline_stage}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
