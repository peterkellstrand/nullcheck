#!/usr/bin/env node
/**
 * Load testing script for nullcheck API
 *
 * Usage:
 *   node scripts/load-test.js [options]
 *
 * Options:
 *   --url         Base URL (default: http://localhost:3000)
 *   --api-key     API key for authenticated requests
 *   --concurrent  Number of concurrent requests (default: 10)
 *   --duration    Test duration in seconds (default: 30)
 *   --endpoint    Endpoint to test (default: /api/tokens)
 *
 * Examples:
 *   node scripts/load-test.js --concurrent 50 --duration 60
 *   node scripts/load-test.js --api-key your_key --endpoint /api/risk/ethereum/0x...
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// Parse command line arguments
function parseArgs() {
  const args = {
    url: 'http://localhost:3000',
    apiKey: null,
    concurrent: 10,
    duration: 30,
    endpoint: '/api/tokens',
  };

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    const value = process.argv[i + 1];

    switch (arg) {
      case '--url':
        args.url = value;
        i++;
        break;
      case '--api-key':
        args.apiKey = value;
        i++;
        break;
      case '--concurrent':
        args.concurrent = parseInt(value, 10);
        i++;
        break;
      case '--duration':
        args.duration = parseInt(value, 10);
        i++;
        break;
      case '--endpoint':
        args.endpoint = value;
        i++;
        break;
      case '--help':
        console.log(`
Load Testing Script for nullcheck API

Usage:
  node scripts/load-test.js [options]

Options:
  --url         Base URL (default: http://localhost:3000)
  --api-key     API key for authenticated requests
  --concurrent  Number of concurrent requests (default: 10)
  --duration    Test duration in seconds (default: 30)
  --endpoint    Endpoint to test (default: /api/tokens)
`);
        process.exit(0);
    }
  }

  return args;
}

// Statistics collector
class Stats {
  constructor() {
    this.requests = 0;
    this.successes = 0;
    this.failures = 0;
    this.latencies = [];
    this.statusCodes = {};
    this.errors = [];
    this.startTime = null;
    this.endTime = null;
  }

  record(statusCode, latencyMs, error = null) {
    this.requests++;
    this.latencies.push(latencyMs);
    this.statusCodes[statusCode] = (this.statusCodes[statusCode] || 0) + 1;

    if (statusCode >= 200 && statusCode < 400) {
      this.successes++;
    } else {
      this.failures++;
      if (error) {
        this.errors.push(error);
      }
    }
  }

  recordError(error) {
    this.requests++;
    this.failures++;
    this.errors.push(error.message || error);
    this.statusCodes['error'] = (this.statusCodes['error'] || 0) + 1;
  }

  percentile(p) {
    if (this.latencies.length === 0) return 0;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  summary() {
    const duration = (this.endTime - this.startTime) / 1000;
    const rps = this.requests / duration;
    const avgLatency = this.latencies.length > 0
      ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
      : 0;

    return {
      totalRequests: this.requests,
      successfulRequests: this.successes,
      failedRequests: this.failures,
      requestsPerSecond: Math.round(rps * 100) / 100,
      avgLatencyMs: Math.round(avgLatency * 100) / 100,
      p50LatencyMs: this.percentile(50),
      p95LatencyMs: this.percentile(95),
      p99LatencyMs: this.percentile(99),
      minLatencyMs: this.latencies.length > 0 ? Math.min(...this.latencies) : 0,
      maxLatencyMs: this.latencies.length > 0 ? Math.max(...this.latencies) : 0,
      statusCodes: this.statusCodes,
      errorRate: this.requests > 0 ? (this.failures / this.requests * 100).toFixed(2) + '%' : '0%',
      durationSeconds: Math.round(duration * 100) / 100,
    };
  }
}

// Make a single HTTP request
function makeRequest(url, headers) {
  return new Promise((resolve) => {
    const start = Date.now();
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'nullcheck-load-test/1.0',
        ...headers,
      },
    };

    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          latencyMs: Date.now() - start,
          headers: res.headers,
        });
      });
    });

    req.on('error', (error) => {
      resolve({
        statusCode: 0,
        latencyMs: Date.now() - start,
        error: error.message,
      });
    });

    req.setTimeout(30000, () => {
      req.destroy();
      resolve({
        statusCode: 0,
        latencyMs: Date.now() - start,
        error: 'Request timeout',
      });
    });

    req.end();
  });
}

// Run concurrent requests
async function runWorker(args, stats, signal) {
  const url = args.url + args.endpoint;
  const headers = {};

  if (args.apiKey) {
    headers['X-API-Key'] = args.apiKey;
  }

  while (!signal.stopped) {
    const result = await makeRequest(url, headers);

    if (signal.stopped) break;

    if (result.error) {
      stats.recordError(result.error);
    } else {
      stats.record(result.statusCode, result.latencyMs);
    }

    // Rate limit tracking
    if (result.headers) {
      const remaining = result.headers['x-ratelimit-remaining'];
      if (remaining !== undefined && parseInt(remaining, 10) <= 0) {
        console.log('Warning: Rate limit reached');
      }
    }
  }
}

// Main function
async function main() {
  const args = parseArgs();
  const stats = new Stats();
  const signal = { stopped: false };

  console.log('\n' + '='.repeat(60));
  console.log('nullcheck API Load Test');
  console.log('='.repeat(60));
  console.log(`Target:      ${args.url}${args.endpoint}`);
  console.log(`Concurrent:  ${args.concurrent} workers`);
  console.log(`Duration:    ${args.duration} seconds`);
  console.log(`Auth:        ${args.apiKey ? 'API Key' : 'None'}`);
  console.log('='.repeat(60) + '\n');

  // Start workers
  stats.startTime = Date.now();
  const workers = [];

  for (let i = 0; i < args.concurrent; i++) {
    workers.push(runWorker(args, stats, signal));
  }

  // Progress reporting
  const progressInterval = setInterval(() => {
    const elapsed = (Date.now() - stats.startTime) / 1000;
    const rps = stats.requests / elapsed;
    process.stdout.write(
      `\rProgress: ${Math.round(elapsed)}s | Requests: ${stats.requests} | RPS: ${Math.round(rps)} | Errors: ${stats.failures}`
    );
  }, 1000);

  // Stop after duration
  setTimeout(() => {
    signal.stopped = true;
  }, args.duration * 1000);

  // Wait for all workers to finish
  await Promise.all(workers);
  stats.endTime = Date.now();
  clearInterval(progressInterval);

  // Print results
  const summary = stats.summary();
  console.log('\n\n' + '='.repeat(60));
  console.log('Results');
  console.log('='.repeat(60));
  console.log(`Total Requests:     ${summary.totalRequests}`);
  console.log(`Successful:         ${summary.successfulRequests}`);
  console.log(`Failed:             ${summary.failedRequests}`);
  console.log(`Error Rate:         ${summary.errorRate}`);
  console.log('');
  console.log(`Requests/sec:       ${summary.requestsPerSecond}`);
  console.log(`Avg Latency:        ${summary.avgLatencyMs}ms`);
  console.log(`P50 Latency:        ${summary.p50LatencyMs}ms`);
  console.log(`P95 Latency:        ${summary.p95LatencyMs}ms`);
  console.log(`P99 Latency:        ${summary.p99LatencyMs}ms`);
  console.log(`Min Latency:        ${summary.minLatencyMs}ms`);
  console.log(`Max Latency:        ${summary.maxLatencyMs}ms`);
  console.log('');
  console.log('Status Codes:');
  for (const [code, count] of Object.entries(summary.statusCodes)) {
    console.log(`  ${code}: ${count}`);
  }
  console.log('='.repeat(60) + '\n');

  // Print unique errors if any
  if (stats.errors.length > 0) {
    const uniqueErrors = [...new Set(stats.errors)];
    console.log('Errors encountered:');
    uniqueErrors.slice(0, 5).forEach((err) => console.log(`  - ${err}`));
    if (uniqueErrors.length > 5) {
      console.log(`  ... and ${uniqueErrors.length - 5} more unique errors`);
    }
    console.log('');
  }

  // Exit with error if too many failures
  if (summary.failedRequests / summary.totalRequests > 0.1) {
    console.log('WARNING: Error rate exceeded 10%');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Load test failed:', err);
  process.exit(1);
});
