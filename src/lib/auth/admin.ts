/**
 * Shared admin access verification
 *
 * SECURITY: Always requires ADMIN_SECRET, even in development.
 */

import { NextRequest } from 'next/server';

/**
 * Verify admin access via ADMIN_SECRET Bearer token
 */
export function verifyAdminAccess(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const adminSecret = process.env.ADMIN_SECRET;

  // ADMIN_SECRET must be configured
  if (!adminSecret) {
    console.error('ADMIN_SECRET not configured - admin access denied');
    return false;
  }

  // Require Bearer token matching ADMIN_SECRET
  if (authHeader === `Bearer ${adminSecret}`) {
    return true;
  }

  return false;
}
