/**
 * k6 Load Test Script for nullcheck API
 *
 * Install k6: https://k6.io/docs/getting-started/installation/
 *
 * Usage:
 *   k6 run scripts/k6-load-test.js
 *   k6 run --vus 50 --duration 60s scripts/k6-load-test.js
 *   k6 run -e API_KEY=your_key -e BASE_URL=https://api.nullcheck.io scripts/k6-load-test.js
 *
 * Environment Variables:
 *   BASE_URL  - API base URL (default: http://localhost:3000)
 *   API_KEY   - API key for authenticated requests
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('error_rate');
const tokensFetchTime = new Trend('tokens_fetch_time');
const riskAnalysisTime = new Trend('risk_analysis_time');
const searchTime = new Trend('search_time');

// Test configuration
export const options = {
  // Ramp-up pattern
  stages: [
    { duration: '10s', target: 10 },   // Warm up
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 50 },    // Stay at 50 users
    { duration: '30s', target: 100 },  // Spike to 100 users
    { duration: '30s', target: 100 },  // Stay at 100 users
    { duration: '20s', target: 0 },    // Ramp down
  ],

  // Thresholds for pass/fail
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% of requests under 2s
    http_req_failed: ['rate<0.05'],     // Less than 5% failures
    error_rate: ['rate<0.05'],          // Less than 5% errors
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || '';

// Common headers
function getHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }

  return headers;
}

// Test scenarios
const scenarios = {
  // GET /api/tokens - Trending tokens
  getTrendingTokens: () => {
    const res = http.get(`${BASE_URL}/api/tokens?limit=50`, {
      headers: getHeaders(),
      tags: { name: 'GET /api/tokens' },
    });

    tokensFetchTime.add(res.timings.duration);

    const success = check(res, {
      'tokens: status is 200': (r) => r.status === 200,
      'tokens: has data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success && body.data && body.data.tokens;
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!success);
    return res;
  },

  // GET /api/tokens with chain filter
  getTokensByChain: () => {
    const chains = ['ethereum', 'base', 'solana', 'arbitrum'];
    const chain = chains[Math.floor(Math.random() * chains.length)];

    const res = http.get(`${BASE_URL}/api/tokens?chain=${chain}&limit=20`, {
      headers: getHeaders(),
      tags: { name: 'GET /api/tokens (filtered)' },
    });

    const success = check(res, {
      'tokens by chain: status is 200': (r) => r.status === 200,
    });

    errorRate.add(!success);
    return res;
  },

  // POST /api/risk/:chain/:address - Risk analysis
  analyzeRisk: () => {
    // Sample token addresses for testing
    const tokens = [
      { chain: 'ethereum', address: '0xdac17f958d2ee523a2206206994597c13d831ec7' }, // USDT
      { chain: 'ethereum', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' }, // USDC
      { chain: 'base', address: '0x4200000000000000000000000000000000000006' },     // WETH on Base
    ];

    const token = tokens[Math.floor(Math.random() * tokens.length)];

    const res = http.post(
      `${BASE_URL}/api/risk/${token.chain}/${token.address}`,
      JSON.stringify({ symbol: 'TEST', name: 'Test Token' }),
      {
        headers: getHeaders(),
        tags: { name: 'POST /api/risk' },
      }
    );

    riskAnalysisTime.add(res.timings.duration);

    const success = check(res, {
      'risk: status is 200': (r) => r.status === 200,
      'risk: has score': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success && body.data && typeof body.data.totalScore === 'number';
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!success);
    return res;
  },

  // GET /api/search - Token search
  searchTokens: () => {
    const queries = ['ETH', 'USDC', 'PEPE', 'DOGE', 'BTC'];
    const query = queries[Math.floor(Math.random() * queries.length)];

    const res = http.get(`${BASE_URL}/api/search?q=${query}&limit=10`, {
      headers: getHeaders(),
      tags: { name: 'GET /api/search' },
    });

    searchTime.add(res.timings.duration);

    const success = check(res, {
      'search: status is 200': (r) => r.status === 200,
    });

    errorRate.add(!success);
    return res;
  },

  // GET /api/health - Health check
  healthCheck: () => {
    const res = http.get(`${BASE_URL}/api/health`, {
      tags: { name: 'GET /api/health' },
    });

    check(res, {
      'health: status is 200': (r) => r.status === 200,
    });

    return res;
  },
};

// Main test function
export default function () {
  // Weighted distribution of requests
  const rand = Math.random();

  if (rand < 0.4) {
    // 40% - Trending tokens (most common)
    scenarios.getTrendingTokens();
  } else if (rand < 0.6) {
    // 20% - Filtered tokens
    scenarios.getTokensByChain();
  } else if (rand < 0.8) {
    // 20% - Risk analysis
    scenarios.analyzeRisk();
  } else if (rand < 0.95) {
    // 15% - Search
    scenarios.searchTokens();
  } else {
    // 5% - Health check
    scenarios.healthCheck();
  }

  // Random sleep between 100ms and 1s to simulate real user behavior
  sleep(0.1 + Math.random() * 0.9);
}

// Setup function (runs once before test)
export function setup() {
  console.log(`Testing API at: ${BASE_URL}`);
  console.log(`Authentication: ${API_KEY ? 'API Key' : 'None'}`);

  // Verify API is reachable
  const res = http.get(`${BASE_URL}/api/health`);
  if (res.status !== 200) {
    throw new Error(`API health check failed: ${res.status}`);
  }

  return { startTime: new Date().toISOString() };
}

// Teardown function (runs once after test)
export function teardown(data) {
  console.log(`Test started at: ${data.startTime}`);
  console.log(`Test completed at: ${new Date().toISOString()}`);
}

// Handle test summary
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-test-results.json': JSON.stringify(data, null, 2),
  };
}

// Simple text summary formatter
function textSummary(data, options) {
  const lines = [];
  lines.push('\n' + '='.repeat(60));
  lines.push('Load Test Summary');
  lines.push('='.repeat(60));

  if (data.metrics.http_reqs) {
    lines.push(`Total Requests:     ${data.metrics.http_reqs.values.count}`);
    lines.push(`Requests/sec:       ${data.metrics.http_reqs.values.rate.toFixed(2)}`);
  }

  if (data.metrics.http_req_duration) {
    lines.push(`Avg Duration:       ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms`);
    lines.push(`P95 Duration:       ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
  }

  if (data.metrics.http_req_failed) {
    lines.push(`Failed Requests:    ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%`);
  }

  lines.push('='.repeat(60) + '\n');

  return lines.join('\n');
}
