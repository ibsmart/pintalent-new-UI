'use client';

import { useState, useEffect, useCallback } from 'react';

interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  trigger_value: string;
  action_type: string;
  action_config: string;
  active: number;
  template_name?: string;
}

interface Log {
  id: string;
  automation_id: string;
  automation_name?: string;
  candidate_name?: string;
  candidate_title?: string;
  recipient?: string;
  stage?: string;
  status: string;
  message: string;
  executed_at: string;
}

const TRIGGER_LABELS: Record<string, string> = {
  stage_change: 'Changement d\'étape',
  new_application: 'Nouvelle candidature',
  tag_added: 'Tag ajouté',
};

const ACTION_ICONS: Record<string, string> = {
  send_email: '📧',
  webhook: '🔗',
  assign_tag: '🏷',
  move_stage: '📋',
};

const ACTION_LABELS: Record<string, string> = {
  send_email: 'Email',
  webhook: 'Webhook',
  assign_tag: 'Tag',
  move_stage: 'Étape',
};

type LogFilter = 'all' | 'success' | 'error';

interface EmailTemplate { id: string; name: string; }

const STAGE_OPTIONS = ['Nouveau', 'Présélectionné', 'Entretien', 'Offre', 'Embauché', 'Rejeté'];

export default function AIAgentPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [logFilter, setLogFilter] = useState<LogFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    trigger_value: 'Nouveau',
    action_type: 'send_email' as 'send_email' | 'webhook',
    template_id: '',
    webhook_url: '',
  });

  const fetchData = useCallback(async () => {
    const [aRes, lRes, tRes] = await Promise.all([
      fetch('/api/automations'),
      fetch('/api/automation-logs?limit=100'),
      fetch('/api/email-templates'),
    ]);
    const [a, l, t] = await Promise.all([aRes.json(), lRes.json(), tRes.json()]);
    setAutomations(Array.isArray(a) ? a : []);
    setLogs(Array.isArray(l) ? l : []);
    const tmpl = Array.isArray(t) ? t : [];
    setTemplates(tmpl);
    if (tmpl.length > 0) setForm(p => ({ ...p, template_id: tmpl[0].id }));
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  async function clearLogs() {
    if (!confirm('Effacer tous les logs ?')) return;
    await fetch('/api/automation-logs', { method: 'DELETE' });
    setLogs([]);
  }

  async function createAutomation(e: React.FormEvent) {
    e.preventDefault();
    if (form.action_type === 'send_email' && !form.template_id) return;
    if (form.action_type === 'webhook' && !form.webhook_url) return;
    setSaving(true);
    const action_config = form.action_type === 'send_email'
      ? { template_id: form.template_id }
      : { url: form.webhook_url };
    const res = await fetch('/api/automations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        trigger_type: 'stage_change',
        trigger_value: form.trigger_value,
        action_type: form.action_type === 'send_email' ? 'send_email' : 'webhook',
        action_config,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setAutomations(prev => [...prev, created]);
      setShowForm(false);
      setForm({ name: '', trigger_value: 'Nouveau', action_type: 'send_email', template_id: templates[0]?.id || '', webhook_url: '' });
    }
    setSaving(false);
  }

  const selectedTemplate = templates.find(t => t.id === form.template_id);

  const filteredLogs = logs.filter(l =>
    logFilter === 'all' ? true :
    logFilter === 'success' ? l.status === 'success' :
    l.status === 'error'
  );

  const successCount = logs.filter(l => l.status === 'success').length;
  const errorCount = logs.filter(l => l.status === 'error').length;

  function getActionDetail(auto: Automation): string {
    try {
      const cfg = JSON.parse(auto.action_config || '{}');
      if (auto.action_type === 'send_email' || auto.action_type === 'webhook') {
        return cfg.url || cfg.webhook_url || auto.template_name || '';
      }
      return cfg.value || '';
    } catch { return ''; }
  }

  function getActionType(auto: Automation): string {
    try {
      const cfg = JSON.parse(auto.action_config || '{}');
      if (cfg.url || cfg.webhook_url) return 'webhook';
    } catch { /* ignore */ }
    return auto.action_type;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Agent</h1>
          <p className="text-gray-500 text-sm mt-0.5">Automatisez vos workflows de recrutement</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors shadow-sm">
          + Nouvel agent
        </button>
      </div>

      {/* ── Automations table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : automations.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-4xl mb-3">🤖</p>
            <p className="text-gray-500 font-medium">Aucun agent configuré</p>
            <p className="text-gray-400 text-sm mt-1">Créez votre premier agent pour automatiser vos workflows</p>
            <button onClick={() => setShowForm(true)}
              className="mt-4 bg-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors">
              Créer un agent
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>
                {['Nom', 'Déclencheur', 'Action', 'Détail', 'Actif', ''].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {automations.map(auto => {
                const actionType = getActionType(auto);
                const detail = getActionDetail(auto);
                return (
                  <tr key={auto.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 font-medium text-gray-900">{auto.name}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
                        {TRIGGER_LABELS[auto.trigger_type] || auto.trigger_type}
                        {auto.trigger_value && ` : ${auto.trigger_value}`}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="flex items-center gap-1.5 text-gray-600">
                        <span>{ACTION_ICONS[actionType] || '⚙️'}</span>
                        <span>{ACTION_LABELS[actionType] || auto.action_type}</span>
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-400 max-w-[200px]">
                      {detail ? (
                        <span className="font-mono text-xs truncate block" title={detail}>
                          {actionType === 'webhook' ? 'POST ' : ''}{detail.length > 30 ? detail.slice(0, 30) + '…' : detail}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => toggleActive(auto.id, auto.active)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${auto.active ? 'bg-violet-500' : 'bg-gray-200'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${auto.active ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button onClick={() => deleteAutomation(auto.id)}
                        className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors">
                        Supprimer
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Logs section ── */}
      <div>
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-3xl font-bold text-gray-900">{logs.length}</p>
            <p className="text-sm text-gray-400 mt-1">Total exécutions</p>
          </div>
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-5">
            <p className="text-3xl font-bold text-emerald-600">{successCount}</p>
            <p className="text-sm text-gray-400 mt-1">Emails envoyés</p>
          </div>
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-5">
            <p className="text-3xl font-bold text-red-500">{errorCount}</p>
            <p className="text-sm text-gray-400 mt-1">Échecs</p>
          </div>
        </div>

        {/* Filters + actions */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            {([['all', 'Tous'], ['success', '✓ Succès'], ['error', '✗ Échecs']] as [LogFilter, string][]).map(([v, label]) => (
              <button key={v} onClick={() => setLogFilter(v)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  logFilter === v ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
              🔄 Actualiser
            </button>
            <button onClick={clearLogs}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors">
              🗑 Effacer tout
            </button>
          </div>
        </div>

        {/* Logs table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <p className="text-2xl mb-2">📋</p>
              <p>Aucun log{logFilter !== 'all' ? ` (${logFilter === 'success' ? 'succès' : 'échecs'})` : ''}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  {['Statut', 'Automatisation', 'Candidat', 'Destinataire', 'Étape', 'Date', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredLogs.map(log => (
                  <>
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4">
                        {log.status === 'success' ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full">
                            ✓ Envoyé
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 text-xs font-bold px-3 py-1.5 rounded-full">
                            ✗ Échec
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 font-medium text-gray-700">{log.automation_name || '—'}</td>
                      <td className="px-4 py-4">
                        {log.candidate_name ? (
                          <div>
                            <p className="font-semibold text-gray-900">{log.candidate_name}</p>
                            {log.candidate_title && <p className="text-xs text-gray-400 mt-0.5">{log.candidate_title}</p>}
                          </div>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-4 max-w-[200px]">
                        {log.recipient ? (
                          <span className="text-xs text-blue-600 font-mono truncate block" title={log.recipient}>
                            {log.recipient.length > 35 ? log.recipient.slice(0, 35) + '…' : log.recipient}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 truncate block" title={log.message}>
                            {log.message?.length > 35 ? log.message.slice(0, 35) + '…' : log.message}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {log.stage ? (
                          <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1 rounded-lg">{log.stage}</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-4 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(log.executed_at).toLocaleDateString('fr-FR')}
                        <br />
                        <span className="text-gray-300">{new Date(log.executed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>
                      <td className="px-4 py-4">
                        <button onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                          className="text-gray-300 hover:text-gray-600 transition-colors text-base">
                          {expandedLog === log.id ? '▲' : '▼'}
                        </button>
                      </td>
                    </tr>
                    {expandedLog === log.id && (
                      <tr key={log.id + '-detail'} className="bg-gray-50">
                        <td colSpan={7} className="px-6 py-3">
                          <p className="text-xs text-gray-500 font-mono">{log.message}</p>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Create modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">

            {/* Modal header */}
            <div className="px-7 pt-6 pb-4 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Nouvelle automatisation</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Déclenchez une action automatique lors du changement d&apos;étape</p>
                </div>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none mt-0.5">×</button>
              </div>
            </div>

            <form onSubmit={createAutomation}>
              <div className="flex divide-x divide-gray-100">

                {/* Left — Configuration */}
                <div className="flex-1 px-7 py-6 space-y-6">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Configuration</p>

                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nom de la règle</label>
                    <input type="text" required value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="Ex: Notif entretien n8n"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent" />
                  </div>

                  {/* Trigger */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-yellow-500">⚡</span>
                      <span className="text-sm font-semibold text-gray-800">Déclencheur</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 whitespace-nowrap">Changement vers</span>
                      <select value={form.trigger_value}
                        onChange={e => setForm(p => ({ ...p, trigger_value: e.target.value }))}
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400">
                        {STAGE_OPTIONS.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Action type */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span>🎯</span>
                      <span className="text-sm font-semibold text-gray-800">Action</span>
                    </div>
                    <div className="flex gap-3 mb-4">
                      <button type="button"
                        onClick={() => setForm(p => ({ ...p, action_type: 'send_email' }))}
                        className={`flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                          form.action_type === 'send_email'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}>
                        <span>📧</span> Envoyer un email
                      </button>
                      <button type="button"
                        onClick={() => setForm(p => ({ ...p, action_type: 'webhook' }))}
                        className={`flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                          form.action_type === 'webhook'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}>
                        <span>🔗</span> Webhook (n8n, Zapier…)
                      </button>
                    </div>

                    {form.action_type === 'send_email' ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Template email</label>
                        <select value={form.template_id}
                          onChange={e => setForm(p => ({ ...p, template_id: e.target.value }))}
                          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400">
                          {templates.length === 0
                            ? <option value="">Aucun template disponible</option>
                            : templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                          }
                        </select>
                        <p className="text-xs text-emerald-600 mt-2">✓ L&apos;email sera envoyé à l&apos;adresse du candidat</p>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">URL du webhook</label>
                        <input type="url" required={form.action_type === 'webhook'} value={form.webhook_url}
                          onChange={e => setForm(p => ({ ...p, webhook_url: e.target.value }))}
                          placeholder="https://n8n.example.com/webhook/..."
                          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                        <p className="text-xs text-gray-400 mt-2">Une requête POST sera envoyée avec les données du candidat</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right — Résumé */}
                <div className="w-56 px-6 py-6 bg-gray-50 flex flex-col gap-4">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Résumé</p>

                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-yellow-500 mt-0.5">⚡</span>
                      <span className="text-gray-600">Étape : <strong className="text-gray-900">{form.trigger_value}</strong></span>
                    </div>
                    {form.action_type === 'send_email' ? (
                      <>
                        <div className="flex items-start gap-2">
                          <span className="text-blue-500 mt-0.5">📧</span>
                          <span className="text-gray-600">Template : <strong className="text-gray-900">{selectedTemplate?.name || '—'}</strong></span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-purple-500 mt-0.5">👤</span>
                          <span className="text-gray-600">Destinataire : <strong className="text-gray-900">Email du candidat</strong></span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5">🔗</span>
                        <span className="text-gray-600 break-all text-xs">{form.webhook_url || 'URL non définie'}</span>
                      </div>
                    )}
                  </div>

                  {form.action_type === 'send_email' && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mt-2">
                      <p className="text-xs font-semibold text-blue-700 mb-2">Variables disponibles dans le template :</p>
                      <div className="space-y-1">
                        {['{{candidat.nom}}', '{{offre.titre}}', '{{pipeline.etape}}'].map(v => (
                          <p key={v} className="text-xs font-mono text-blue-600">{v}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-7 py-4 border-t border-gray-100 flex items-center justify-between bg-white">
                <p className="text-xs text-gray-400">
                  {!form.name ? 'Remplissez tous les champs requis' : ''}
                </p>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowForm(false)}
                    className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                    Annuler
                  </button>
                  <button type="submit" disabled={saving || !form.name}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50">
                    <span>⚡</span>
                    {saving ? 'Création…' : 'Créer l\'automatisation'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
