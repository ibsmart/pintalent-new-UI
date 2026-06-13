'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SmtpConfig {
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_password: string;
  smtp_from_name: string;
  smtp_from_email: string;
  smtp_secure: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string;
  created_at: string;
  updated_at: string;
}

interface Automation {
  id: string;
  name: string;
  active: number;
  trigger_type: string;
  trigger_value: string;
  action_type: string;
  action_config: string;
  template_name: string | null;
}

const PIPELINE_STAGES = [
  'Nouveau', 'Présélectionné', 'Entretien', 'Test technique', 'Offre', 'Embauché', 'Rejeté',
];

const VARIABLE_CHIPS = [
  { label: 'candidat.nom', value: '{{candidat.nom}}' },
  { label: 'offre.titre', value: '{{offre.titre}}' },
  { label: 'pipeline.etape', value: '{{pipeline.etape}}' },
  { label: 'recruteur.nom', value: '{{recruteur.nom}}' },
  { label: 'entreprise.nom', value: '{{entreprise.nom}}' },
];

// ─── SMTP Tab ─────────────────────────────────────────────────────────────────

const SMTP_PRESETS = [
  {
    id: 'gmail',
    label: 'Gmail / Workspace',
    icon: '🔵',
    color: 'border-blue-200 hover:border-blue-400 hover:bg-blue-50',
    host: 'smtp.gmail.com', port: '587', secure: 'false',
    steps: [
      '── Gmail personnel (@gmail.com) ──',
      'Allez sur myaccount.google.com → Sécurité, activez la validation en 2 étapes',
      'Recherchez "Mots de passe des applications", créez-en un, copiez le code à 16 caractères',
      '── Google Workspace (@votredomaine.com) ──',
      'Connectez-vous à admin.google.com → Sécurité → Authentification → Validation en 2 étapes → Autorisez les utilisateurs',
      'Une fois la 2FA activée sur votre compte, allez sur myaccount.google.com → recherchez "Mots de passe des applications"',
      'Alternative sans 2FA : admin.google.com → Applications → Google Workspace → Gmail → Paramètres avancés → Relais SMTP, ajoutez votre IP et utilisez smtp-relay.gmail.com port 587',
    ],
    link: 'https://admin.google.com',
    linkLabel: 'Console Admin Google Workspace ↗',
    warning: 'Compte Workspace (@geekfact.ma etc.) : l\'admin doit d\'abord autoriser la validation en 2 étapes pour les utilisateurs avant de pouvoir créer un mot de passe d\'application.',
  },
  {
    id: 'outlook',
    label: 'Outlook / Microsoft 365',
    icon: '🟦',
    color: 'border-sky-200 hover:border-sky-400 hover:bg-sky-50',
    host: 'smtp.office365.com', port: '587', secure: 'false',
    steps: [
      'Activez l\'authentification SMTP dans le centre d\'administration Microsoft 365',
      'Utilisez votre adresse email complète comme nom d\'utilisateur',
      'Utilisez votre mot de passe Microsoft habituel',
      'Si MFA activé, créez un mot de passe d\'application',
    ],
    link: 'https://admin.microsoft.com',
    linkLabel: 'Centre d\'administration Microsoft 365',
    warning: 'L\'auth SMTP de base doit être activée par l\'admin.',
  },
  {
    id: 'hotmail',
    label: 'Hotmail / Live',
    icon: '🟦',
    color: 'border-sky-200 hover:border-sky-400 hover:bg-sky-50',
    host: 'smtp.live.com', port: '587', secure: 'false',
    steps: [
      'Utilisez votre adresse @hotmail.com ou @live.com',
      'Utilisez votre mot de passe habituel',
      'Si connexion refusée, créez un mot de passe d\'application',
    ],
    link: 'https://account.microsoft.com/security',
    linkLabel: 'Sécurité du compte Microsoft',
    warning: null,
  },
  {
    id: 'sendgrid',
    label: 'SendGrid',
    icon: '🟢',
    color: 'border-green-200 hover:border-green-400 hover:bg-green-50',
    host: 'smtp.sendgrid.net', port: '587', secure: 'false',
    steps: [
      'Créez un compte SendGrid (gratuit jusqu\'à 100 emails/jour)',
      'Allez dans Settings → API Keys → Create API Key',
      'Sélectionnez "Full Access" ou "Mail Send"',
      'Utilisateur : apikey (littéralement), mot de passe : votre clé API',
    ],
    link: 'https://app.sendgrid.com/settings/api_keys',
    linkLabel: 'Créer une clé API SendGrid',
    warning: null,
  },
  {
    id: 'mailgun',
    label: 'Mailgun',
    icon: '🟠',
    color: 'border-orange-200 hover:border-orange-400 hover:bg-orange-50',
    host: 'smtp.mailgun.org', port: '587', secure: 'false',
    steps: [
      'Créez un compte Mailgun et ajoutez votre domaine',
      'Allez dans Sending → Domain Settings → SMTP credentials',
      'Copiez le login SMTP et le mot de passe générés',
    ],
    link: 'https://app.mailgun.com/mg/sending/domains',
    linkLabel: 'Paramètres domaine Mailgun',
    warning: null,
  },
  {
    id: 'ovh',
    label: 'OVH Mail',
    icon: '⚫',
    color: 'border-gray-200 hover:border-gray-400 hover:bg-gray-50',
    host: 'ssl0.ovh.net', port: '465', secure: 'true',
    steps: [
      'Utilisez l\'hôte ssl0.ovh.net avec le port 465 (SSL)',
      'Utilisateur : votre adresse email OVH complète',
      'Mot de passe : le mot de passe de votre compte email OVH',
    ],
    link: 'https://www.ovh.com/manager/web',
    linkLabel: 'Espace client OVH',
    warning: null,
  },
];

function SmtpTab() {
  const t = useTranslations('emailSettings');
  const [config, setConfig] = useState<SmtpConfig>({
    smtp_host: '', smtp_port: '587', smtp_user: '', smtp_password: '',
    smtp_from_name: '', smtp_from_email: '', smtp_secure: 'false',
  });
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedGuide, setSelectedGuide] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings/smtp').then(r => r.json()).then(setConfig);
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/settings/smtp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) });
      if (res.ok) setMsg({ type: 'success', text: t('smtpSuccessMsg') });
      else setMsg({ type: 'error', text: t('smtpSaveError') });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!testEmail) return;
    setTesting(true);
    setMsg(null);
    try {
      const res = await fetch('/api/settings/smtp/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: testEmail }) });
      const data = await res.json();
      if (res.ok) setMsg({ type: 'success', text: `${t('smtpTestSentMsg')} ${testEmail}` });
      else setMsg({ type: 'error', text: data.error || t('smtpTestErrorMsg') });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Guide fournisseurs */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-1">{t('smtpProvider')}</h3>
        <p className="text-xs text-gray-400 mb-4">{t('smtpProviderSubtitle')}</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {SMTP_PRESETS.map(p => (
            <button key={p.id} type="button"
              onClick={() => {
                setSelectedGuide(selectedGuide === p.id ? null : p.id);
                setConfig(c => ({ ...c, smtp_host: p.host, smtp_port: p.port, smtp_secure: p.secure }));
              }}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition-all text-sm font-medium ${
                selectedGuide === p.id ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : `border-gray-100 text-gray-700 ${p.color}`
              }`}>
              <span>{p.icon}</span>
              <span className="truncate">{p.label}</span>
            </button>
          ))}
          <button type="button"
            onClick={() => { setSelectedGuide(selectedGuide === 'custom' ? null : 'custom'); }}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition-all text-sm font-medium ${
              selectedGuide === 'custom' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-100 text-gray-700 hover:border-gray-300'
            }`}>
            <span>🔧</span><span>{t('smtpCustom')}</span>
          </button>
        </div>

        {/* Guide détaillé */}
        {selectedGuide && selectedGuide !== 'custom' && (() => {
          const guide = SMTP_PRESETS.find(p => p.id === selectedGuide)!;
          return (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">{t('smtpGuideTitle')} {guide.label}</p>
                <a href={guide.link} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  {guide.linkLabel} ↗
                </a>
              </div>
              <ol className="space-y-1.5">
                {guide.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
              {guide.warning && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <span className="text-amber-500 text-sm flex-shrink-0">⚠</span>
                  <p className="text-xs text-amber-700">{guide.warning}</p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-200 text-xs text-gray-500">
                <div><span className="font-medium text-gray-700">Hôte :</span> {guide.host}</div>
                <div><span className="font-medium text-gray-700">Port :</span> {guide.port}</div>
                <div><span className="font-medium text-gray-700">SSL :</span> {guide.secure === 'true' ? 'Oui' : 'Non (STARTTLS)'}</div>
              </div>
            </div>
          );
        })()}

        {selectedGuide === 'custom' && (
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-xs text-gray-600 space-y-2">
            <p className="font-semibold text-gray-800">Serveur SMTP personnalisé</p>
            <p>Contactez votre hébergeur ou administrateur réseau pour obtenir :</p>
            <ul className="list-disc list-inside space-y-1 text-gray-500">
              <li>L'adresse du serveur SMTP (ex: mail.mondomaine.com)</li>
              <li>Le port (587 = STARTTLS, 465 = SSL, 25 = non chiffré)</li>
              <li>Le nom d'utilisateur (souvent l'email complet)</li>
              <li>Le mot de passe du compte email</li>
            </ul>
          </div>
        )}
      </div>

      {msg && (
        <div className={`p-4 rounded-xl text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {msg.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">{t('smtpServerSection')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('smtpHostLabel')}</label>
              <input type="text" value={config.smtp_host} onChange={e => setConfig(c => ({ ...c, smtp_host: e.target.value }))}
                placeholder="smtp.example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('smtpPortLabel')}</label>
              <input type="number" value={config.smtp_port} onChange={e => setConfig(c => ({ ...c, smtp_port: e.target.value }))}
                placeholder="587"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('smtpUserLabel')}</label>
            <input type="text" value={config.smtp_user} onChange={e => setConfig(c => ({ ...c, smtp_user: e.target.value }))}
              placeholder="user@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('smtpPasswordLabel')}</label>
            <input type="password" value={config.smtp_password} onChange={e => setConfig(c => ({ ...c, smtp_password: e.target.value }))}
              placeholder={t('smtpPasswordPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div className="flex items-center gap-3">
            <button type="button"
              onClick={() => setConfig(c => ({ ...c, smtp_secure: c.smtp_secure === 'true' ? 'false' : 'true' }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.smtp_secure === 'true' ? 'bg-emerald-600' : 'bg-gray-300'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.smtp_secure === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <label className="text-sm font-medium text-gray-700">{t('smtpSslLabel')}</label>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">{t('smtpSenderSection')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('smtpSenderNameLabel')}</label>
              <input type="text" value={config.smtp_from_name} onChange={e => setConfig(c => ({ ...c, smtp_from_name: e.target.value }))}
                placeholder="GEEKFACT Recrutement"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('smtpSenderEmailLabel')}</label>
              <input type="email" value={config.smtp_from_email} onChange={e => setConfig(c => ({ ...c, smtp_from_email: e.target.value }))}
                placeholder="recrutement@geekfact.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 bg-emerald-700 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 disabled:opacity-50 transition-colors">
            {saving ? t('smtpSaving') : t('smtpSaveBtn')}
          </button>
        </div>
      </form>

      <div className="mt-8 bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">{t('smtpTestTitle')}</h3>
        <div className="flex gap-3">
          <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)}
            placeholder="votre@email.com"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <button onClick={handleTest} disabled={testing || !testEmail}
            className="px-5 py-2 bg-gray-800 text-white rounded-xl text-sm font-medium hover:bg-gray-900 disabled:opacity-50 transition-colors">
            {testing ? t('smtpSendTestSending') : t('smtpSendTestBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Templates Tab ────────────────────────────────────────────────────────────

function TemplatesTab() {
  const t = useTranslations('emailSettings');
  const tCommon = useTranslations('common');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [form, setForm] = useState({ name: '', subject: '', body: '' });

  async function load() {
    setLoading(true);
    const data = await fetch('/api/email-templates').then(r => r.json());
    setTemplates(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm({ name: '', subject: '', body: '' });
    setShowModal(true);
  }

  function openEdit(tpl: EmailTemplate) {
    setEditing(tpl);
    setForm({ name: tpl.name, subject: tpl.subject, body: tpl.body });
    setShowModal(true);
  }

  async function handleSave() {
    const url = editing ? `/api/email-templates/${editing.id}` : '/api/email-templates';
    const method = editing ? 'PATCH' : 'POST';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setShowModal(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm(t('templateDeleteConfirm'))) return;
    await fetch(`/api/email-templates/${id}`, { method: 'DELETE' });
    load();
  }

  function insertVariable(varStr: string, field: 'subject' | 'body') {
    setForm(f => ({ ...f, [field]: f[field] + varStr }));
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-gray-500">{templates.length} {templates.length !== 1 ? t('templateCountPlural') : t('templateCount')}</p>
        <button onClick={openNew} className="px-4 py-2 bg-emerald-700 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 transition-colors">
          {t('templateNew')}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">{tCommon('loading')}</div>
      ) : (
        <div className="space-y-3">
          {templates.map(tpl => (
            <div key={tpl.id} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium text-gray-900">{tpl.name}</div>
                <div className="text-sm text-gray-500 mt-0.5 truncate">{tpl.subject}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(JSON.parse(tpl.variables || '[]') as string[]).map(v => (
                    <span key={v} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{`{{${v}}}`}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => openEdit(tpl)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  {tCommon('edit')}
                </button>
                <button onClick={() => handleDelete(tpl.id)} className="px-3 py-1.5 text-sm border border-emerald-200 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors">
                  {tCommon('delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold">{editing ? t('templateEditTitle') : t('templateNewTitle')}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('templateNameLabel')}</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('templateSubjectLabel')}</label>
                <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                <div className="flex flex-wrap gap-1 mt-2">
                  {VARIABLE_CHIPS.map(chip => (
                    <button key={chip.value} type="button" onClick={() => insertVariable(chip.value, 'subject')}
                      className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 transition-colors">
                      {chip.value}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('templateBodyHtml')}</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {VARIABLE_CHIPS.map(chip => (
                    <button key={chip.value} type="button" onClick={() => insertVariable(chip.value, 'body')}
                      className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 transition-colors">
                      {chip.value}
                    </button>
                  ))}
                </div>
                <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                {tCommon('cancel')}
              </button>
              <button onClick={handleSave} disabled={!form.name || !form.subject || !form.body}
                className="px-5 py-2 bg-emerald-700 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 disabled:opacity-50 transition-colors">
                {editing ? t('templateUpdateBtn') : t('templateCreateBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Automations Tab ──────────────────────────────────────────────────────────

const ACTION_TYPES = [
  { value: 'send_email', label: '📧 Envoyer un email', icon: '📧' },
  { value: 'webhook',    label: '🔗 Webhook (n8n, Zapier…)', icon: '🔗' },
];

function AutomationsTab() {
  const t = useTranslations('emailSettings');
  const tCommon = useTranslations('common');
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
const WEBHOOK_FIELDS = [
  { key: 'event',           label: 'event',           desc: '"stage_change"',        always: true },
  { key: 'stage',           label: 'stage',           desc: 'Étape pipeline',        always: true },
  { key: 'candidate_name',  label: 'candidate_name',  desc: 'Nom candidat' },
  { key: 'candidate_email', label: 'candidate_email', desc: 'Email candidat' },
  { key: 'candidate_id',    label: 'candidate_id',    desc: 'ID candidat' },
  { key: 'candidate_phone', label: 'candidate_phone', desc: 'Téléphone' },
  { key: 'job_title',       label: 'job_title',       desc: 'Titre de l\'offre' },
  { key: 'application_id',  label: 'application_id',  desc: 'ID candidature' },
  { key: 'cv_filename',     label: 'cv_filename',     desc: 'Nom du fichier CV' },
  { key: 'cv_url',          label: 'cv_url',          desc: 'URL de téléchargement PDF' },
  { key: 'cv_text',         label: 'cv_text',         desc: 'Contenu texte du CV' },
  { key: 'cv_base64',       label: 'cv_base64',       desc: 'Fichier CV (base64 brut)' },
  { key: 'cv_mimetype',     label: 'cv_mimetype',     desc: 'Type MIME du fichier' },
];

const ALL_WEBHOOK_KEYS = WEBHOOK_FIELDS.filter(f => !f.always).map(f => f.key);

  const [form, setForm] = useState({
    name: '', trigger_value: PIPELINE_STAGES[0],
    action_type: 'send_email', template_id: '',
    webhook_url: '', webhook_method: 'POST',
    webhook_fields: ALL_WEBHOOK_KEYS,
  });

  async function load() {
    setLoading(true);
    const [autos, tpls] = await Promise.all([
      fetch('/api/automations').then(r => r.json()),
      fetch('/api/email-templates').then(r => r.json()),
    ]);
    setAutomations(autos);
    setTemplates(tpls);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleToggle(auto: Automation) {
    await fetch(`/api/automations/${auto.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: auto.active ? 0 : 1 }),
    });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm(t('automationDeleteConfirm'))) return;
    await fetch(`/api/automations/${id}`, { method: 'DELETE' });
    load();
  }

  function buildActionConfig() {
    if (form.action_type === 'send_email') return { template_id: form.template_id };
    if (form.action_type === 'webhook') return {
      url: form.webhook_url,
      method: form.webhook_method,
      fields: form.webhook_fields,
    };
    return {};
  }

  function toggleField(key: string) {
    setForm(f => ({
      ...f,
      webhook_fields: f.webhook_fields.includes(key)
        ? f.webhook_fields.filter(k => k !== key)
        : [...f.webhook_fields, key],
    }));
  }


  function isFormValid() {
    if (!form.name || !form.trigger_value) return false;
    if (form.action_type === 'send_email') return !!form.template_id;
    if (form.action_type === 'webhook')    return !!form.webhook_url;
    return false;
  }

  async function handleCreate() {
    await fetch('/api/automations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        trigger_type: 'stage_change',
        trigger_value: form.trigger_value,
        action_type: form.action_type,
        action_config: buildActionConfig(),
      }),
    });
    setShowModal(false);
    load();
  }

  function actionLabel(auto: Automation) {
    if (auto.action_type === 'send_email') return '📧 Email';
    if (auto.action_type === 'webhook')    return '🔗 Webhook';
    return auto.action_type;
  }

  function actionDetail(auto: Automation) {
    if (auto.action_type === 'send_email') return auto.template_name || '—';
    if (auto.action_type === 'webhook') {
      try {
        const cfg = JSON.parse(auto.action_config);
        return <span className="text-xs text-gray-400 font-mono truncate max-w-[200px] block">{cfg.method} {cfg.url}</span>;
      } catch { return '—'; }
    }
    return '—';
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-gray-500">{automations.length} {automations.length !== 1 ? t('automationCountPlural') : t('automationCount')}</p>
        <button onClick={() => { setForm({ name: '', trigger_value: PIPELINE_STAGES[0], action_type: 'send_email', template_id: templates[0]?.id || '', webhook_url: '', webhook_method: 'POST', webhook_fields: ALL_WEBHOOK_KEYS }); setShowModal(true); }}
          className="px-4 py-2 bg-emerald-700 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 transition-colors">
          {t('automationNew')}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">{tCommon('loading')}</div>
      ) : automations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">⚡</div>
          <p className="text-gray-500">{t('automationNone')}</p>
          <p className="text-sm text-gray-400 mt-1">{t('automationNoneDesc')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left font-medium text-gray-600">{t('automationColName')}</th>
                <th className="px-5 py-3 text-left font-medium text-gray-600">{t('automationColTrigger')}</th>
                <th className="px-5 py-3 text-left font-medium text-gray-600">{t('automationColAction')}</th>
                <th className="px-5 py-3 text-left font-medium text-gray-600">{t('automationColDetail')}</th>
                <th className="px-5 py-3 text-center font-medium text-gray-600">{t('automationColActive')}</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {automations.map(auto => (
                <tr key={auto.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{auto.name}</td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                      {t('automationStage')} {auto.trigger_value}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{actionLabel(auto)}</td>
                  <td className="px-5 py-3 text-gray-500">{actionDetail(auto)}</td>
                  <td className="px-5 py-3 text-center">
                    <button onClick={() => handleToggle(auto)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${auto.active ? 'bg-emerald-600' : 'bg-gray-300'}`}>
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${auto.active ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => handleDelete(auto.id)} className="text-emerald-500 hover:text-emerald-700 text-xs">{tCommon('delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl">
            {/* Header */}
            <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{t('automationNewTitle')}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{t('automationNewSubtitle')}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">&times;</button>
            </div>

            {/* Body — 2 columns */}
            <div className="flex divide-x divide-gray-100">

              {/* LEFT — configuration */}
              <div className="flex-1 p-6 space-y-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('automationConfigSection')}</p>

                {/* Nom */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('automationNameLabel')}</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ex: Notif entretien n8n"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>

                {/* Déclencheur */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">⚡ {t('automationTriggerLabel')}</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 whitespace-nowrap">{t('automationChangeTo')}</span>
                    <select value={form.trigger_value} onChange={e => setForm(f => ({ ...f, trigger_value: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Type d'action */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">🎯 {t('automationActionLabel')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ACTION_TYPES.map(at => (
                      <button key={at.value} type="button"
                        onClick={() => setForm(f => ({ ...f, action_type: at.value }))}
                        className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                          form.action_type === at.value
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                        }`}>
                        <span className="text-base">{at.icon}</span>
                        <span>{at.label.split(' ').slice(1).join(' ')}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Email — template */}
                {form.action_type === 'send_email' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('automationTemplateLabel')}</label>
                    <select value={form.template_id} onChange={e => setForm(f => ({ ...f, template_id: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      <option value="">{t('automationSelectTemplate')}</option>
                      {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    {form.template_id && (
                      <p className="text-xs text-green-600 mt-1.5">✓ {t('automationEmailSentInfo')}</p>
                    )}
                  </div>
                )}

                {/* Webhook — URL + méthode */}
                {form.action_type === 'webhook' && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t('automationWebhookUrl')}</label>
                        <input value={form.webhook_url} onChange={e => setForm(f => ({ ...f, webhook_url: e.target.value }))}
                          placeholder="https://n8n.example.com/webhook/..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>
                      <div className="w-24">
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t('automationWebhookMethod')}</label>
                        <select value={form.webhook_method} onChange={e => setForm(f => ({ ...f, webhook_method: e.target.value }))}
                          className="w-full px-2 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                          <option>POST</option>
                          <option>GET</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT — payload config (webhook) or summary (email) */}
              <div className="w-96 p-6 bg-gray-50 rounded-r-2xl flex flex-col gap-5">

                {form.action_type === 'send_email' && (
                  <>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('automationSummary')}</p>
                    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <span>⚡</span>
                        <span>{t('automationStage')} <strong className="text-gray-900">{form.trigger_value || '—'}</strong></span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <span>📧</span>
                        <span>{t('automationTemplateColon')} <strong className="text-gray-900">{templates.find(tpl => tpl.id === form.template_id)?.name || '—'}</strong></span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <span>👤</span>
                        <span>{t('automationRecipient')} <strong className="text-gray-900">{t('automationCandidateEmail')}</strong></span>
                      </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-600">
                      <p className="font-semibold mb-1">{t('automationVariablesTitle')}</p>
                      <p className="font-mono">{'{{candidat.nom}}'}</p>
                      <p className="font-mono">{'{{offre.titre}}'}</p>
                      <p className="font-mono">{'{{pipeline.etape}}'}</p>
                    </div>
                  </>
                )}

                {form.action_type === 'webhook' && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('automationPayload')}</p>
                      <div className="flex gap-2 text-xs">
                        <button type="button" onClick={() => setForm(f => ({ ...f, webhook_fields: ALL_WEBHOOK_KEYS }))}
                          className="text-emerald-600 hover:underline font-medium">{t('automationPayloadAll')}</button>
                        <span className="text-gray-300">|</span>
                        <button type="button" onClick={() => setForm(f => ({ ...f, webhook_fields: [] }))}
                          className="text-gray-400 hover:underline">{t('automationPayloadNone')}</button>
                      </div>
                    </div>

                    {/* Champs à cocher */}
                    <div className="grid grid-cols-2 gap-1.5">
                      {WEBHOOK_FIELDS.map(field => (
                        <button key={field.key} type="button"
                          disabled={field.always}
                          onClick={() => !field.always && toggleField(field.key)}
                          className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-left transition-all ${
                            field.always
                              ? 'border-gray-200 bg-white text-gray-300 cursor-default'
                              : form.webhook_fields.includes(field.key)
                                ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                                : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                          }`}>
                          <span className={`w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 border ${
                            field.always || form.webhook_fields.includes(field.key)
                              ? 'bg-emerald-600 border-emerald-600'
                              : 'border-gray-300'
                          }`}>
                            {(field.always || form.webhook_fields.includes(field.key)) && (
                              <span className="text-white text-[8px] leading-none">✓</span>
                            )}
                          </span>
                          <span className="text-[11px] font-mono truncate">{field.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Aperçu JSON */}
                    <div className="bg-gray-900 rounded-xl p-3 flex-1">
                      <p className="text-gray-500 text-[10px] mb-2 font-medium uppercase tracking-wide">{t('automationJsonPreview')}</p>
                      <pre className="text-[11px] font-mono text-green-400 leading-relaxed overflow-auto max-h-48">{JSON.stringify({
                        event: 'stage_change',
                        stage: form.trigger_value,
                        ...Object.fromEntries(
                          WEBHOOK_FIELDS
                            .filter(f => !f.always && form.webhook_fields.includes(f.key))
                            .map(f => [f.key, f.key === 'cv_text' ? '<CV text...>' : `<${f.desc}>`])
                        ),
                      }, null, 2)}</pre>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {isFormValid() ? `✓ ${t('automationFormValid')}` : t('automationFormInvalid')}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  {tCommon('cancel')}
                </button>
                <button onClick={handleCreate} disabled={!isFormValid()}
                  className="px-6 py-2.5 bg-emerald-700 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 disabled:opacity-40 transition-colors">
                  ⚡ {t('automationCreateBtn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Historique Tab ───────────────────────────────────────────────────────────

interface AutomationLog {
  id: string;
  automation_id: string | null;
  automation_name: string;
  action_type: string;
  status: 'success' | 'error';
  recipient: string | null;
  subject: string | null;
  candidate_name: string | null;
  job_title: string | null;
  pipeline_stage: string | null;
  error: string | null;
  executed_at: string;
}

function HistoriqueTab() {
  const t = useTranslations('emailSettings');
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [clearing, setClearing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    const data = await fetch(`/api/automation-logs?${params}`).then(r => r.json()).catch(() => []);
    setLogs(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  async function clearAll() {
    if (!confirm(t('historyClearAllConfirm'))) return;
    setClearing(true);
    await fetch('/api/automation-logs', { method: 'DELETE' });
    setClearing(false);
    load();
  }

  const successCount = logs.filter(l => l.status === 'success').length;
  const errorCount   = logs.filter(l => l.status === 'error').length;

  return (
    <div className="max-w-4xl space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: t('historyTotalExec'), value: logs.length, color: 'text-gray-900', bg: 'bg-gray-50 border-gray-200' },
          { label: t('historyEmailsSent'), value: successCount, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
          { label: t('historyErrors'), value: errorCount, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
        ].map(k => (
          <div key={k.label} className={`rounded-2xl border p-4 ${k.bg}`}>
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-gray-500 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtres + actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          {[
            { value: '', label: t('historyFilterAll') },
            { value: 'success', label: t('historyFilterSuccess') },
            { value: 'error', label: t('historyFilterError') },
          ].map(f => (
            <button key={f.value} onClick={() => setFilterStatus(f.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                filterStatus === f.value
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="px-4 py-2 rounded-xl text-sm border border-gray-200 hover:bg-gray-50 transition-colors">
            🔄 {t('historyRefresh')}
          </button>
          {logs.length > 0 && (
            <button onClick={clearAll} disabled={clearing}
              className="px-4 py-2 rounded-xl text-sm border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50">
              {clearing ? '⏳' : `🗑 ${t('historyClearAll')}`}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-6 h-6 border-4 border-emerald-600 border-t-transparent rounded-full" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">📭</div>
            <p className="font-medium">{t('historyNone')}</p>
            <p className="text-sm mt-1">{t('historyNoneDesc')}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3 text-left">{t('historyColStatus')}</th>
                <th className="px-5 py-3 text-left">{t('historyColAutomation')}</th>
                <th className="px-5 py-3 text-left">{t('historyColCandidate')}</th>
                <th className="px-5 py-3 text-left">{t('historyColRecipient')}</th>
                <th className="px-5 py-3 text-left">{t('historyColStage')}</th>
                <th className="px-5 py-3 text-left">{t('historyColDate')}</th>
                <th className="px-5 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map(log => (
                <>
                  <tr key={log.id}
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${expanded === log.id ? 'bg-gray-50' : ''}`}
                    onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        log.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {log.status === 'success' ? t('historyLogSent') : t('historyLogFail')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">{log.automation_name}</td>
                    <td className="px-5 py-3">
                      <div className="text-sm text-gray-900">{log.candidate_name || '–'}</div>
                      {log.job_title && <div className="text-xs text-gray-400">{log.job_title}</div>}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">{log.recipient || '–'}</td>
                    <td className="px-5 py-3">
                      {log.pipeline_stage && (
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{log.pipeline_stage}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">
                      {new Date(log.executed_at).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{expanded === log.id ? '▲' : '▼'}</td>
                  </tr>
                  {expanded === log.id && (
                    <tr key={`${log.id}-detail`} className="bg-blue-50/40">
                      <td colSpan={7} className="px-5 py-3">
                        <div className="text-xs space-y-1.5">
                          {log.subject && (
                            <div><span className="font-semibold text-gray-600">{t('historySubjectDetail')}</span><span className="text-gray-800">{log.subject}</span></div>
                          )}
                          {log.error && (
                            <div className="flex items-start gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                              <span className="text-emerald-500">⚠</span>
                              <span className="text-emerald-700">{log.error}</span>
                            </div>
                          )}
                          <div><span className="font-semibold text-gray-600">{t('historyActionDetail')}</span><span className="text-gray-500">{log.action_type}</span></div>
                        </div>
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
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// TABS defined inside EmailSettingsPage component

export default function EmailSettingsPage() {
  const t = useTranslations('emailSettings');
  const [activeTab, setActiveTab] = useState('smtp');

  const TABS = [
    { id: 'smtp',        label: t('tabSmtp'),        icon: '📧' },
    { id: 'templates',   label: t('tabTemplates'),   icon: '✉️' },
    { id: 'automations', label: t('tabAutomations'), icon: '⚡' },
    { id: 'historique',  label: t('tabHistory'),     icon: '📋' },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-gray-500 mt-1">{t('subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-8">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'smtp'        && <SmtpTab />}
      {activeTab === 'templates'   && <TemplatesTab />}
      {activeTab === 'automations' && <AutomationsTab />}
      {activeTab === 'historique'  && <HistoriqueTab />}
    </div>
  );
}
