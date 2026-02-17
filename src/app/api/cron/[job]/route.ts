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
 */
function verifyAuthorization(request: NextRequest): boolean {
  // Check for Vercel Cron authorization header
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // If CRON_SECRET is set, require it
  if (cronSecret) {
    return authHeader === `Bearer ${cronSecret}`;
  }

  // Also accept Vercel's internal cron header
  const vercelCron = request.headers.get('x-vercel-cron');
  if (vercelCron) {
    return true;
  }

  // In development, allow unauthenticated access
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

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
