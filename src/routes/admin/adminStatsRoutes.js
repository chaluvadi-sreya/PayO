const express = require("express");
const router  = express.Router();

const auth      = require("../middleware/auth");
const adminAuth = require("../middleware/adminAuth");

const {
  getWidgetStats,
  getReferralManagement,
  getTransactionMonitoring,
  getTransactionDetails,
} = require("../../controllers/admin/adminStatsController");

router.use(auth, adminAuth);

// Dashboard widget stats
router.get("/widgets", getWidgetStats);

// Referral Management page
router.get("/referrals", getReferralManagement);

// Transaction Monitoring page
router.get("/transactions", getTransactionMonitoring);

// Transaction Details (view button)
router.get("/transactions/:transactionId", getTransactionDetails);

module.exports = router;