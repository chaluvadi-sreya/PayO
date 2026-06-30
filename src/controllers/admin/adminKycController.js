const Kyc  = require("../models/Kyc");
const User = require("../models/User");
 
// ════════════════════════════════════════════════════════════════════════════
// ADMIN — DASHBOARD OVERVIEW
// GET /api/admin/kyc/dashboard-stats
// Returns counts per status for an admin dashboard summary card.
// ════════════════════════════════════════════════════════════════════════════
const getDashboardStats = async (req, res) => {
  try {
    const [
      totalSubmissions,
      notStarted,
      docsUploaded,
      underReview,
      approved,
      rejected,
    ] = await Promise.all([
      Kyc.countDocuments(),
      Kyc.countDocuments({ status: "not_started" }),
      Kyc.countDocuments({ status: "documents_uploaded" }),
      Kyc.countDocuments({ status: "under_review" }),
      Kyc.countDocuments({ status: "approved" }),
      Kyc.countDocuments({ status: "rejected" }),
    ]);
 
    return res.status(200).json({
      success: true,
      stats: {
        totalSubmissions,
        notStarted,
        docsUploaded,
        underReview,
        approved,
        rejected,
      },
    });
  } catch (err) {
    console.error("getDashboardStats error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
 
// ════════════════════════════════════════════════════════════════════════════
// ADMIN — LIST ALL KYC SUBMISSIONS (with filters)
// GET /api/admin/kyc/all-submissions
// Query params:
//   status  — filter by status (optional)
//   page    — page number (default: 1)
//   limit   — results per page (default: 20)
// ════════════════════════════════════════════════════════════════════════════
const getAllSubmissions = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
 
    const filter = {};
    if (status) filter.status = status;
 
    const skip = (parseInt(page) - 1) * parseInt(limit);
 
    const [kycs, total] = await Promise.all([
      Kyc.find(filter)
        .populate("userId", "name mobile email")
        .populate("reviewedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Kyc.countDocuments(filter),
    ]);
 
    return res.status(200).json({
      success: true,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      kycs,
    });
  } catch (err) {
    console.error("getAllSubmissions error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
 
// ════════════════════════════════════════════════════════════════════════════
// ADMIN — LIST PENDING KYC SUBMISSIONS
// GET /api/admin/kyc/pending-reviews
// Returns all KYC records with status "under_review", oldest first so admin
// processes them in order of submission.
// ════════════════════════════════════════════════════════════════════════════
const listPendingReviews = async (req, res) => {
  try {
    const pendingKycs = await Kyc.find({ status: "under_review" })
      .populate("userId", "name mobile email")
      .sort({ createdAt: 1 }); // oldest first — FIFO queue
 
    return res.status(200).json({
      success: true,
      count: pendingKycs.length,
      kycs: pendingKycs,
    });
  } catch (err) {
    console.error("listPendingReviews error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
 
// ════════════════════════════════════════════════════════════════════════════
// ADMIN — GET SINGLE KYC DETAILS
// GET /api/admin/kyc/submission-details/:kycId
// Returns the full KYC record including all document URLs for admin review.
// ════════════════════════════════════════════════════════════════════════════
const getSubmissionDetails = async (req, res) => {
  try {
    const { kycId } = req.params;
 
    const kyc = await Kyc.findById(kycId)
      .populate("userId", "name mobile email createdAt")
      .populate("reviewedBy", "name email");
 
    if (!kyc) {
      return res.status(404).json({ success: false, message: "KYC record not found" });
    }
 
    return res.status(200).json({
      success: true,
      kyc,
    });
  } catch (err) {
    console.error("getSubmissionDetails error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
 
// ════════════════════════════════════════════════════════════════════════════
// ADMIN — APPROVE KYC
// PATCH /api/admin/kyc/approve-verification/:kycId
// Approves the KYC record and activates the user's wallet.
// User will see Screen 5 (Approved) on next poll.
// ════════════════════════════════════════════════════════════════════════════
// controllers/adminKycController.js - FIXED version
// controllers/adminKycController.js - FIXED approveVerification
const approveVerification = async (req, res) => {
  try {
    const { kycId } = req.params;
    
    const kyc = await Kyc.findById(kycId);
    
    if (!kyc) {
      return res.status(404).json({ success: false, message: "KYC record not found" });
    }
    
    if (kyc.status !== "under_review") {
      return res.status(400).json({
        success: false,
        message: `Cannot approve. Current status is "${kyc.status}"`,
      });
    }
    
    // ✅ FIX: Handle super admin (string) vs regular admin (ObjectId)
    let reviewerId = null;
    let reviewerName = "Admin";
    
    if (req.adminUser) {
      if (req.adminUser.superAdmin) {
        // Super admin from .env - don't set reviewedBy (or set to null)
        reviewerId = null;
        reviewerName = "Super Admin";
      } else {
        // Regular admin from database
        reviewerId = req.adminUser._id;
        reviewerName = req.adminUser.name;
      }
    }
    
    // Update KYC record
    kyc.status = "approved";
    if (reviewerId) {
      kyc.reviewedBy = reviewerId;  // Only set if it's a real ObjectId
    }
    kyc.reviewedAt = new Date();
    kyc.rejectionReason = null;
    await kyc.save();
    
    // Activate wallet
    await User.findByIdAndUpdate(kyc.userId, {
      kycVerified: true,
      walletActivated: true,
    });
    
    return res.status(200).json({
      success: true,
      message: "KYC approved. User wallet has been activated.",
      kycId: kyc._id,
      userId: kyc.userId,
      approvedBy: reviewerName,
      approvedAt: kyc.reviewedAt,
    });
    
  } catch (err) {
    console.error("approveVerification error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error",
      error: err.message 
    });
  }
};
// ════════════════════════════════════════════════════════════════════════════
// ADMIN — REJECT KYC
// PATCH /api/admin/kyc/reject-verification/:kycId
// Rejects the KYC with a reason. User sees Screen 6 on next poll.
// Their data stays for audit; they must hit /reset-and-retry to try again.
// Body: { reason: "string" }
// ════════════════════════════════════════════════════════════════════════════
const rejectVerification = async (req, res) => {
  try {
    const { kycId } = req.params;
    const { reason } = req.body;
    
    console.log("=== Reject Request ===");
    console.log("Received kycId:", kycId);
    console.log("ID length:", kycId?.length);
    
    // Validate ObjectId format
    if (!kycId || kycId.length !== 24) {
      return res.status(400).json({
        success: false,
        message: `Invalid KYC ID format. Must be 24 characters, got ${kycId?.length || 0} characters.`,
        receivedId: kycId,
        expectedFormat: "24 character hex string"
      });
    }
    
    // Validate reason
    if (!reason || reason.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "A rejection reason is required",
      });
    }
    
    // Find KYC
    const kyc = await Kyc.findById(kycId);
    
    if (!kyc) {
      return res.status(404).json({ 
        success: false, 
        message: "KYC record not found",
        searchedId: kycId
      });
    }
    
    // Check status
    if (kyc.status !== "under_review") {
      return res.status(400).json({
        success: false,
        message: `Cannot reject. Current status is "${kyc.status}". Only "under_review" can be rejected.`,
      });
    }
    
    // Handle super admin vs regular admin
    let reviewerId = null;
    let reviewerName = "Admin";
    
    if (req.adminUser) {
      if (req.adminUser.superAdmin) {
        reviewerId = null;
        reviewerName = "Super Admin";
        console.log("Super admin rejecting KYC");
      } else {
        reviewerId = req.adminUser._id;
        reviewerName = req.adminUser.name;
        console.log("Regular admin rejecting KYC:", reviewerName);
      }
    }
    
    // Update KYC
    kyc.status = "rejected";
    kyc.reviewedAt = new Date();
    kyc.rejectionReason = reason.trim();
    
    if (reviewerId) {
      kyc.reviewedBy = reviewerId;
    }
    
    await kyc.save();
    
    console.log("KYC rejected successfully");
    
    return res.status(200).json({
      success: true,
      message: "KYC rejected successfully",
      kycId: kyc._id,
      userId: kyc.userId,
      reason: kyc.rejectionReason,
      rejectedBy: reviewerName,
      rejectedAt: kyc.reviewedAt,
    });
    
  } catch (err) {
    console.error("rejectVerification error:", err);
    console.error("Error stack:", err.stack);
    
    // Send detailed error for debugging
    res.status(500).json({ 
      success: false, 
      message: "Server error",
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};
// Add to your adminKycController.js
const getAllKycIds = async (req, res) => {
  try {
    const kycs = await Kyc.find({}, { _id: 1, status: 1, userId: 1 })
      .limit(10);
    
    res.json({
      success: true,
      count: kycs.length,
      kycs: kycs.map(k => ({
        id: k._id.toString(),
        idLength: k._id.toString().length,
        status: k.status,
        userId: k.userId
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


 
// ════════════════════════════════════════════════════════════════════════════
// ADMIN — BULK APPROVE
// PATCH /api/admin/kyc/bulk-approve
// Body: { kycIds: ["id1", "id2", ...] }
// Approves multiple KYC submissions in one call.
// ════════════════════════════════════════════════════════════════════════════
const bulkApprove = async (req, res) => {
  try {
    const { kycIds } = req.body;
    
    if (!Array.isArray(kycIds) || kycIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "kycIds must be a non-empty array",
      });
    }
    
    const kycs = await Kyc.find({
      _id: { $in: kycIds },
      status: "under_review",
    });
    
    if (kycs.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No under-review KYC records found for the provided IDs",
      });
    }
    
    const now = new Date();
    const userIds = kycs.map((k) => k.userId);
    const approvedIds = kycs.map((k) => k._id);
    
    // ✅ FIX: Handle super admin for bulk operations
    const updateData = {
      status: "approved",
      reviewedAt: now,
      rejectionReason: null,
    };
    
    // Only add reviewedBy if it's a real admin (not super admin)
    if (req.adminUser && !req.adminUser.superAdmin) {
      updateData.reviewedBy = req.adminUser._id;
    }
    
    // Bulk update KYC records
    await Kyc.updateMany(
      { _id: { $in: approvedIds } },
      { $set: updateData }
    );
    
    // Bulk activate wallets
    await User.updateMany(
      { _id: { $in: userIds } },
      { $set: { kycVerified: true, walletActivated: true } }
    );
    
    return res.status(200).json({
      success: true,
      message: `${approvedIds.length} KYC record(s) approved and wallets activated`,
      approvedCount: approvedIds.length,
      approvedKycIds: approvedIds,
    });
  } catch (err) {
    console.error("bulkApprove error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
 
// ════════════════════════════════════════════════════════════════════════════
// ADMIN — BULK REJECT
// PATCH /api/admin/kyc/bulk-reject
// Body: { kycIds: ["id1", "id2", ...], reason: "string" }
// ════════════════════════════════════════════════════════════════════════════
const bulkReject = async (req, res) => {
  try {
    const { kycIds, reason } = req.body;
 
    if (!Array.isArray(kycIds) || kycIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "kycIds must be a non-empty array",
      });
    }
 
    if (!reason || reason.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "A rejection reason is required for bulk reject",
      });
    }
 
    const result = await Kyc.updateMany(
      { _id: { $in: kycIds }, status: "under_review" },
      {
        $set: {
          status:          "rejected",
          reviewedBy:      req.userId,
          reviewedAt:      new Date(),
          rejectionReason: reason.trim(),
        },
      }
    );
 
    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount} KYC record(s) rejected`,
      rejectedCount: result.modifiedCount,
      reason: reason.trim(),
    });
  } catch (err) {
    console.error("bulkReject error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
 
// ════════════════════════════════════════════════════════════════════════════
// ADMIN — SEARCH KYC BY USER
// GET /api/admin/kyc/search-user?query=<mobile|email|name>
// Search for a specific user's KYC by their mobile, email, or name.
// ════════════════════════════════════════════════════════════════════════════
const searchUserKyc = async (req, res) => {
  try {
    const { query } = req.query;
 
    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Query param is required (mobile, email, or name)",
      });
    }
 
    // Find matching users first
    const users = await User.find({
      $or: [
        { mobile: { $regex: query, $options: "i" } },
        { email:  { $regex: query, $options: "i" } },
        { name:   { $regex: query, $options: "i" } },
      ],
    }).select("_id name mobile email");
 
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No users found matching the search query",
      });
    }
 
    const userIds = users.map((u) => u._id);
 
    const kycs = await Kyc.find({ userId: { $in: userIds } })
      .populate("userId", "name mobile email")
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 });
 
    return res.status(200).json({
      success: true,
      count: kycs.length,
      kycs,
    });
  } catch (err) {
    console.error("searchUserKyc error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
 
// ════════════════════════════════════════════════════════════════════════════
// ADMIN — DELETE KYC RECORD (hard delete for data cleanup)
// DELETE /api/admin/kyc/delete-record/:kycId
// Only allowed for rejected records. Approved records are audit-safe and
// should never be deleted.
// ════════════════════════════════════════════════════════════════════════════
const deleteKycRecord = async (req, res) => {
  try {
    const { kycId } = req.params;
 
    const kyc = await Kyc.findById(kycId);
 
    if (!kyc) {
      return res.status(404).json({ success: false, message: "KYC record not found" });
    }
 
    if (kyc.status === "approved") {
      return res.status(403).json({
        success: false,
        message: "Approved KYC records cannot be deleted (audit trail must be preserved)",
      });
    }
 
    await Kyc.deleteOne({ _id: kycId });
 
    return res.status(200).json({
      success: true,
      message: "KYC record deleted successfully",
      deletedKycId: kycId,
    });
  } catch (err) {
    console.error("deleteKycRecord error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
 
// ════════════════════════════════════════════════════════════════════════════
// ADMIN — AUDIT LOG (recent admin actions)
// GET /api/admin/kyc/audit-log
// Returns recently reviewed KYC records with who reviewed them and when.
// Query params: page, limit
// ════════════════════════════════════════════════════════════════════════════
const getAuditLog = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
 
    const [logs, total] = await Promise.all([
      Kyc.find({ reviewedBy: { $ne: null } })
        .populate("userId",     "name mobile email")
        .populate("reviewedBy", "name email")
        .select("status rejectionReason reviewedBy reviewedAt submissionCount documentType userId")
        .sort({ reviewedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Kyc.countDocuments({ reviewedBy: { $ne: null } }),
    ]);
 
    return res.status(200).json({
      success: true,
      total,
      page:       parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      logs,
    });
  } catch (err) {
    console.error("getAuditLog error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
 
module.exports = {
  getDashboardStats,
  getAllSubmissions,
  listPendingReviews,
  getSubmissionDetails,
  approveVerification,
  rejectVerification,
  bulkApprove,
  bulkReject,
  searchUserKyc,
  deleteKycRecord,
  getAuditLog,
  getAllKycIds,
};
