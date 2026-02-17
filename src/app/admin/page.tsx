'use client';

import { useState, useEffect, useCallback } from 'react';

interface Metrics {
  timestamp: string;
  apiKeys: {
    total: number;
    byTier: Record<string, number>;
  };
  usage: {
    today: number;
    yesterday: number;
    last7Days: number;
    changeFromYesterday: number;
  };
  webhooks: {
    activeSubscriptions: number;
    deliveriesLast24h: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    successRate: number;
  };
  database: {
    tokensIndexed: number;
    riskScoresToday: number;
  };
}

interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs?: number;
  message?: string;
}

interface HealthData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: HealthCheck[];
}

interface Job {
  name: string;
  description: string;
  schedule: string;
  nextRun: string | null;
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [metricsRes, healthRes, jobsRes] = await Promise.all([
        fetch('/api/admin/metrics'),
        fetch('/api/admin/health'),
        fetch('/api/admin/jobs'),
      ]);

      if (!metricsRes.ok || !healthRes.ok || !jobsRes.ok) {
        throw new Error('Failed to fetch admin data');
      }

      const [metricsData, healthData, jobsData] = await Promise.all([
        metricsRes.json(),
        healthRes.json(),
        jobsRes.json(),
      ]);

      setMetrics(metricsData.data);
      setHealth(healthData.data);
      setJobs(jobsData.data?.jobs || []);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-gray-800 rounded-lg" />
            <div className="h-32 bg-gray-800 rounded-lg" />
            <div className="h-32 bg-gray-800 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
            <p className="text-red-200">Error: {error}</p>
            <button
              onClick={fetchData}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <div className="text-sm text-gray-400">
            Last updated: {lastUpdated?.toLocaleTimeString()}
            <button
              onClick={fetchData}
              className="ml-4 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* System Health */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">System Health</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {health?.checks.map((check) => (
              <div
                key={check.name}
                className={`p-4 rounded-lg border ${
                  check.status === 'healthy'
                    ? 'bg-green-900/20 border-green-500/50'
                    : check.status === 'degraded'
                    ? 'bg-yellow-900/20 border-yellow-500/50'
                    : 'bg-red-900/20 border-red-500/50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="font-medium capitalize">{check.name}</span>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      check.status === 'healthy'
                        ? 'bg-green-500/20 text-green-300'
                        : check.status === 'degraded'
                        ? 'bg-yellow-500/20 text-yellow-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}
                  >
                    {check.status}
                  </span>
                </div>
                {check.latencyMs !== undefined && (
                  <p className="text-sm text-gray-400 mt-1">{check.latencyMs}ms</p>
                )}
                {check.message && (
                  <p className="text-xs text-gray-500 mt-1">{check.message}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Usage Metrics */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">API Usage</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Today"
              value={metrics?.usage.today.toLocaleString() || '0'}
              subtitle="requests"
              change={metrics?.usage.changeFromYesterday}
            />
            <MetricCard
              title="Yesterday"
              value={metrics?.usage.yesterday.toLocaleString() || '0'}
              subtitle="requests"
            />
            <MetricCard
              title="Last 7 Days"
              value={metrics?.usage.last7Days.toLocaleString() || '0'}
              subtitle="requests"
            />
            <MetricCard
              title="Risk Scores Today"
              value={metrics?.database.riskScoresToday.toLocaleString() || '0'}
              subtitle="analyzed"
            />
          </div>
        </section>

        {/* API Keys */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">API Keys</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Keys"
              value={metrics?.apiKeys.total.toString() || '0'}
              subtitle="registered"
            />
            {metrics?.apiKeys.byTier &&
              Object.entries(metrics.apiKeys.byTier).map(([tier, count]) => (
                <MetricCard
                  key={tier}
                  title={tier.charAt(0).toUpperCase() + tier.slice(1)}
                  value={count.toString()}
                  subtitle="keys"
                />
              ))}
          </div>
        </section>

        {/* Webhooks */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Webhooks</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Active Subscriptions"
              value={metrics?.webhooks.activeSubscriptions.toString() || '0'}
              subtitle="enabled"
            />
            <MetricCard
              title="Deliveries (24h)"
              value={metrics?.webhooks.deliveriesLast24h.toString() || '0'}
              subtitle="sent"
            />
            <MetricCard
              title="Success Rate"
              value={`${metrics?.webhooks.successRate || 100}%`}
              subtitle="delivered"
              highlight={metrics?.webhooks.successRate !== undefined && metrics.webhooks.successRate < 95}
            />
            <MetricCard
              title="Failed"
              value={metrics?.webhooks.failedDeliveries.toString() || '0'}
              subtitle="last 24h"
              highlight={metrics?.webhooks.failedDeliveries !== undefined && metrics.webhooks.failedDeliveries > 0}
            />
          </div>
        </section>

        {/* Background Jobs */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Background Jobs</h2>
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="text-left p-4">Job</th>
                  <th className="text-left p-4">Description</th>
                  <th className="text-left p-4">Schedule</th>
                  <th className="text-left p-4">Next Run</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.name} className="border-t border-gray-700">
                    <td className="p-4 font-mono text-sm">{job.name}</td>
                    <td className="p-4 text-gray-300">{job.description}</td>
                    <td className="p-4 font-mono text-xs text-gray-400">{job.schedule}</td>
                    <td className="p-4 text-sm text-gray-400">
                      {job.nextRun
                        ? new Date(job.nextRun).toLocaleString()
                        : 'Manual'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Database */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Database</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Tokens Indexed"
              value={metrics?.database.tokensIndexed.toLocaleString() || '0'}
              subtitle="in database"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  change,
  highlight,
}: {
  title: string;
  value: string;
  subtitle: string;
  change?: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-lg ${
        highlight ? 'bg-red-900/20 border border-red-500/50' : 'bg-gray-800'
      }`}
    >
      <p className="text-sm text-gray-400">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <div className="flex items-center gap-2 mt-1">
        <p className="text-xs text-gray-500">{subtitle}</p>
        {change !== undefined && (
          <span
            className={`text-xs ${
              change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-gray-400'
            }`}
          >
            {change > 0 ? '+' : ''}
            {change}%
          </span>
        )}
      </div>
    </div>
  );
}
