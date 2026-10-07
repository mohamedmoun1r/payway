import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { DEFAULT_LOCALE, isValidLocale, type Locale } from './lib/i18n/config';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip public assets, APIs, and next internal assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // file extension like favicon.ico, fonts, images
  ) {
    return NextResponse.next();
  }

  // 2. Validate locale prefix in pathname
  const pathnameLocale = pathname.split('/')[1];

  if (!isValidLocale(pathnameLocale)) {
    // Redirect to default locale 'ar'
    const targetUrl = new URL(`/${DEFAULT_LOCALE}${pathname === '/' ? '' : pathname}`, request.url);
    targetUrl.search = request.nextUrl.search;
    return NextResponse.redirect(targetUrl);
  }

  const locale = pathnameLocale as Locale;

  // 3. Supabase SSR Session Refresh & Cookie Propagation
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // 4. Enforce basic route protection for authenticated paths
  const isStudentRoute = pathname.startsWith(`/${locale}/student`);
  const isAdminRoute = pathname.startsWith(`/${locale}/admin`);

  if (isStudentRoute || isAdminRoute) {
    // Safe server-side check with getUser() (does not trust client session unverified)
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      // Unauthenticated: Redirect to login and preserve intended destination
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set('redirectTo', pathname);

      const redirectResponse = NextResponse.redirect(loginUrl);

      // Copy session cookies to redirect response (e.g., cleared expired tokens)
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value);
      });

      return redirectResponse;
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
