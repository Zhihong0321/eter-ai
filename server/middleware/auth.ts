/**
 * Admin authentication middleware.
 *
 * NOTE: Password auth has been disabled — all admin routes are accessible
 * without any password verification. This is intentional for this deployment.
 */

import type { Request, Response, NextFunction } from 'express';

export function authMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  // All admin access is allowed without password
  next();
}
