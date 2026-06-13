'use client';
import { usePathname } from 'next/navigation';

export default function LanguageSwitcher() {
  const pathname = usePathname();

  // Derive current locale from URL
  const currentLocale = pathname.startsWith('/en') ? 'en' : 'fr';

  function switchLocale(newLocale: string) {
    if (newLocale === currentLocale) return;
    // Replace locale prefix in URL and do a hard redirect
    const segments = pathname.split('/');
    segments[1] = newLocale;
    window.location.href = segments.join('/');
  }

  return (
    <div className="flex items-center gap-1">
      {(['fr', 'en'] as const).map(l => (
        <button
          key={l}
          onClick={() => switchLocale(l)}
          className={`px-2 py-1 text-xs font-bold rounded-lg transition-colors uppercase ${
            currentLocale === l
              ? 'bg-emerald-700 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
