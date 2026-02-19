/**
 * Browser/Client fingerprinting for abuse detection
 *
 * This module provides fingerprinting capabilities to identify clients
 * making requests, helping detect abuse patterns like:
 * - Multiple API keys from same client
 * - Rate limit circumvention attempts
 * - Bot/scraper detection
 *
 * Edge runtime compatible - uses Web Crypto API
 */

export interface ClientFingerprint {
  hash: string;
  components: FingerprintComponents;
  confidence: 'high' | 'medium' | 'low';
  isBot: boolean;
  botScore: number;
}

export interface FingerprintComponents {
  ip: string | null;
  userAgent: string | null;
  acceptLanguage: string | null;
  acceptEncoding: string | null;
  connection: string | null;
  dnt: string | null;
  secChUa: string | null;
  secChUaPlatform: string | null;
  secChUaMobile: string | null;
  secFetchDest: string | null;
  secFetchMode: string | null;
  secFetchSite: string | null;
}

/**
 * Known bot/crawler user agent patterns
 */
const BOT_PATTERNS = [
  /googlebot/i,
  /bingbot/i,
  /yandexbot/i,
  /duckduckbot/i,
  /slurp/i,
  /baiduspider/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /whatsapp/i,
  /telegrambot/i,
  /discordbot/i,
  /slackbot/i,
  /applebot/i,
  /crawler/i,
  /spider/i,
  /scraper/i,
  /bot\b/i,
  /headless/i,
  /phantom/i,
  /selenium/i,
  /puppeteer/i,
  /playwright/i,
  /wget/i,
  /curl/i,
  /httpie/i,
  /python-requests/i,
  /python-urllib/i,
  /go-http-client/i,
  /java\//i,
  /apache-httpclient/i,
  /okhttp/i,
  /axios/i,
  /node-fetch/i,
  /undici/i,
];

/**
 * Suspicious patterns that might indicate abuse
 */
const SUSPICIOUS_PATTERNS = [
  /^$/,  // Empty user agent
  /^-$/,
  /^Mozilla\/4\.0$/,  // Very old browser
  /^Mozilla\/5\.0$/,  // Generic without details
];

/**
 * Extract fingerprint components from request headers
 */
export function extractFingerprintComponents(headers: Headers): FingerprintComponents {
  return {
    ip: headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        headers.get('x-real-ip') ||
        headers.get('cf-connecting-ip') ||
        null,
    userAgent: headers.get('user-agent'),
    acceptLanguage: headers.get('accept-language'),
    acceptEncoding: headers.get('accept-encoding'),
    connection: headers.get('connection'),
    dnt: headers.get('dnt'),
    secChUa: headers.get('sec-ch-ua'),
    secChUaPlatform: headers.get('sec-ch-ua-platform'),
    secChUaMobile: headers.get('sec-ch-ua-mobile'),
    secFetchDest: headers.get('sec-fetch-dest'),
    secFetchMode: headers.get('sec-fetch-mode'),
    secFetchSite: headers.get('sec-fetch-site'),
  };
}

/**
 * Generate SHA-256 hash using Web Crypto API (edge compatible)
 */
async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a fingerprint hash from components
 */
export async function generateFingerprintHash(components: FingerprintComponents): Promise<string> {
  // Create a stable string representation
  const data = [
    components.userAgent || '',
    components.acceptLanguage || '',
    components.acceptEncoding || '',
    components.secChUa || '',
    components.secChUaPlatform || '',
    components.secChUaMobile || '',
  ].join('|');

  const hash = await sha256(data);
  return hash.slice(0, 32);
}

/**
 * Calculate bot score (0-100, higher = more likely a bot)
 */
export function calculateBotScore(components: FingerprintComponents): number {
  let score = 0;
  const ua = components.userAgent || '';

  // Check for known bot patterns
  for (const pattern of BOT_PATTERNS) {
    if (pattern.test(ua)) {
      score += 50;
      break;
    }
  }

  // Check for suspicious patterns
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(ua)) {
      score += 30;
      break;
    }
  }

  // Missing or minimal headers (bots often don't send all headers)
  if (!components.acceptLanguage) score += 10;
  if (!components.acceptEncoding) score += 5;

  // Modern browsers send client hints
  const hasClientHints = components.secChUa || components.secChUaPlatform;
  if (!hasClientHints && !isKnownHttpClient(ua)) {
    score += 10;
  }

  // Sec-Fetch headers are sent by real browsers
  const hasSecFetch = components.secFetchDest || components.secFetchMode;
  if (!hasSecFetch && !isKnownHttpClient(ua)) {
    score += 10;
  }

  // Known legitimate HTTP clients (curl, Postman, etc.) get a pass
  if (isKnownHttpClient(ua)) {
    score = Math.min(score, 30);  // Cap at 30 for known clients
  }

  return Math.min(score, 100);
}

/**
 * Check if user agent is a known HTTP client (not necessarily a bot)
 */
function isKnownHttpClient(userAgent: string): boolean {
  const clients = [
    /curl/i,
    /httpie/i,
    /postman/i,
    /insomnia/i,
    /paw/i,
    /wget/i,
  ];
  return clients.some(p => p.test(userAgent));
}

/**
 * Determine confidence level of the fingerprint
 */
export function calculateConfidence(components: FingerprintComponents): 'high' | 'medium' | 'low' {
  let score = 0;

  if (components.userAgent) score += 2;
  if (components.acceptLanguage) score += 1;
  if (components.acceptEncoding) score += 1;
  if (components.secChUa) score += 2;
  if (components.secChUaPlatform) score += 1;
  if (components.secFetchDest) score += 1;
  if (components.ip) score += 2;

  if (score >= 8) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

/**
 * Generate complete client fingerprint from request headers
 */
export async function generateFingerprint(headers: Headers): Promise<ClientFingerprint> {
  const components = extractFingerprintComponents(headers);
  const hash = await generateFingerprintHash(components);
  const botScore = calculateBotScore(components);
  const confidence = calculateConfidence(components);

  return {
    hash,
    components,
    confidence,
    isBot: botScore >= 50,
    botScore,
  };
}

/**
 * Check if client fingerprint matches known abuse patterns
 */
export interface AbuseCheckResult {
  isAbusive: boolean;
  reasons: string[];
  riskScore: number;
}

export function checkForAbuse(
  fingerprint: ClientFingerprint,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _context?: {
    apiKeyCount?: number;  // Number of API keys from this fingerprint
    requestsLastHour?: number;
    failedAuthAttempts?: number;
  }
): AbuseCheckResult {
  const reasons: string[] = [];
  let riskScore = 0;

  // High bot score
  if (fingerprint.botScore >= 70) {
    reasons.push('High bot likelihood');
    riskScore += 30;
  } else if (fingerprint.botScore >= 50) {
    reasons.push('Moderate bot likelihood');
    riskScore += 15;
  }

  // Low confidence fingerprint (might be evading detection)
  if (fingerprint.confidence === 'low') {
    reasons.push('Low fingerprint confidence');
    riskScore += 20;
  }

  // Empty or missing user agent
  if (!fingerprint.components.userAgent) {
    reasons.push('Missing user agent');
    riskScore += 25;
  }

  // Context-based checks would go here
  // (e.g., multiple API keys from same fingerprint)

  return {
    isAbusive: riskScore >= 50,
    reasons,
    riskScore: Math.min(riskScore, 100),
  };
}

/**
 * Generate a privacy-preserving fingerprint ID for logging
 * (hashes the full fingerprint to avoid storing PII)
 */
export async function generatePrivacyFingerprintId(fingerprint: ClientFingerprint): Promise<string> {
  const data = JSON.stringify({
    hash: fingerprint.hash,
    ip: fingerprint.components.ip,
  });
  const hash = await sha256(data);
  return hash.slice(0, 16);
}

/**
 * Client-side fingerprint for browser environment
 * Uses available browser APIs to create a unique identifier
 */
export async function getFingerprint(): Promise<string> {
  if (typeof window === 'undefined') {
    return 'server';
  }

  const components = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset().toString(),
    screen.width.toString(),
    screen.height.toString(),
    screen.colorDepth.toString(),
    navigator.hardwareConcurrency?.toString() || '',
    // Canvas fingerprint
    await getCanvasFingerprint(),
  ];

  const data = components.join('|');
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/**
 * Generate canvas fingerprint
 */
async function getCanvasFingerprint(): Promise<string> {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    canvas.width = 200;
    canvas.height = 50;

    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('nullcheck', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('nullcheck', 4, 17);

    return canvas.toDataURL().slice(-50);
  } catch {
    return '';
  }
}
