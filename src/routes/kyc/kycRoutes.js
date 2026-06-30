const express = require("express");
const router  = express.Router();
 
const auth = require("../middleware/auth");           // your existing JWT middleware
const { uploadAadhar, uploadPan, uploadPassport, uploadPassbook,uploadCheque,uploadStatement } = require("../middleware/kycUpload");
 
const {
  // User flows (match all 6 screens)
  getVerificationStatus,
  uploadAadharDocuments,
  uploadPanDocuments,
  uploadPassportDocuments,  
  submitForReview,
  getReviewPipelineStatus,
  getApprovalConfirmation,
  getRejectionDetails,
  resetAndRetry,
  uploadCancelledChequeDocuments,
  uploadPassbookDocuments,
  uploadStatementDocuments
  
} = require("../../controllers/kyc/kycController");
 
// ─────────────────────────────────────────────────────────────────────────────
// ALL routes require a valid JWT (Bearer token)
// ─────────────────────────────────────────────────────────────────────────────
router.use(auth);
 
// ══════════════════════════════════════════════════════════════
//  USER KYC ROUTES
// ══════════════════════════════════════════════════════════════
 
/**
 * SCREEN 1 (on app load)
 * GET /api/kyc/verification-status
 * Returns the user's current KYC status so the app routes to the correct screen.
 *
 * Response statuses:
 *   not_started        → show Screen 1 (choose document type)
 *   documents_uploaded → show Screen 4 (under review) — or re-submit
 *   under_review       → show Screen 4 (polling pipeline)
 *   approved           → show Screen 5 (approved)
 *   rejected           → show Screen 6 (failed)
 */
router.get("/verification-status", getVerificationStatus);
 
/**
 * SCREEN 1 — Aadhar selected
 * POST /api/kyc/upload-aadhar-documents
 * Body (multipart/form-data): aadharFront,selfie
 */
router.post(
  "/upload-aadhar-documents",
  uploadAadhar,
  uploadAadharDocuments
);
 
/**
 * SCREEN 2 — PAN Card selected
 * POST /api/kyc/upload-pan-documents
 * Body (multipart/form-data): panCard
 */
router.post(
  "/upload-pan-documents",
  uploadPan,
  uploadPanDocuments
);
 
/**
 * SCREEN 3 — Passport selected
 * POST /api/kyc/upload-passport-documents
 * Body (multipart/form-data): passport
 */
router.post(
  "/upload-passport-documents",
  uploadPassport,
  uploadPassportDocuments
);


 router.post(
  "/upload-passbook-documents",
  uploadPassbook,
  uploadPassbookDocuments
);

 router.post(
  "/upload-cheque-documents",
  uploadCheque,
  uploadCancelledChequeDocuments
);
 router.post(
  "/upload-statement-documents",
  uploadStatement,
  uploadStatementDocuments
);
/**
 * SCREEN 3 → SCREEN 4  (Submit button tap)
 * POST /api/kyc/submit-for-review
 * No body required. Transitions status: documents_uploaded → under_review
 */
router.post("/submit-for-review", submitForReview);
 
/**
 * SCREEN 4 — Under Review polling
 * GET /api/kyc/review-pipeline-status
 * Poll every ~5 s to animate the checklist and detect admin decision.
 */
router.get("/review-pipeline-status", getReviewPipelineStatus);
 
/**
 * SCREEN 5 — KYC Approved
 * GET /api/kyc/approval-confirmation
 * Returns approval details + wallet activation confirmation.
 */
router.get("/approval-confirmation", getApprovalConfirmation);
 
/**
 * SCREEN 6 — Verification Failed
 * GET /api/kyc/rejection-details
 * Returns rejection reason + retry tips.
 */
router.get("/rejection-details", getRejectionDetails);
 
/**
 * SCREEN 6 — Retry button tap
 * DELETE /api/kyc/reset-and-retry
 * Deletes the rejected KYC record so the user can start fresh.
 */
router.delete("/reset-and-retry", resetAndRetry);

 
module.exports = router;