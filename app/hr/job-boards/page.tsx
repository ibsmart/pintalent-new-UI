'use client';
import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Integration {
  id: string;
  platform: string;
  active: number;
  config: string;
}

interface JobPosting {
  id: string;
  job_id: string;
  job_title: string;
  platform: string;
  status: 'published' | 'error' | 'pending';
  external_url: string | null;
  error: string | null;
  posted_at: string | null;
  created_at: string;
}

interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  status: string;
}

// ─── Platforms config ─────────────────────────────────────────────────────────

const PLATFORMS = [
  {
    id: 'linkedin',
    name: 'LinkedIn',
    logo: '🔵',
    color: 'bg-[#0077B5]/10 border-[#0077B5]/30 text-[#0077B5]',
    colorActive: 'bg-[#0077B5]',
    desc: 'Réseau professionnel n°1 mondial',
    method: 'webhook',
    badge: 'Via webhook / n8n',
    fields: [
      { key: 'webhook_url', label: 'URL Webhook (n8n / Zapier)', placeholder: 'https://n8n.example.com/webhook/linkedin', type: 'url' },
      { key: 'company_id', label: 'Company ID LinkedIn (optionnel)', placeholder: '12345678', type: 'text' },
    ],
    guide: [
      'Dans n8n, créez un workflow avec un nœud "Webhook" en entrée',
      'Connectez-le à un nœud "LinkedIn" → "Create Job Posting" (nécessite OAuth LinkedIn)',
      'Copiez l\'URL du webhook n8n dans le champ ci-dessus',
      'Alternative : utilisez Zapier avec le trigger "Webhook" → action LinkedIn',
    ],
    helpUrl: 'https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.linkedin/',
  },
  {
    id: 'indeed',
    name: 'Indeed',
    logo: '🔷',
    color: 'bg-[#003A9B]/10 border-[#003A9B]/30 text-[#003A9B]',
    colorActive: 'bg-[#003A9B]',
    desc: 'Premier moteur de recherche d\'emploi',
    method: 'webhook',
    badge: 'Via webhook / flux XML',
    fields: [
      { key: 'webhook_url', label: 'URL Webhook (n8n / Zapier)', placeholder: 'https://n8n.example.com/webhook/indeed', type: 'url' },
      { key: 'publisher_id', label: 'Indeed Publisher ID (optionnel)', placeholder: 'pub-xxxxxxxxxxxx', type: 'text' },
    ],
    guide: [
      'Option 1 — Webhook n8n : créez un workflow Webhook → Indeed Job Post',
      'Option 2 — Flux XML : Indeed crawle automatiquement votre flux XML d\'offres',
      'Votre flux XML est disponible sur : /api/job-boards/feed/indeed',
      'Soumettez ce lien à Indeed via : indeed.com/publisher',
    ],
    helpUrl: 'https://indeed.com/publisher',
  },
  {
    id: 'hellowork',
    name: 'HelloWork',
    logo: '🟠',
    color: 'bg-orange-50 border-orange-200 text-orange-700',
    colorActive: 'bg-orange-500',
    desc: 'Plateforme emploi française #1',
    method: 'webhook',
    badge: 'Via webhook / n8n',
    fields: [
      { key: 'webhook_url', label: 'URL Webhook', placeholder: 'https://n8n.example.com/webhook/hellowork', type: 'url' },
      { key: 'api_key', label: 'Clé API HelloWork (optionnel)', placeholder: 'hw_xxxxxxxxxxxxxxxx', type: 'text' },
    ],
    guide: [
      'Contactez HelloWork pour obtenir un accès API employeur',
      'Configurez un workflow n8n avec le webhook en entrée',
      'Mappez les champs : title, location, contract_type, description',
      'HelloWork propose aussi une intégration via flux XML/JSON',
    ],
    helpUrl: 'https://www.hellowork.com/fr-fr/employeurs/',
  },
  {
    id: 'apec',
    name: 'APEC',
    logo: '🟢',
    color: 'bg-green-50 border-green-200 text-green-700',
    colorActive: 'bg-green-600',
    desc: 'Association Pour l\'Emploi des Cadres',
    method: 'webhook',
    badge: 'Via webhook / n8n',
    fields: [
      { key: 'webhook_url', label: 'URL Webhook', placeholder: 'https://n8n.example.com/webhook/apec', type: 'url' },
      { key: 'login', label: 'Login recruteur APEC', placeholder: 'recruteur@entreprise.com', type: 'email' },
    ],
    guide: [
      'Créez un compte recruteur sur apec.fr',
      'L\'API APEC est accessible via partenariat — contactez partenaires@apec.fr',
      'En attendant, utilisez n8n avec le webhook + nœud HTTP pour poster via l\'API APEC',
      'Consultez la documentation : https://api.apec.fr',
    ],
    helpUrl: 'https://www.apec.fr/recruteur.html',
  },
  {
    id: 'custom_webhook',
    name: 'Webhook personnalisé',
    logo: '🔗',
    color: 'bg-purple-50 border-purple-200 text-purple-700',
    colorActive: 'bg-purple-600',
    desc: 'N\'importe quelle plateforme via webhook',
    method: 'webhook',
    badge: 'Webhook générique',
    fields: [
      { key: 'webhook_url', label: 'URL Webhook', placeholder: 'https://...', type: 'url' },
      { key: 'platform_name', label: 'Nom de la plateforme (affiché dans les logs)', placeholder: 'Ma plateforme RH', type: 'text' },
    ],
    guide: [
      'Configurez votre endpoint pour recevoir un POST JSON',
      'Payload envoyé : title, department, location, contract_type, description, missions, profile, keywords, experience',
      'Vous pouvez utiliser n8n, Make, Zapier ou votre propre API',
      'Le statut (succès/erreur) est logué dans l\'historique ci-dessous',
    ],
    helpUrl: null,
  },
];

// ─── Payload preview ──────────────────────────────────────────────────────────

const PAYLOAD_EXAMPLE = {
  platform: 'linkedin',
  job_id: 'job-xxx',
  title: 'Développeur Full Stack Senior',
  department: 'IT',
  location: 'Casablanca',
  contract_type: 'CDI',
  description: '...',
  missions: '...',
  profile: '...',
  keywords: 'React, Node.js, TypeScript',
  experience: '5 ans+',
  education: 'Bac+5',
};

// ─── Platform Card ────────────────────────────────────────────────────────────

function PlatformCard({
  platform,
  integration,
  onSave,
  onToggle,
}: {
  platform: typeof PLATFORMS[0];
  integration: Integration | undefined;
  onSave: (platform: string, config: Record<string, string>) => Promise<void>;
  onToggle: (platform: string, active: boolean) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPayload, setShowPayload] = useState(false);
  const config = integration ? (JSON.parse(integration.config || '{}') as Record<string, string>) : {};
  const [form, setForm] = useState<Record<string, string>>(config);
  const isActive = integration?.active === 1;
  const isConfigured = !!config.webhook_url;

  async function handleSave() {
    setSaving(true);
    await onSave(platform.id, form);
    setSaving(false);
    setOpen(false);
  }

  return (
    <div className={`bg-white rounded-2xl border-2 transition-all ${isActive ? 'border-gray-900 shadow-md' : 'border-gray-100'}`}>
      {/* Header */}
      <div className="p-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`w-11 h-11 rounded-xl border-2 flex items-center justify-center text-xl flex-shrink-0 ${platform.color}`}>
            {platform.logo}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">{platform.name}</span>
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{platform.badge}</span>
              {isConfigured && (
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">✓ Configuré</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{platform.desc}</p>
          </div>
        </div>
        {/* Toggle */}
        <button
          onClick={() => onToggle(platform.id, !isActive)}
          disabled={!isConfigured}
          title={!isConfigured ? 'Configurez d\'abord le webhook' : ''}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-30 ${isActive ? 'bg-gray-900' : 'bg-gray-200'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Config button */}
      <div className="px-5 pb-5 flex gap-2">
        <button onClick={() => setOpen(!open)}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
          {open ? '▲ Fermer' : '⚙ Configurer'}
        </button>
        <button onClick={() => setShowPayload(!showPayload)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-400 hover:bg-gray-50 transition-colors">
          {'{ }'}
        </button>
        {platform.helpUrl && (
          <a href={platform.helpUrl} target="_blank" rel="noopener"
            className="px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-400 hover:bg-gray-50 transition-colors">
            ↗
          </a>
        )}
      </div>

      {/* Config panel */}
      {open && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-3 bg-gray-50 rounded-b-2xl">
          {platform.fields.map(field => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{field.label}</label>
              <input
                type={field.type}
                value={form[field.key] || ''}
                onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          ))}

          {/* Guide */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
            <p className="text-xs font-semibold text-blue-700 mb-2">📋 Guide de configuration</p>
            <ol className="space-y-1">
              {platform.guide.map((step, i) => (
                <li key={i} className="text-xs text-blue-600 flex gap-1.5">
                  <span className="font-bold flex-shrink-0">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => setOpen(false)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs hover:bg-white transition-colors">
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 px-3 py-2 bg-gray-900 text-white rounded-xl text-xs font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
              {saving ? '⏳ Sauvegarde...' : '💾 Sauvegarder'}
            </button>
          </div>
        </div>
      )}

      {/* Payload preview */}
      {showPayload && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-900 rounded-b-2xl">
          <p className="text-xs text-gray-400 mb-2 font-medium">📦 Payload envoyé (POST JSON)</p>
          <pre className="text-xs font-mono text-green-400 overflow-x-auto leading-relaxed">
            {JSON.stringify({ ...PAYLOAD_EXAMPLE, platform: platform.id }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Publish Modal ─────────────────────────────────────────────────────────────

function PublishModal({
  jobs,
  integrations,
  onClose,
  onDone,
}: {
  jobs: Job[];
  integrations: Integration[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [selectedJob, setSelectedJob] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState<Record<string, { status: string; external_url?: string; error?: string }> | null>(null);

  const activeIntegrations = integrations.filter(i => i.active === 1);

  function togglePlatform(id: string) {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  }

  async function handlePublish() {
    if (!selectedJob || selectedPlatforms.length === 0) return;
    setPublishing(true);
    const res = await fetch('/api/job-boards/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: selectedJob, platforms: selectedPlatforms }),
    }).then(r => r.json()).catch(() => ({ results: {} }));
    setResults(res.results);
    setPublishing(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Diffuser une offre</h2>
            <p className="text-xs text-gray-400 mt-0.5">Publiez en un clic sur plusieurs plateformes</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {results ? (
          /* Results */
          <div className="p-6 space-y-3">
            <p className="text-sm font-medium text-gray-700 mb-4">Résultats de la diffusion :</p>
            {Object.entries(results).map(([platform, result]) => {
              const p = PLATFORMS.find(p => p.id === platform);
              return (
                <div key={platform} className={`flex items-center gap-3 p-3 rounded-xl border ${
                  result.status === 'published' ? 'bg-green-50 border-green-200' : 'bg-emerald-50 border-emerald-200'
                }`}>
                  <span className="text-xl">{p?.logo || '🔗'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{p?.name || platform}</p>
                    {result.status === 'published' ? (
                      <p className="text-xs text-green-600">
                        ✓ Publié avec succès
                        {result.external_url && (
                          <a href={result.external_url} target="_blank" rel="noopener"
                            className="ml-2 underline">Voir l&apos;offre ↗</a>
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-emerald-600">✕ {result.error}</p>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="pt-2 flex gap-2">
              <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                Fermer
              </button>
              <button onClick={() => { setResults(null); onDone(); }}
                className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors">
                Voir l&apos;historique
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Sélection offre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Offre à diffuser</label>
              <select value={selectedJob} onChange={e => setSelectedJob(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="">— Sélectionner une offre —</option>
                {jobs.map(j => (
                  <option key={j.id} value={j.id}>{j.title} · {j.department} · {j.location}</option>
                ))}
              </select>
            </div>

            {/* Sélection plateformes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Plateformes</label>
              {activeIntegrations.length === 0 ? (
                <div className="text-center py-6 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm text-amber-700">⚠ Aucune intégration active.</p>
                  <p className="text-xs text-amber-500 mt-1">Configurez et activez au moins une plateforme.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeIntegrations.map(integration => {
                    const p = PLATFORMS.find(p => p.id === integration.platform);
                    if (!p) return null;
                    const selected = selectedPlatforms.includes(integration.platform);
                    return (
                      <button key={integration.platform} onClick={() => togglePlatform(integration.platform)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                          selected ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
                        }`}>
                        <span className="text-xl">{p.logo}</span>
                        <span className="font-medium text-sm text-gray-900">{p.name}</span>
                        <span className="ml-auto">
                          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs ${
                            selected ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-300'
                          }`}>{selected && '✓'}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                Annuler
              </button>
              <button onClick={handlePublish}
                disabled={!selectedJob || selectedPlatforms.length === 0 || publishing}
                className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-40 transition-colors">
                {publishing ? '⏳ Diffusion en cours...' : `🚀 Diffuser sur ${selectedPlatforms.length} plateforme${selectedPlatforms.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistorySection({ refresh }: { refresh: boolean }) {
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetch('/api/job-boards/publish').then(r => r.json()).catch(() => []);
    setPostings(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load, refresh]);

  const platformName = (id: string) => PLATFORMS.find(p => p.id === id)?.name || id;
  const platformLogo = (id: string) => PLATFORMS.find(p => p.id === id)?.logo || '🔗';

  if (loading) return <div className="text-center py-8 text-gray-400 text-sm">Chargement...</div>;
  if (postings.length === 0) return (
    <div className="text-center py-12 text-gray-400">
      <div className="text-4xl mb-2">📭</div>
      <p className="text-sm">Aucune diffusion pour l&apos;instant.</p>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Offre</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Plateforme</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Lien</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {postings.map(p => (
            <tr key={p.id} className="hover:bg-gray-50">
              <td className="px-5 py-3">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  p.status === 'published' ? 'bg-green-100 text-green-700' :
                  p.status === 'error'     ? 'bg-emerald-100 text-emerald-700' :
                                             'bg-yellow-100 text-yellow-700'
                }`}>
                  {p.status === 'published' ? '✓ Publié' : p.status === 'error' ? '✕ Erreur' : '⏳ En attente'}
                </span>
                {p.error && <p className="text-xs text-emerald-400 mt-1 max-w-[200px] truncate">{p.error}</p>}
              </td>
              <td className="px-5 py-3 font-medium text-gray-900">{p.job_title}</td>
              <td className="px-5 py-3">
                <span className="flex items-center gap-1.5">
                  <span>{platformLogo(p.platform)}</span>
                  <span className="text-gray-700">{platformName(p.platform)}</span>
                </span>
              </td>
              <td className="px-5 py-3 text-xs text-gray-400">
                {p.posted_at
                  ? new Date(p.posted_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : new Date(p.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </td>
              <td className="px-5 py-3">
                {p.external_url ? (
                  <a href={p.external_url} target="_blank" rel="noopener"
                    className="text-xs text-blue-600 hover:underline">Voir ↗</a>
                ) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JobBoardsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [showPublish, setShowPublish] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(false);

  async function loadIntegrations() {
    const data = await fetch('/api/job-boards').then(r => r.json()).catch(() => []);
    setIntegrations(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    loadIntegrations();
    fetch('/api/jobs?status=active').then(r => r.json()).then(d => setJobs(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  async function handleSave(platform: string, config: Record<string, string>) {
    await fetch('/api/job-boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, config, active: 0 }),
    });
    await loadIntegrations();
  }

  async function handleToggle(platform: string, active: boolean) {
    await fetch('/api/job-boards', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, active: active ? 1 : 0 }),
    });
    await loadIntegrations();
  }

  const activeCount = integrations.filter(i => i.active === 1).length;

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Diffusion d&apos;offres</h1>
          <p className="text-gray-400 text-sm mt-1">
            Publiez vos offres d&apos;emploi sur LinkedIn, Indeed, HelloWork et d&apos;autres plateformes.
          </p>
        </div>
        <button onClick={() => setShowPublish(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl font-medium text-sm hover:bg-gray-800 transition-colors shadow-sm">
          🚀 Diffuser une offre
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Plateformes configurées', value: integrations.length, icon: '🔌' },
          { label: 'Actives', value: activeCount, icon: '✅' },
          { label: 'Plateformes disponibles', value: PLATFORMS.length, icon: '🌐' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
            <span className="text-2xl">{k.icon}</span>
            <div>
              <div className="text-2xl font-bold text-gray-900">{k.value}</div>
              <div className="text-xs text-gray-400">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Platform cards */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Intégrations disponibles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PLATFORMS.map(platform => (
            <PlatformCard
              key={platform.id}
              platform={platform}
              integration={integrations.find(i => i.platform === platform.id)}
              onSave={handleSave}
              onToggle={handleToggle}
            />
          ))}
        </div>
      </div>

      {/* History */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Historique des diffusions</h2>
          <button onClick={() => setHistoryRefresh(r => !r)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors">🔄 Actualiser</button>
        </div>
        <HistorySection refresh={historyRefresh} />
      </div>

      {/* Publish modal */}
      {showPublish && (
        <PublishModal
          jobs={jobs}
          integrations={integrations}
          onClose={() => setShowPublish(false)}
          onDone={() => { setShowPublish(false); setHistoryRefresh(r => !r); }}
        />
      )}
    </div>
  );
}
