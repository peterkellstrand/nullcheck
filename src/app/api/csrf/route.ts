import { NextResponse } from 'next/server';
import { getCsrfToken } from '@/lib/auth/csrf';

/**
 * GET /api/csrf - Get CSRF token for forms
 * The token is also set as an httpOnly cookie
 */
export async function GET() {
  const token = await getCsrfToken();

  return NextResponse.json(
    { csrfToken: token },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
