'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { PermissionsProvider } from '@/lib/permissions-context';
import { useTranslations, useLocale } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';

interface SessionUser { id: string; name: string; email: string; role: string; avatar_color: string; }
interface Counts { jobs?: number; candidates?: number; interviews?: number; }

const ROLE_LABELS: Record<string, string> = { admin: 'Admin', rh: 'Recruteur RH', manager: 'Manager', viewer: 'Lecteur' };

// ── SVG Icons ──────────────────────────────────────────────
function IconGrid() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
}
function IconBriefcase() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>;
}
function IconUsers() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function IconKanban() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="11" rx="1"/><rect x="17" y="3" width="5" height="14" rx="1"/></svg>;
}
function IconCalendar() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
}
function IconBarChart() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
}
function IconStar() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
}
function IconMail() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
}
function IconGlobe() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
}
function IconSettings() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
}
function IconPalette() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>;
}
function IconTeam() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4.354a4 4 0 1 1 0 5.292"/><path d="M15 21H3v-1a6 6 0 0 1 12 0v1zm0 0h6v-1a6 6 0 0 0-9-5.197"/></svg>;
}
function IconRobot() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="15" x2="8" y2="15"/><line x1="16" y1="15" x2="16" y2="15"/><circle cx="8" cy="15" r="1" fill="currentColor"/><circle cx="16" cy="15" r="1" fill="currentColor"/></svg>;
}
function IconSatellite() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16.326A7 7 0 1 1 15.71 12h1.79a4.5 4.5 0 0 1 .5 8.973"/><path d="m13 12-3 5h4l-3 5"/></svg>;
}
function IconLogout() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
}
function IconMenu() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
}
function IconX() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}

// ── Badge ──────────────────────────────────────────────────
function Badge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-700 text-gray-300 group-hover:bg-gray-600 transition-colors">
      {n > 999 ? '999+' : n}
    </span>
  );
}

// ── Main layout ────────────────────────────────────────────
export default function HRLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [counts, setCounts] = useState<Counts>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const NAV_GROUPS = [
    {
      label: t('pilotage'),
      items: [
        { href: `/${locale}/hr/dashboard`,    label: t('dashboard'),  Icon: IconGrid,      countKey: '', soon: false },
        { href: `/${locale}/hr/jobs`,         label: t('jobs'), Icon: IconBriefcase, countKey: 'jobs' },
        { href: `/${locale}/hr/candidates`,   label: t('candidates'),        Icon: IconUsers,     countKey: 'candidates' },
        { href: `/${locale}/hr/pipeline`,     label: t('pipeline'),         Icon: IconKanban,    countKey: '' },
        { href: `/${locale}/hr/projects`,     label: t('campaigns'),        Icon: IconCalendar,  countKey: '' },
      ],
    },
    {
      label: t('analyseOutils'),
      items: [
        { href: `/${locale}/hr/ai-agent`,    label: t('aiAgent'),          Icon: IconRobot,     countKey: '' },
        { href: '',                           label: t('talentPool'),        Icon: IconStar,      countKey: '', soon: true },
        { href: `/${locale}/hr/job-boards`,  label: t('jobBoards'),         Icon: IconSatellite, countKey: '' },
        { href: `/${locale}/hr/prospecting`, label: t('prospecting'), Icon: IconMail,      countKey: '' },
      ],
    },
    {
      label: t('administration'),
      items: [
        { href: `/${locale}/hr/settings`,       label: t('settings'), Icon: IconPalette,  countKey: '' },
        { href: `/${locale}/hr/team`,           label: t('team'),           Icon: IconTeam,     countKey: '' },
        { href: `/${locale}/hr/cv-templates`,   label: t('cvTemplates'),     Icon: IconGlobe,    countKey: '' },
        { href: `/${locale}/hr/email-settings`, label: t('emailSettings'),   Icon: IconSettings, countKey: '' },
      ],
    },
  ];

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => setUser(d));
    // Fetch counts in parallel
    Promise.all([
      fetch('/api/jobs').then(r => r.ok ? r.json() : []),
      fetch('/api/candidates').then(r => r.ok ? r.json() : []),
    ]).then(([jobs, candidates]) => {
      setCounts({
        jobs: Array.isArray(jobs) ? jobs.length : (jobs?.total ?? 0),
        candidates: Array.isArray(candidates) ? candidates.length : (candidates?.total ?? 0),
      });
    }).catch(() => {});
  }, []);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push(`/${locale}/login`);
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-700 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-xs">GF</span>
          </div>
          <div>
            <div className="font-bold text-sm text-white">GEEKFACT</div>
            <div className="text-gray-400 text-xs">CRM Recrutement</div>
          </div>
          <div className="ml-auto">
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const active = !item.soon && isActive(item.href);
                const count = item.countKey ? (counts[item.countKey as keyof Counts] ?? 0) : 0;
                if (item.soon) {
                  return (
                    <div
                      key={item.href + item.label}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium opacity-40 cursor-not-allowed select-none"
                    >
                      <span className="flex-shrink-0 text-gray-500"><item.Icon /></span>
                      <span className="flex-1 truncate text-gray-400">{item.label}</span>
                      <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-700 text-gray-400 uppercase tracking-wide">{tCommon('soon')}</span>
                    </div>
                  );
                }
                return (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      active
                        ? 'bg-emerald-700 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    <span className={`flex-shrink-0 transition-colors ${active ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>
                      <item.Icon />
                    </span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {count > 0 && <Badge n={count} />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-gray-800 space-y-0.5">
        <Link href={`/${locale}`} className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
          <span className="text-gray-500 group-hover:text-gray-300"><IconGlobe /></span>
          <span>{t('publicSite')}</span>
        </Link>
        {user && (
          <div className="mt-2 pt-2 border-t border-gray-800">
            <div className="flex items-center gap-3 px-3 py-2 mb-1">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: user.avatar_color || '#6366f1' }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-xs font-semibold truncate">{user.name}</p>
                <p className="text-gray-400 text-xs truncate">{user.email}</p>
                <p className="text-gray-600 text-xs">{ROLE_LABELS[user.role] || user.role}</p>
              </div>
            </div>
            <button onClick={logout}
              className="w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-all">
              <span className="text-gray-500 group-hover:text-red-400"><IconLogout /></span>
              <span>{t('logout')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-gray-900 flex-col fixed inset-y-0 left-0 z-50">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Mobile drawer */}
      <aside className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-gray-900 flex flex-col transform transition-transform duration-300 ease-in-out shadow-xl ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <button onClick={() => setSidebarOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors z-10">
          <IconX />
        </button>
        <SidebarContent />
      </aside>

      {/* Content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">

        {/* Mobile topbar */}
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">
            <IconMenu />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">GF</span>
            </div>
            <span className="font-semibold text-gray-900 text-sm">GEEKFACT</span>
          </div>
        </header>

        <main className="flex-1">
          <PermissionsProvider>
            {children}
          </PermissionsProvider>
        </main>
      </div>
    </div>
  );
}
