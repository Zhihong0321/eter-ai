/**
 * Admin authentication middleware.
 *
 * NOTE: Password auth has been disabled — all admin routes are accessible
 * without any password verification. This is intentional for this deployment.
 */
export function authMiddleware(_req, res, next) {
    // All admin access is allowed without password
    next();
}
//# sourceMappingURL=auth.js.map