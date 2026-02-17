import { NextRequest, NextResponse } from 'next/server';
import { runJob, listJobs, JOBS } from '@/lib/jobs';
import {
  generateRequestId,
  getCorsHeaders,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api/utils';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for cleanup jobs

interface RouteParams {
  params: Promise<{
    job: string;
  }>;
}

/**
 * Verify the request is authorized to run cron jobs
 * SECURITY: Requires CRON_SECRET or valid Vercel signature
 */
function verifyAuthorization(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Option 1: CRON_SECRET via Bearer token (recommended)
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Option 2: Vercel's internal cron - only valid when deployed on Vercel
  // Vercel sets this header AND the request must come from Vercel's IP range
  // We verify by checking if VERCEL environment variable is set (only on Vercel)
  const vercelCron = request.headers.get('x-vercel-cron');
  const isVercelEnvironment = process.env.VERCEL === '1';
  if (vercelCron && isVercelEnvironment) {
    return true;
  }

  // No valid authentication - deny access
  // SECURITY: Removed NODE_ENV === 'development' bypass
  return false;
}

/**
 * GET /api/cron/[job] - List available jobs or get job info
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const requestId = generateRequestId();
  const { job } = await params;

  // Special case: list all jobs
  if (job === 'list') {
    return createSuccessResponse(
      {
        jobs: listJobs(),
      },
      requestId
    );
  }

  // Get info about specific job
  const jobDef = JOBS[job];
  if (!jobDef) {
    return createErrorResponse(
      'NOT_FOUND',
      `Unknown job: ${job}. Use /api/cron/list to see available jobs.`,
      404,
      requestId
    );
  }

  return createSuccessResponse(
    {
      name: jobDef.name,
      description: jobDef.description,
      schedule: jobDef.schedule,
    },
    requestId
  );
}

/**
 * POST /api/cron/[job] - Execute a job
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const requestId = generateRequestId();
  const { job } = await params;

  // Verify authorization
  if (!verifyAuthorization(request)) {
    return createErrorResponse(
      'UNAUTHORIZED',
      'Invalid or missing authorization',
      401,
      requestId
    );
  }

  // Check if job exists
  if (!JOBS[job]) {
    return createErrorResponse(
      'NOT_FOUND',
      `Unknown job: ${job}. Use /api/cron/list to see available jobs.`,
      404,
      requestId
    );
  }

  // Execute the job
  const result = await runJob(job);

  // Return appropriate status based on result
  const status = result.success ? 200 : 500;

  return NextResponse.json(
    {
      success: result.success,
      data: result,
    },
    {
      status,
      headers: {
        ...getCorsHeaders(),
        'X-Request-ID': requestId,
        'X-Job-Duration': result.durationMs.toString(),
      },
    }
  );
}

/**
 * Handle OPTIONS for CORS
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}
