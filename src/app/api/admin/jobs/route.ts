import { NextRequest } from 'next/server';
import { listJobs, JOBS } from '@/lib/jobs';
import {
  generateRequestId,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api/utils';

export const runtime = 'nodejs';

/**
 * Verify admin access via ADMIN_SECRET
 * SECURITY: Always require ADMIN_SECRET, even in development
 */
function verifyAdminAccess(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    console.error('ADMIN_SECRET not configured - admin access denied');
    return false;
  }

  if (authHeader === `Bearer ${adminSecret}`) {
    return true;
  }

  return false;
}

/**
 * GET /api/admin/jobs - List all jobs with their status
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId();

  if (!verifyAdminAccess(request)) {
    return createErrorResponse('UNAUTHORIZED', 'Admin access required', 401, requestId);
  }

  try {
    const jobs = listJobs();

    // Add next run time based on cron schedule
    const jobsWithSchedule = jobs.map(job => {
      const jobDef = JOBS[job.name];
      return {
        ...job,
        schedule: jobDef?.schedule || 'manual',
        nextRun: getNextRunTime(jobDef?.schedule),
      };
    });

    return createSuccessResponse({
      jobs: jobsWithSchedule,
      count: jobsWithSchedule.length,
    }, requestId);
  } catch (error) {
    console.error('Admin jobs error:', error);
    return createErrorResponse(
      'INTERNAL_ERROR',
      'Failed to fetch jobs',
      500,
      requestId
    );
  }
}

/**
 * Parse cron schedule and estimate next run time
 */
function getNextRunTime(schedule?: string): string | null {
  if (!schedule) return null;

  const now = new Date();
  const parts = schedule.split(' ');

  // Simple parsing for common patterns
  if (parts.length !== 5) return null;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Every X minutes pattern: */X * * * *
  if (minute.startsWith('*/')) {
    const interval = parseInt(minute.slice(2), 10);
    const currentMinute = now.getMinutes();
    const nextMinute = Math.ceil((currentMinute + 1) / interval) * interval;
    const next = new Date(now);
    next.setMinutes(nextMinute % 60);
    next.setSeconds(0);
    if (nextMinute >= 60) {
      next.setHours(next.getHours() + 1);
    }
    return next.toISOString();
  }

  // Daily at specific time: X Y * * *
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    const targetHour = parseInt(hour, 10);
    const targetMinute = parseInt(minute, 10);
    const next = new Date(now);
    next.setHours(targetHour, targetMinute, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    return next.toISOString();
  }

  return null;
}
