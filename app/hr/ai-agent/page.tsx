'use client';

import { useState, useEffect } from 'react';

interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  trigger_value: string;
  action_type: string;
  action_config: string;
  active: number;
  template_name?: string;
  created_at: string;
}

interface Log {
  id: string;
  automation_id: string;
  status: string;
  message: string;
  executed_at: string;
}

const TRIGGER_LABELS: Record<string, string> = {
  stage_change: 'Changement d\'étape',
  new_application: 'Nouvelle candidature',
  tag_added: 'Tag ajouté',
};

const ACTION_LABELS: Record<string, string> = {
  send_email: 'Envoyer un email',
  send_sms: 'Envoyer un SMS',
  assign_tag: 'Assigner un tag',
  move_stage: 'Changer d\'étape',
};

export default function AIAgentPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'agents' | 'logs'>('agents');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    trigger_type: 'stage_change',
    trigger_value: '',
    action_type: 'send_email',
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/automations').then(r => r.json()),
      fetch('/api/automation-logs?limit=50').then(r => r.json()),
    ]).then(([a, l]) => {
      setAutomations(Array.isArray(a) ? a : []);
      setLogs(Array.isArray(l) ? l : []);
      setLoading(false);
    });
  }, []);

  async function toggleActive(id: string, current: number) {
    await fetch(`/api/automations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: current ? 0 : 1 }),
    });
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, active: current ? 0 : 1 } : a));
  }

  async function deleteAutomation(id: string) {
    if (!confirm('Supprimer cet agent ?')) return;
    await fetch(`/api/automations/${id}`, { method: 'DELETE' });
    setAutomations(prev => prev.filter(a => a.id !== id));
  }

  async function createAutomation(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/automations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, action_config: {} }),
    });
    if (res.ok) {
      const created = await res.json();
      setAutomations(prev => [...prev, created]);
      setShowForm(false);
      setForm({ name: '', trigger_type: 'stage_change', trigger_value: '', action_type: 'send_email' });
    }
    setSaving(false);
  }

  const activeCount = automations.filter(a => a.active).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center">
              <span className="text-lg">🤖</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">AI Agent</h1>
          </div>
          <p className="text-gray-500 text-sm ml-12">Automatisez vos workflows de recrutement</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors"
        >
          <span className="text-base leading-none">+</span>
          Nouvel agent
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Total agents</p>
          <p className="text-3xl font-bold text-gray-900">{automations.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Actifs</p>
          <p className="text-3xl font-bold text-violet-600">{activeCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Exécutions</p>
          <p className="text-3xl font-bold text-gray-900">{logs.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {(['agents', 'logs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'agents' ? 'Agents' : 'Logs d\'exécution'}
          </button>
        ))}
      </div>

      {/* Agents list */}
      {tab === 'agents' && (
        <div className="space-y-3">
          {loading ? (
            Array(3).fill(0).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)
          ) : automations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
              <div className="text-4xl mb-3">🤖</div>
              <p className="text-gray-500 font-medium">Aucun agent configuré</p>
              <p className="text-gray-400 text-sm mt-1">Créez votre premier agent pour automatiser vos workflows</p>
              <button onClick={() => setShowForm(true)}
                className="mt-4 bg-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors">
                Créer un agent
              </button>
            </div>
          ) : automations.map(auto => (
            <div key={auto.id} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
              {/* Status indicator */}
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${auto.active ? 'bg-green-400' : 'bg-gray-300'}`} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900 text-sm">{auto.name}</h3>
                  {auto.active ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 uppercase">Actif</span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 uppercase">Inactif</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-400 flex-wrap">
                  <span className="bg-gray-100 rounded-lg px-2 py-0.5">⚡ {TRIGGER_LABELS[auto.trigger_type] || auto.trigger_type}</span>
                  <span className="text-gray-300">→</span>
                  <span className="bg-violet-50 text-violet-600 rounded-lg px-2 py-0.5">🎯 {ACTION_LABELS[auto.action_type] || auto.action_type}</span>
                  {auto.trigger_value && <span className="text-gray-400">· {auto.trigger_value}</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Toggle */}
                <button
                  onClick={() => toggleActive(auto.id, auto.active)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${auto.active ? 'bg-violet-600' : 'bg-gray-200'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${auto.active ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <button onClick={() => deleteAutomation(auto.id)}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors text-xs">
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Logs */}
      {tab === 'logs' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <div className="text-3xl mb-2">📋</div>
              <p>Aucun log d&apos;exécution</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Message</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                        log.status === 'success' ? 'bg-green-50 text-green-700' :
                        log.status === 'error' ? 'bg-red-50 text-red-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {log.status === 'success' ? '✓' : log.status === 'error' ? '✗' : '·'}
                        {log.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 max-w-xs truncate">{log.message}</td>
                    <td className="px-5 py-3.5 text-gray-400 whitespace-nowrap">
                      {new Date(log.executed_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5">Nouvel agent AI</h2>
            <form onSubmit={createAutomation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nom de l&apos;agent</label>
                <input
                  type="text" required value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Email de bienvenue automatique"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Déclencheur</label>
                <select value={form.trigger_type} onChange={e => setForm(p => ({ ...p, trigger_type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="stage_change">Changement d&apos;étape</option>
                  <option value="new_application">Nouvelle candidature</option>
                  <option value="tag_added">Tag ajouté</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Valeur déclencheur</label>
                <input
                  type="text" value={form.trigger_value}
                  onChange={e => setForm(p => ({ ...p, trigger_value: e.target.value }))}
                  placeholder="Ex: Entretien, Nouveau, ..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Action</label>
                <select value={form.action_type} onChange={e => setForm(p => ({ ...p, action_type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="send_email">Envoyer un email</option>
                  <option value="send_sms">Envoyer un SMS</option>
                  <option value="assign_tag">Assigner un tag</option>
                  <option value="move_stage">Changer d&apos;étape</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-violet-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-60">
                  {saving ? 'Création…' : 'Créer l\'agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
