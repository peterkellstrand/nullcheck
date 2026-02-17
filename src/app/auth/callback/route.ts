import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Allowed redirect paths to prevent open redirect attacks
const ALLOWED_REDIRECTS = new Set([
  '/',
  '/charts',
  '/keys',
  '/pricing',
  '/watchlist',
  '/admin',
  '/docs',
]);

function getSafeRedirect(next: string | null): string {
  if (!next) return '/';

  // Must start with / and not contain protocol or double slashes
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('://')) {
    return '/';
  }

  // Check against whitelist (exact match or starts with allowed path)
  const basePath = next.split('?')[0]; // Remove query params
  if (ALLOWED_REDIRECTS.has(basePath)) {
    return next;
  }

  // Allow token detail pages: /token/[chain]/[address]
  if (basePath.startsWith('/token/')) {
    return next;
  }

  return '/';
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = getSafeRedirect(searchParams.get('next'));

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return to home on error
  return NextResponse.redirect(`${origin}/?auth_error=true`);
}
