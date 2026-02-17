import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  generateRequestId,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api/utils';

export const runtime = 'nodejs';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs?: number;
  message?: string;
}

/**
 * Verify admin access
 */
function verifyAdminAccess(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const adminSecret = process.env.ADMIN_SECRET;

  if (adminSecret && authHeader === `Bearer ${adminSecret}`) {
    return true;
  }

  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  return false;
}

/**
 * GET /api/admin/health - Detailed health check for all services
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId();

  if (!verifyAdminAccess(request)) {
    return createErrorResponse('UNAUTHORIZED', 'Admin access required', 401, requestId);
  }

  const checks: HealthCheck[] = [];

  // Check Supabase connection
  checks.push(await checkSupabase());

  // Check external APIs
  checks.push(await checkGeckoTerminal());
  checks.push(await checkGoPlus());

  // Check environment configuration
  checks.push(checkEnvironment());

  // Calculate overall status
  const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;
  const degradedCount = checks.filter(c => c.status === 'degraded').length;

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (unhealthyCount > 0) {
    overallStatus = 'unhealthy';
  } else if (degradedCount > 0) {
    overallStatus = 'degraded';
  }

  return createSuccessResponse({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  }, requestId);
}

async function checkSupabase(): Promise<HealthCheck> {
  const start = Date.now();

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return {
        name: 'supabase',
        status: 'unhealthy',
        message: 'Missing Supabase credentials',
      };
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Simple query to check connectivity
    const { error } = await supabase
      .from('tokens')
      .select('id', { count: 'exact', head: true });

    const latencyMs = Date.now() - start;

    if (error) {
      return {
        name: 'supabase',
        status: 'unhealthy',
        latencyMs,
        message: error.message,
      };
    }

    return {
      name: 'supabase',
      status: latencyMs > 1000 ? 'degraded' : 'healthy',
      latencyMs,
      message: latencyMs > 1000 ? 'High latency' : undefined,
    };
  } catch (error) {
    return {
      name: 'supabase',
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

async function checkGeckoTerminal(): Promise<HealthCheck> {
  const start = Date.now();

  try {
    const response = await fetch('https://api.geckoterminal.com/api/v2/networks', {
      signal: AbortSignal.timeout(5000),
    });

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      return {
        name: 'geckoterminal',
        status: 'unhealthy',
        latencyMs,
        message: `HTTP ${response.status}`,
      };
    }

    return {
      name: 'geckoterminal',
      status: latencyMs > 2000 ? 'degraded' : 'healthy',
      latencyMs,
      message: latencyMs > 2000 ? 'High latency' : undefined,
    };
  } catch (error) {
    return {
      name: 'geckoterminal',
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Request failed',
    };
  }
}

async function checkGoPlus(): Promise<HealthCheck> {
  const start = Date.now();

  try {
    const response = await fetch('https://api.gopluslabs.io/api/v1/supported_chains', {
      signal: AbortSignal.timeout(5000),
    });

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      return {
        name: 'goplus',
        status: 'unhealthy',
        latencyMs,
        message: `HTTP ${response.status}`,
      };
    }

    return {
      name: 'goplus',
      status: latencyMs > 2000 ? 'degraded' : 'healthy',
      latencyMs,
      message: latencyMs > 2000 ? 'High latency' : undefined,
    };
  } catch (error) {
    return {
      name: 'goplus',
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Request failed',
    };
  }
}

function checkEnvironment(): HealthCheck {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const optionalVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'HELIUS_API_KEY',
    'CRON_SECRET',
  ];

  const missingRequired = requiredVars.filter(v => !process.env[v]);
  const missingOptional = optionalVars.filter(v => !process.env[v]);

  if (missingRequired.length > 0) {
    return {
      name: 'environment',
      status: 'unhealthy',
      message: `Missing required: ${missingRequired.join(', ')}`,
    };
  }

  if (missingOptional.length > 0) {
    return {
      name: 'environment',
      status: 'degraded',
      message: `Missing optional: ${missingOptional.join(', ')}`,
    };
  }

  return {
    name: 'environment',
    status: 'healthy',
  };
}
