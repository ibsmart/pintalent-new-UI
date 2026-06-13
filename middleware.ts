import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Skip API routes and Next.js internals
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.startsWith('/uploads') || pathname.includes('.')) {
    return NextResponse.next();
  }
  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|uploads|.*\\..*).*)'],
};
