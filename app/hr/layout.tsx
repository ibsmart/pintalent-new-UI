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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => setUser(d));
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const sidebarContent = (
    <>
      {/* Logo */}
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

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
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

      {/* Footer */}
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
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* ── Desktop sidebar (always visible ≥ lg) ── */}
      <aside className="hidden lg:flex w-64 bg-gray-900 text-white flex-col fixed inset-y-0 left-0 z-50">
        {sidebarContent}
      </aside>

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Mobile sidebar (drawer) ── */}
      <aside className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-gray-900 text-white flex flex-col transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Close button */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
          aria-label="Fermer le menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
        {sidebarContent}
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">

        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            aria-label="Ouvrir le menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-700 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">GF</span>
            </div>
            <span className="font-semibold text-gray-900 text-sm">GEEKFACT</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1">
          <PermissionsProvider>
            {children}
          </PermissionsProvider>
        </main>
      </div>
    </div>
  );
}
