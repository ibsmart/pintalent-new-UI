'use client';
import { useState, useEffect } from 'react';

const ALL_PERMISSIONS_LIST = [
  'candidates.view','candidates.create','candidates.delete',
  'jobs.view','jobs.create','jobs.delete',
  'pipeline.view','pipeline.edit',
  'matching.run','notes.add','email.manage',
  'team.manage','data.delete',
];

const PERM_LABELS: Record<string, { label: string; group: string }> = {
  'candidates.view':   { label: 'Voir les candidats',          group: 'Candidats' },
  'candidates.create': { label: 'Ajouter des candidats',       group: 'Candidats' },
  'candidates.delete': { label: 'Supprimer des candidats',     group: 'Candidats' },
  'jobs.view':         { label: 'Voir les offres',             group: 'Offres' },
  'jobs.create':       { label: 'Créer / modifier des offres', group: 'Offres' },
  'jobs.delete':       { label: 'Supprimer des offres',        group: 'Offres' },
  'pipeline.view':     { label: 'Voir le pipeline',            group: 'Pipeline' },
  'pipeline.edit':     { label: 'Modifier les étapes',         group: 'Pipeline' },
  'matching.run':      { label: 'Lancer le matching IA',       group: 'IA & Outils' },
  'notes.add':         { label: 'Ajouter des notes',           group: 'IA & Outils' },
  'email.manage':      { label: 'Gérer les emails',            group: 'IA & Outils' },
  'team.manage':       { label: "Gérer l'équipe",              group: 'Administration' },
  'data.delete':       { label: 'Supprimer des données',       group: 'Administration' },
};

const PERM_GROUPS = ['Candidats', 'Offres', 'Pipeline', 'IA & Outils', 'Administration'];

const NON_ADMIN_ROLES = [
  { id: 'rh',      label: 'Recruteur RH', icon: '🧑‍💼', color: 'text-blue-700' },
  { id: 'manager', label: 'Manager',      icon: '🎯',    color: 'text-purple-700' },
  { id: 'viewer',  label: 'Lecteur',      icon: '👁',    color: 'text-gray-600' },
];

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={disabled ? undefined : onChange}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
        disabled ? 'opacity-40 cursor-default' : 'cursor-pointer'
      } ${checked ? 'bg-green-500' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

// ─── Types & config ───────────────────────────────────────────────────────────

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  active: number;
  avatar_color: string;
  created_at?: string;
  last_login: string | null;
}

const ROLES = [
  {
    id: 'admin',
    label: 'Administrateur',
    icon: '👑',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    desc: 'Accès complet — gestion équipe, paramètres, toutes les fonctions',
    permissions: ['Tout gérer', 'Gestion équipe', 'Paramètres', 'Supprimer des données'],
  },
  {
    id: 'rh',
    label: 'Recruteur RH',
    icon: '🧑‍💼',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    desc: 'Gestion complète des candidats, offres, pipeline et emails',
    permissions: ['Candidats', 'Offres', 'Pipeline', 'Email & Automatisations', 'Matching IA'],
  },
  {
    id: 'manager',
    label: 'Manager',
    icon: '🎯',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    desc: 'Consultation du pipeline, ajout de notes, changement d\'étape',
    permissions: ['Voir candidats', 'Pipeline (modifier étape)', 'Ajouter des notes', 'Voir offres'],
  },
  {
    id: 'viewer',
    label: 'Lecteur',
    icon: '👁',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    desc: 'Accès en lecture seule — aucune modification possible',
    permissions: ['Voir candidats', 'Voir offres', 'Voir pipeline'],
  },
];

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#22c55e', '#14b8a6', '#0ea5e9', '#b91c1c',
];

function getRoleConfig(roleId: string) {
  return ROLES.find(r => r.id === roleId) || ROLES[1];
}

function Avatar({ user, size = 'md' }: { user: User; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-xl' : 'w-10 h-10 text-sm';
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0`}
      style={{ backgroundColor: user.avatar_color }}>
      {user.name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'rh', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  async function handleCreate() {
    if (!form.name || !form.email) { setError('Nom et email requis'); return; }
    setSaving(true); setError('');
    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, password: form.password || 'ChangeMe2024!' }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Erreur'); setSaving(false); return; }
    await onCreated(); // await the refresh before closing
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Ajouter un membre</h2>
            <p className="text-xs text-gray-400 mt-0.5">Le membre pourra se connecter avec ces identifiants</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          {/* Nom + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Marie Dupont"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="marie@entreprise.com"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>

          {/* Rôle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rôle</label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map(role => (
                <button key={role.id} type="button" onClick={() => setForm(f => ({ ...f, role: role.id }))}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
                    form.role === role.id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <span className="text-lg mt-0.5">{role.icon}</span>
                  <div>
                    <p className={`text-sm font-semibold ${form.role === role.id ? 'text-emerald-700' : 'text-gray-900'}`}>{role.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-tight">{role.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Mot de passe */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe temporaire
              <span className="text-gray-400 font-normal ml-1">(défaut : ChangeMe2024!)</span>
            </label>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="ChangeMe2024!"
                className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
                {showPwd ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {error && <p className="text-emerald-600 text-sm bg-emerald-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>
        <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            Annuler
          </button>
          <button onClick={handleCreate} disabled={saving || !form.name || !form.email}
            className="px-6 py-2.5 bg-emerald-700 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 disabled:opacity-40 transition-colors">
            {saving ? '⏳ Création…' : '✚ Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ name: user.name, role: user.role, avatar_color: user.avatar_color, password: '' });
  const [saving, setSaving] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  async function handleSave() {
    setSaving(true);
    const payload: Record<string, unknown> = { name: form.name, role: form.role, avatar_color: form.avatar_color };
    if (form.password) payload.password = form.password;
    await fetch(`/api/team/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    await onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Avatar user={{ ...user, avatar_color: form.avatar_color }} size="md" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{user.name}</h2>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">&times;</button>
        </div>
        <div className="p-6 space-y-5">
          {/* Nom */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>

          {/* Couleur avatar */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Couleur avatar</label>
            <div className="flex gap-2">
              {AVATAR_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, avatar_color: c }))}
                  className={`w-7 h-7 rounded-full transition-transform ${form.avatar_color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* Rôle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rôle</label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map(role => (
                <button key={role.id} type="button" onClick={() => setForm(f => ({ ...f, role: role.id }))}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                    form.role === role.id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <span>{role.icon}</span>
                  <div>
                    <p className={`text-sm font-semibold leading-tight ${form.role === role.id ? 'text-emerald-700' : 'text-gray-900'}`}>{role.label}</p>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">{getRoleConfig(form.role).desc}</p>
          </div>

          {/* Nouveau mot de passe */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nouveau mot de passe <span className="text-gray-400 font-normal">(laisser vide pour ne pas changer)</span>
            </label>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Nouveau mot de passe…"
                className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                {showPwd ? '🙈' : '👁'}
              </button>
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Annuler</button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2.5 bg-emerald-700 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 disabled:opacity-40 transition-colors">
            {saving ? '⏳' : '💾 Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'team' | 'permissions'>('team');
  const [perms, setPerms] = useState<Record<string, Record<string, boolean>>>({});
  const [permsLoading, setPermsLoading] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState('');

  async function load(): Promise<void> {
    setLoading(true);
    try {
      const data = await fetch('/api/team').then(r => r.json());
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setCurrentUserRole(d.role || ''));
    setPermsLoading(true);
    fetch('/api/permissions').then(r => r.json()).then(d => {
      setPerms(d.permissions || {});
      setPermsLoading(false);
    });
  }, []);

  async function togglePerm(role: string, permission: string) {
    const current = perms[role]?.[permission] ?? false;
    setPerms(prev => ({
      ...prev,
      [role]: { ...prev[role], [permission]: !current }
    }));
    const res = await fetch('/api/permissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, permission, enabled: !current }),
    });
    if (!res.ok) {
      setPerms(prev => ({
        ...prev,
        [role]: { ...prev[role], [permission]: current }
      }));
    }
  }

  async function toggleActive(user: User) {
    await fetch(`/api/team/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: user.active ? 0 : 1 }),
    });
    load();
  }

  async function deleteUser(user: User) {
    if (!confirm(`Supprimer ${user.name} définitivement ?`)) return;
    const res = await fetch(`/api/team/${user.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    load();
  }

  const activeUsers = users.filter(u => u.active === 1);
  const inactiveUsers = users.filter(u => u.active === 0);

  return (
    <div className="p-8 max-w-5xl">
      {/* Tab switcher — only show Permissions tab for admin */}
      {currentUserRole === 'admin' && (
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
          {[
            { id: 'team', label: '👥 Équipe' },
            { id: 'permissions', label: '🔐 Permissions' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as 'team' | 'permissions')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'permissions' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Permissions par rôle</h2>
            <p className="text-sm text-gray-500 mt-1">Activez ou désactivez les permissions pour chaque rôle. Les permissions Admin sont fixes.</p>
          </div>

          {permsLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin w-6 h-6 border-4 border-emerald-600 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-5 bg-gray-50 border-b border-gray-100">
                <div className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Permission</div>
                {/* Admin locked column */}
                <div className="px-4 py-4 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-lg">👑</span>
                    <span className="text-xs font-semibold text-yellow-700">Admin</span>
                    <span className="text-xs text-gray-400 bg-yellow-50 border border-yellow-100 rounded-full px-2 py-0.5">Tout accès</span>
                  </div>
                </div>
                {NON_ADMIN_ROLES.map(r => (
                  <div key={r.id} className="px-4 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-lg">{r.icon}</span>
                      <span className={`text-xs font-semibold ${r.color}`}>{r.label}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Permission rows grouped */}
              {PERM_GROUPS.map(group => {
                const groupPerms = ALL_PERMISSIONS_LIST.filter(p => PERM_LABELS[p]?.group === group);
                if (groupPerms.length === 0) return null;
                return (
                  <div key={group}>
                    <div className="grid grid-cols-5 bg-gray-50/50 border-y border-gray-100">
                      <div className="px-6 py-2 col-span-5">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{group}</span>
                      </div>
                    </div>
                    {groupPerms.map(perm => (
                      <div key={perm} className="grid grid-cols-5 border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <div className="px-6 py-3.5 flex items-center">
                          <span className="text-sm text-gray-700">{PERM_LABELS[perm]?.label}</span>
                        </div>
                        {/* Admin: always on, locked */}
                        <div className="px-4 py-3.5 flex items-center justify-center">
                          <span className="text-green-500 font-bold text-base">✓</span>
                        </div>
                        {NON_ADMIN_ROLES.map(r => (
                          <div key={r.id} className="px-4 py-3.5 flex items-center justify-center">
                            <Toggle
                              checked={perms[r.id]?.[perm] ?? false}
                              onChange={() => togglePerm(r.id, perm)}
                            />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'team' && <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion d&apos;équipe</h1>
          <p className="text-gray-400 text-sm mt-1">{activeUsers.length} membre{activeUsers.length !== 1 ? 's' : ''} actif{activeUsers.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-700 text-white rounded-xl font-medium text-sm hover:bg-emerald-800 transition-colors shadow-sm">
          ✚ Ajouter un membre
        </button>
      </div>

      {/* Rôles legend */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {ROLES.map(role => (
          <div key={role.id} className={`rounded-2xl border p-4 ${role.color}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{role.icon}</span>
              <span className="font-semibold text-sm">{role.label}</span>
            </div>
            <ul className="space-y-1">
              {role.permissions.map(p => (
                <li key={p} className="text-xs flex items-center gap-1 opacity-80">
                  <span>✓</span><span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Team list */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Chargement…</div>
      ) : (
        <div className="space-y-6">
          {/* Active */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="font-semibold text-gray-700 text-sm">Membres actifs — {activeUsers.length}</h2>
            </div>
            {activeUsers.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">Aucun membre actif</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-50">
                    <th className="px-6 py-3 text-left">Membre</th>
                    <th className="px-6 py-3 text-left">Rôle</th>
                    <th className="px-6 py-3 text-left">Ajouté le</th>
                    <th className="px-6 py-3 text-left">Dernière connexion</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {activeUsers.map(user => {
                    const role = getRoleConfig(user.role);
                    return (
                      <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar user={user} size="md" />
                            <div>
                              <p className="font-semibold text-gray-900 text-sm">{user.name}</p>
                              <p className="text-xs text-gray-400">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${role.color}`}>
                            <span>{role.icon}</span>
                            <span>{role.label}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-400">
                          {user.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-400">
                          {user.last_login ? new Date(user.last_login).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Jamais'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => setEditing(user)}
                              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                              ✏️ Modifier
                            </button>
                            <button onClick={() => toggleActive(user)}
                              className="px-3 py-1.5 text-xs text-orange-600 hover:bg-orange-50 rounded-lg transition-colors">
                              ⏸ Désactiver
                            </button>
                            <button onClick={() => deleteUser(user)}
                              className="px-3 py-1.5 text-xs text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors">
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Inactive */}
          {inactiveUsers.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden opacity-70">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <h2 className="font-semibold text-gray-500 text-sm">Membres désactivés — {inactiveUsers.length}</h2>
              </div>
              <table className="w-full">
                <tbody className="divide-y divide-gray-50">
                  {inactiveUsers.map(user => {
                    const role = getRoleConfig(user.role);
                    return (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-sm flex-shrink-0">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-gray-500 text-sm">{user.name}</p>
                              <p className="text-xs text-gray-400">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <span className="text-xs text-gray-400">{role.icon} {role.label}</span>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => toggleActive(user)}
                              className="px-3 py-1.5 text-xs text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                              ▶ Réactiver
                            </button>
                            <button onClick={() => deleteUser(user)}
                              className="px-3 py-1.5 text-xs text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors">
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onCreated={load} />}
      {editing && <EditModal user={editing} onClose={() => setEditing(null)} onSaved={load} />}
      </div>}
    </div>
  );
}
