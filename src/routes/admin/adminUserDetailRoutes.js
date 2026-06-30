const express    = require("express");
const router     = express.Router();

const auth        = require("../middleware/auth");
const adminAuth   = require("../middleware/adminAuth");
const requireRole = require("../middleware/requireRole");

const {
  getUserKycDocs,
  getUserTransactions,
  getUserReferralDetails,
} = require("../../controllers/admin/adminUserDetailController");

// ── ALL ROUTES BELOW REQUIRE: valid JWT (auth) + admin role (adminAuth) ──────
router.use(auth, adminAuth);

// ────────────────────────────────────────────────────────────────────────────
// KYC DOCUMENTS TAB
// GET /api/admin/user-details/:userId/kyc
// ────────────────────────────────────────────────────────────────────────────
router.get(
  "/:userId/kyc",
  requireRole("super_admin", "kyc_admin", "support_admin"),
  getUserKycDocs
);

// ────────────────────────────────────────────────────────────────────────────
// TRANSACTIONS TAB
// GET /api/admin/user-details/:userId/transactions?page=1&limit=20&status=
// ────────────────────────────────────────────────────────────────────────────
router.get(
  "/:userId/transactions",
  requireRole("super_admin", "operations_admin", "support_admin"),
  getUserTransactions
);

// ────────────────────────────────────────────────────────────────────────────
// REFERRAL TAB
// GET /api/admin/user-details/:userId/referral
// ────────────────────────────────────────────────────────────────────────────
router.get(
  "/:userId/referral",
  requireRole("super_admin", "operations_admin", "support_admin"),
  getUserReferralDetails
);

module.exports = router;
