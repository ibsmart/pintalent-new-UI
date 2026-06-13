'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Project {
  id: string;
  name: string;
  client: string;
  description: string;
  status: string;
  request_count: number;
  candidate_count: number;
  hired_count: number;
  total_positions: number;
  created_at: string;
  stage_preselect: number;
  stage_contacted: number;
  stage_rh: number;
  stage_client: number;
  stage_offer: number;
  stage_refused: number;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:   { label: 'Actif',    color: 'bg-green-100 text-green-800 border-green-200' },
  on_hold:  { label: 'En pause', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  closed:   { label: 'Clôturé', color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const PRIORITY_COLORS: Record<string, string> = {
  low:    'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-700',
  high:   'bg-orange-100 text-orange-700',
  urgent: 'bg-emerald-100 text-emerald-700',
};

type NewProject = { name: string; client: string; description: string; status: string };
const EMPTY: NewProject = { name: '', client: '', description: '', status: 'active' };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewProject>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');

  async function load() {
    const data = await fetch('/api/projects').then(r => r.json());
    setProjects(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createProject() {
    if (!form.name.trim()) return;
    setSaving(true);
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    await load();
    setShowModal(false);
    setForm(EMPTY);
    setSaving(false);
  }

  const filtered = projects.filter(p =>
    !filter || p.name.toLowerCase().includes(filter.toLowerCase()) || (p.client || '').toLowerCase().includes(filter.toLowerCase())
  );

  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    candidates: projects.reduce((s, p) => s + (p.candidate_count || 0), 0),
    hired: projects.reduce((s, p) => s + (p.hired_count || 0), 0),
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campagnes de recrutement</h1>
          <p className="text-gray-500 text-sm mt-1">Gérez vos missions et postes à pourvoir par campagne</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
          + Nouvelle campagne
        </button>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Campagnes total', value: stats.total, icon: '📁' },
          { label: 'Campagnes actives', value: stats.active, icon: '🟢' },
          { label: 'Candidatures reçues', value: stats.candidates, icon: '👥' },
          { label: 'Embauches réalisées', value: stats.hired, icon: '🎉' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
            <span className="text-2xl">{s.icon}</span>
            <div>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <input type="text" placeholder="Rechercher une campagne ou client…" value={filter} onChange={e => setFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-72" />
        <span className="text-sm text-gray-400">{filtered.length} campagne{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {/* Grille projets */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array(6).fill(0).map((_, i) => <div key={i} className="animate-pulse bg-gray-100 rounded-2xl h-48" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <div className="text-5xl mb-4">📁</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune campagne</h3>
          <p className="text-gray-500 text-sm mb-6">Créez votre première campagne de recrutement</p>
          <button onClick={() => setShowModal(true)} className="bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-800 transition-colors">
            + Nouvelle campagne
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(project => {
            const st = STATUS_LABELS[project.status] || STATUS_LABELS.active;
            const fillRate = project.total_positions > 0
              ? Math.round((project.hired_count / project.total_positions) * 100)
              : 0;

            return (
              <Link key={project.id} href={`/hr/projects/${project.id}`}
                className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-md hover:border-gray-200 transition-all group block">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-700 font-bold text-sm">{project.name.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${st.color}`}>{st.label}</span>
                </div>

                <h3 className="font-bold text-gray-900 mb-1 group-hover:text-emerald-700 transition-colors">{project.name}</h3>
                {project.client && <p className="text-xs text-gray-500 mb-2">🏢 {project.client}</p>}
                {project.description && (
                  <p className="text-xs text-gray-500 leading-relaxed mb-4 line-clamp-2">{project.description}</p>
                )}

                {/* Compteurs postes / candidats / embauchés */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center">
                    <div className="text-xl font-bold text-gray-900">{project.request_count || 0}</div>
                    <div className="text-xs text-gray-400">postes</div>
                  </div>
                  <div className="text-center border-x border-gray-100">
                    <div className="text-xl font-bold text-gray-900">{project.candidate_count || 0}</div>
                    <div className="text-xs text-gray-400">candidats</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-600">{project.hired_count || 0}</div>
                    <div className="text-xs text-gray-400">embauchés</div>
                  </div>
                </div>

                {/* Récap statuts pipeline */}
                {project.candidate_count > 0 && (() => {
                  const stages = [
                    { label: 'Présélec.', count: project.stage_preselect || 0, color: 'bg-gray-100 text-gray-600' },
                    { label: 'Contacté', count: project.stage_contacted || 0, color: 'bg-blue-50 text-blue-600' },
                    { label: 'Entretien RH', count: project.stage_rh || 0, color: 'bg-indigo-50 text-indigo-600' },
                    { label: 'Entretien client', count: project.stage_client || 0, color: 'bg-purple-50 text-purple-600' },
                    { label: 'Offre', count: project.stage_offer || 0, color: 'bg-yellow-50 text-yellow-700' },
                    { label: 'Embauché', count: project.hired_count || 0, color: 'bg-green-50 text-green-700' },
                    { label: 'Refusé', count: project.stage_refused || 0, color: 'bg-emerald-50 text-emerald-500' },
                  ].filter(s => s.count > 0);
                  return stages.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {stages.map(s => (
                        <span key={s.label} className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${s.color}`}>
                          <span className="font-bold">{s.count}</span>
                          <span className="font-normal opacity-80">{s.label}</span>
                        </span>
                      ))}
                    </div>
                  ) : null;
                })()}

                {/* Fill rate bar */}
                {project.total_positions > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Taux de remplissage</span>
                      <span className="font-medium">{fillRate}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full transition-all ${fillRate >= 100 ? 'bg-green-500' : fillRate >= 50 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, fillRate)}%` }} />
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-gray-50 text-xs text-gray-400">
                  Créé le {new Date(project.created_at).toLocaleDateString('fr-FR')}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Modal création */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5">Nouvelle campagne de recrutement</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la campagne *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                  placeholder="Ex: Renforcement équipe Data" autoFocus
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client / Donneur d'ordre</label>
                <input type="text" value={form.client} onChange={e => setForm(f => ({...f, client: e.target.value}))}
                  placeholder="Ex: Direction Data & BI"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                  rows={3} placeholder="Contexte, objectifs…"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                  <option value="active">Actif</option>
                  <option value="on_hold">En pause</option>
                  <option value="closed">Clôturé</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={createProject} disabled={!form.name.trim() || saving}
                className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
                {saving ? 'Création…' : 'Créer la campagne'}
              </button>
              <button onClick={() => { setShowModal(false); setForm(EMPTY); }}
                className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
