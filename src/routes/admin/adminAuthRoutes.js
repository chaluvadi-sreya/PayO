const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const adminAuth = require("../middleware/adminAuth");
const requireRole = require("../middleware/requireRole");

const {
  adminLogin,
  createSubAdmin,
  getAllAdmins,
  revokeAdminAccess,
  changeAdminPassword,
  getAllUsers,
  getUserBankDetails,
  updateAdminRole,
} = require("../../controllers/admin/adminAuthController");

// ── PUBLIC ───────────────────────────────────────────────────────────────────
router.post("/login", adminLogin);

// ── ALL ROUTES BELOW REQUIRE: valid JWT (auth) + admin role (adminAuth) ──────
router.use(auth, adminAuth);

// ── SUPER ADMIN ONLY ─────────────────────────────────────────────────────────
// Only super_admin can create, list, or revoke other admins
router.post(
  "/create-admin",
  requireRole("super_admin"),
  createSubAdmin
);

router.get(
  "/all-admins",
  requireRole("super_admin"),
  getAllAdmins
);

router.patch(
  "/revoke-admin/:userId",
  requireRole("super_admin"),
  revokeAdminAccess
);

router.patch(
  "/update-admin-role/:userId",
  requireRole("super_admin"),
  updateAdminRole
);

// ── SUPER ADMIN + OPERATIONS ADMIN + SUPPORT ADMIN ───────────────────────────
// KYC admin has no reason to manage users — their job is document review only
router.get(
  "/users",
  requireRole("super_admin", "operations_admin", "support_admin"),
  getAllUsers
);

router.get(
  "/user-bank-details/:userId",
  requireRole("super_admin", "support_admin"),
  getUserBankDetails
);

// ── ALL ADMINS ────────────────────────────────────────────────────────────────
// Any logged-in admin can change their own password
router.patch("/change-password", changeAdminPassword);

module.exports = router;