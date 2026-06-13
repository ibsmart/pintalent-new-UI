'use client';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function switchLocale(newLocale: string) {
    // Replace current locale prefix with new one
    const segments = pathname.split('/');
    segments[1] = newLocale;
    router.push(segments.join('/'));
  }

  return (
    <div className="flex items-center gap-1">
      {(['fr', 'en'] as const).map(l => (
        <button key={l} onClick={() => switchLocale(l)}
          className={`px-2 py-1 text-xs font-bold rounded-lg transition-colors uppercase ${
            locale === l ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white hover:bg-gray-800'
          }`}>
          {l}
        </button>
      ))}
    </div>
  );
}
