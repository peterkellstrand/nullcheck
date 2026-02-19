/**
 * Analytics wrapper for PostHog
 *
 * Setup:
 * 1. Create account at https://posthog.com
 * 2. Add NEXT_PUBLIC_POSTHOG_KEY to .env
 * 3. Analytics auto-initializes in Providers.tsx
 */

import posthog from 'posthog-js';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

let initialized = false;

/**
 * Initialize PostHog analytics
 * Call this once in your app (e.g., in Providers.tsx)
 */
export function initAnalytics(): void {
  if (typeof window === 'undefined') return;
  if (initialized) return;
  if (!POSTHOG_KEY) {
    console.debug('Analytics: NEXT_PUBLIC_POSTHOG_KEY not set, skipping');
    return;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false, // We'll track manually for SPA
    capture_pageleave: true,
    persistence: 'localStorage',
    autocapture: false, // Manual tracking for control
    disable_session_recording: true, // Enable when needed
  });

  initialized = true;
}

/**
 * Track a custom event
 */
export function trackEvent(
  event: string,
  properties?: Record<string, string | number | boolean | null>
): void {
  if (!initialized || typeof window === 'undefined') return;
  posthog.capture(event, properties);
}

/**
 * Track a page view
 */
export function trackPageView(path?: string): void {
  if (!initialized || typeof window === 'undefined') return;
  posthog.capture('$pageview', {
    $current_url: path || window.location.href,
  });
}

/**
 * Identify a user (call after login)
 */
export function identifyUser(
  userId: string,
  traits?: Record<string, string | number | boolean>
): void {
  if (!initialized || typeof window === 'undefined') return;
  posthog.identify(userId, traits);
}

/**
 * Reset user identity (call on logout)
 */
export function resetUser(): void {
  if (!initialized || typeof window === 'undefined') return;
  posthog.reset();
}

/**
 * Set user properties without identifying
 */
export function setUserProperties(
  properties: Record<string, string | number | boolean>
): void {
  if (!initialized || typeof window === 'undefined') return;
  posthog.people.set(properties);
}

// Pre-defined event names for consistency
export const EVENTS = {
  // Token events
  TOKEN_VIEW: 'token_view',
  TOKEN_SEARCH: 'token_search',

  // Watchlist events
  WATCHLIST_ADD: 'watchlist_add',
  WATCHLIST_REMOVE: 'watchlist_remove',

  // Chart events
  CHART_VIEW: 'chart_view',
  CHART_TIMEFRAME_CHANGE: 'chart_timeframe_change',

  // Risk events
  RISK_PANEL_EXPAND: 'risk_panel_expand',

  // Auth events
  SIGNUP: 'signup',
  LOGIN: 'login',
  LOGOUT: 'logout',

  // Subscription events
  UPGRADE_CLICK: 'upgrade_click',
  UPGRADE_COMPLETE: 'upgrade_complete',

  // API events
  API_KEY_CREATE: 'api_key_create',
  API_KEY_REVOKE: 'api_key_revoke',
} as const;
