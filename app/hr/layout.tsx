'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { PermissionsProvider } from '@/lib/permissions-context';

interface SessionUser { id: string; name: string; email: string; role: string; avatar_color: string; }

const ROLE_LABELS: Record<string, string> = { admin: 'Admin', rh: 'Recruteur RH', manager: 'Manager', viewer: 'Lecteur' };

const NAV_ITEMS = [
  { href: '/hr/dashboard', label: 'Tableau de bord', icon: '📊' },
  { href: '/hr/projects', label: 'Campagnes', icon: '📁' },
  { href: '/hr/pipeline', label: 'Pipeline', icon: '🎯' },
  { href: '/hr/candidates', label: 'Candidats', icon: '👥' },
  { href: '/hr/jobs', label: 'Offres d\'emploi', icon: '📋' },
  { href: '/hr/prospecting', label: 'Prospection', icon: '✉️' },
  { href: '/hr/settings', label: 'Personnalisation', icon: '🎨' },
  { href: '/hr/job-boards', label: 'Diffusion offres', icon: '📡' },
  { href: '/hr/team', label: 'Équipe', icon: '👥' },
  { href: '/hr/cv-templates', label: 'Templates CV', icon: '📄' },
  { href: '/hr/email-settings', label: 'Paramètres', icon: '⚙️' },
];

export default function HRLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => setUser(d));
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col fixed inset-y-0 left-0 z-50">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-700 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs">GF</span>
            </div>
            <div>
              <div className="font-bold text-sm">GEEKFACT</div>
              <div className="text-gray-400 text-xs">CRM Recrutement</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map(item => (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                pathname === item.href || pathname.startsWith(item.href + '/')
                  ? 'bg-emerald-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800 space-y-1">
          <Link href="/" className="flex items-center gap-3 px-4 py-2 text-gray-400 hover:text-white text-sm rounded-lg hover:bg-gray-800 transition-colors">
            <span>🌐</span>
            <span>Site public</span>
          </Link>

          {user && (
            <div className="mt-2 pt-2 border-t border-gray-800">
              <div className="flex items-center gap-3 px-4 py-2 mb-1">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: user.avatar_color || '#6366f1' }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-white text-xs font-medium truncate">{user.name}</p>
                  <p className="text-gray-500 text-xs">{ROLE_LABELS[user.role] || user.role}</p>
                </div>
              </div>
              <button onClick={logout}
                className="w-full flex items-center gap-3 px-4 py-2 text-gray-400 hover:text-emerald-400 text-sm rounded-lg hover:bg-gray-800 transition-colors">
                <span>↩</span>
                <span>Déconnexion</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-64 min-h-screen">
        <PermissionsProvider>
          {children}
        </PermissionsProvider>
      </main>
    </div>
  );
}
