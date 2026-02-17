import { NextResponse } from 'next/server';
import { openApiSpec } from '@/lib/openapi';
import { getCorsHeaders } from '@/lib/api/utils';

export const runtime = 'edge';

/**
 * GET /api/openapi - Returns OpenAPI specification
 */
export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      ...getCorsHeaders(),
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

/**
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}
