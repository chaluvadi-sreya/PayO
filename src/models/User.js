const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,

  email: {
    type: String,
    unique: true,
  },

  mobile: {
    type: String,
    unique: true,
    required: true,
  },

  referredBy: {
    type: String,
    default: null,
  },

  password: String,

  referralcode: String,

  isVerified: {
    type: Boolean,
    default: false,
  },

  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Wallet",
  },

  myReferralCode: {
    type: String,
  },

  transactionPin: {
    type: String,
  },

  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },

  // ── ADDED FOR ROLE-BASED ACCESS CONTROL ──────────────────────────────────
  // Only set when role === "admin". null for regular users.
  // super_admin is the hardcoded env-var admin — never stored in DB.
  // All sub-admins created via API must have one of the other three values.
  adminRole: {
    type: String,
    enum: ["super_admin", "kyc_admin", "operations_admin", "support_admin"],
    default: null,
  },
  // ─────────────────────────────────────────────────────────────────────────

  kycVerified: {
    type: Boolean,
    default: false,
  },

  walletActivated: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("User", userSchema);