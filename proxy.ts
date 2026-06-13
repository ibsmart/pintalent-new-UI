import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, SESSION_COOKIE } from '@/lib/auth';

const LOCALES = ['fr', 'en'] as const;
const DEFAULT_LOCALE = 'fr';

function detectLocale(req: NextRequest): string {
  const acceptLang = req.headers.get('accept-language') || '';
  if (acceptLang.toLowerCase().startsWith('en')) return 'en';
  return DEFAULT_LOCALE;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Skip static assets and API routes ──────────────────────
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/uploads') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // ── Locale redirect: add prefix if missing ──────────────────
  const hasLocale = LOCALES.some(l => pathname === `/${l}` || pathname.startsWith(`/${l}/`));

  if (!hasLocale) {
    const locale = detectLocale(req);
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(url);
  }

  // ── Extract locale from path ────────────────────────────────
  const locale = LOCALES.find(l => pathname === `/${l}` || pathname.startsWith(`/${l}/`)) || DEFAULT_LOCALE;

  // ── Auth protection for /{locale}/hr/* ─────────────────────
  const hrPrefix = `/${locale}/hr`;
  if (pathname.startsWith(hrPrefix) && !pathname.startsWith(`/${locale}/hr/login`)) {
    const token = req.cookies.get(SESSION_COOKIE)?.value;

    if (!token) {
      const loginUrl = new URL(`/${locale}/hr/login`, req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const session = await verifyToken(token);
    if (!session) {
      const loginUrl = new URL(`/${locale}/hr/login`, req.url);
      loginUrl.searchParams.set('redirect', pathname);
      const res = NextResponse.redirect(loginUrl);
      res.cookies.set(SESSION_COOKIE, '', { maxAge: 0, path: '/' });
      return res;
    }

    // Inject user info as headers for server components
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-user-id', session.id);
    requestHeaders.set('x-user-role', session.role);
    requestHeaders.set('x-user-name', session.name);
    requestHeaders.set('x-locale', locale);

    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads).*)'],
};
