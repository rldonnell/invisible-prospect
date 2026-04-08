import { NextResponse } from 'next/server';

/**
 * Subdomain routing middleware.
 *
 * Maps *.visitorid.p5marketing.com subdomains to /dashboard/[client].
 * e.g. tbr.visitorid.p5marketing.com → internally rewrites to /dashboard/tbr
 *
 * Also works with:
 *   - *.visitorid.localhost:3000  (local dev)
 *   - *.invisible-prospect.vercel.app (preview deploys)
 *
 * Direct /dashboard/[client] paths still work (backward compatible).
 * API routes, static files, and _next assets are never rewritten.
 */
export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Skip API routes, static files, Next.js internals
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const hostname = request.headers.get('host') || '';

  // Extract subdomain from known base domains
  let subdomain = null;

  const baseDomains = [
    'visitorid.p5marketing.com',
    'invisible-prospect.vercel.app',
    'visitorid.localhost:3000',
  ];

  for (const base of baseDomains) {
    if (hostname.endsWith(base) && hostname !== base) {
      subdomain = hostname.replace(`.${base}`, '').toLowerCase();
      break;
    }
  }

  // No subdomain detected — pass through normally
  if (!subdomain) {
    return NextResponse.next();
  }

  // Root of subdomain → rewrite to /dashboard/[client]
  if (pathname === '/' || pathname === '') {
    const url = request.nextUrl.clone();
    url.pathname = `/dashboard/${subdomain}`;
    return NextResponse.rewrite(url);
  }

  // Sub-pages like /reset?token=xxx → rewrite to /dashboard/[client]/reset
  if (pathname.startsWith('/reset')) {
    const url = request.nextUrl.clone();
    url.pathname = `/dashboard/${subdomain}${pathname}`;
    return NextResponse.rewrite(url);
  }

  // Visitor profile pages: /visitor/123 → /dashboard/[client]/visitor/123
  if (pathname.startsWith('/visitor')) {
    const url = request.nextUrl.clone();
    url.pathname = `/dashboard/${subdomain}${pathname}`;
    return NextResponse.rewrite(url);
  }

  // Anything else under the subdomain → pass through
  return NextResponse.next();
}

export const config = {
  // Run on all paths except static assets and API routes
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
