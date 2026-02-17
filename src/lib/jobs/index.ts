/**
 * Background job definitions and runner
 *
 * Jobs are executed via Vercel Cron or external scheduler calling /api/cron/[job]
 */

export interface JobResult {
  success: boolean;
  job: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  result?: Record<string, unknown>;
  error?: string;
}

export interface JobDefinition {
  name: string;
  description: string;
  schedule: string; // Cron expression
  handler: () => Promise<Record<string, unknown>>;
}

// Import job handlers
import { cleanupWebhookDeliveries } from './cleanup';
import { cleanupIdempotentRequests } from './cleanup';
import { cleanupExpiredRiskScores } from './cleanup';
import { refreshTrendingTokens } from './refresh';
import { reportDailyUsageToStripe } from './billing';

/**
 * All registered background jobs
 */
export const JOBS: Record<string, JobDefinition> = {
  'cleanup-webhooks': {
    name: 'cleanup-webhooks',
    description: 'Delete webhook deliveries older than 7 days',
    schedule: '0 3 * * *', // Daily at 3 AM UTC
    handler: cleanupWebhookDeliveries,
  },
  'cleanup-idempotent': {
    name: 'cleanup-idempotent',
    description: 'Delete idempotent request records older than 24 hours',
    schedule: '0 4 * * *', // Daily at 4 AM UTC
    handler: cleanupIdempotentRequests,
  },
  'cleanup-risk-scores': {
    name: 'cleanup-risk-scores',
    description: 'Delete expired risk score cache entries',
    schedule: '0 5 * * *', // Daily at 5 AM UTC
    handler: cleanupExpiredRiskScores,
  },
  'refresh-trending': {
    name: 'refresh-trending',
    description: 'Refresh trending tokens materialized view',
    schedule: '*/5 * * * *', // Every 5 minutes
    handler: refreshTrendingTokens,
  },
  'report-usage': {
    name: 'report-usage',
    description: 'Report daily API usage to Stripe for metered billing',
    schedule: '0 0 * * *', // Daily at midnight UTC
    handler: reportDailyUsageToStripe,
  },
};

/**
 * Execute a job by name
 */
export async function runJob(jobName: string): Promise<JobResult> {
  const job = JOBS[jobName];
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  if (!job) {
    return {
      success: false,
      job: jobName,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: 0,
      error: `Unknown job: ${jobName}`,
    };
  }

  try {
    console.log(`[Job] Starting: ${job.name} - ${job.description}`);
    const result = await job.handler();
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;

    console.log(`[Job] Completed: ${job.name} in ${durationMs}ms`);

    return {
      success: true,
      job: jobName,
      startedAt,
      completedAt,
      durationMs,
      result,
    };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`[Job] Failed: ${job.name} - ${errorMessage}`);

    return {
      success: false,
      job: jobName,
      startedAt,
      completedAt,
      durationMs,
      error: errorMessage,
    };
  }
}

/**
 * List all available jobs
 */
export function listJobs(): { name: string; description: string; schedule: string }[] {
  return Object.values(JOBS).map((job) => ({
    name: job.name,
    description: job.description,
    schedule: job.schedule,
  }));
}
