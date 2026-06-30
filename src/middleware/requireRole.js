/**
 * requireRole(...allowedRoles)
 *
 * Middleware factory for route-level role-based access control.
 * MUST be placed AFTER auth + adminAuth in the middleware chain,
 * because adminAuth is what sets req.adminRole.
 *
 * Available roles:
 *   "super_admin"       — full system access
 *   "kyc_admin"         — manage KYC approvals
 *   "operations_admin"  — monitor transactions / wallets
 *   "support_admin"     — handle user issues
 *
 * Usage in routes:
 *   const requireRole = require("../middleware/requireRole");
 *
 *   // Only super admin
 *   router.post("/create-admin", requireRole("super_admin"), createSubAdmin);
 *
 *   // Super admin OR kyc admin
 *   router.patch("/approve/:id", requireRole("super_admin", "kyc_admin"), approveVerification);
 */

module.exports = (...allowedRoles) => (req, res, next) => {
  const role = req.adminRole;

  if (!role) {
    return res.status(403).json({
      success: false,
      message: "Access denied. No admin role assigned to this account. Contact Super Admin.",
    });
  }

  if (!allowedRoles.includes(role)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Your role "${role}" is not permitted for this action.`,
    });
  }

  next();
};