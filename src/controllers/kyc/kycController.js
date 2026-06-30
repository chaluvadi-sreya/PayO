const Kyc   = require("../models/Kyc");
const User  = require("../models/User");
const path  = require("path");
const fs=require("fs");
 
// ─── helpers ────────────────────────────────────────────────────────────────
 
/**
 * Build a public-accessible URL for a saved file.
 * req.file.path is the absolute disk path; we expose it as /kyc-docs/<userId>/filename
 */
// In kycController.js, update the toPublicUrl function:
const toPublicUrl = (req, filePath) => {
  if (!filePath) return null;
  // Get relative path from uploads folder
  const relativePath = path.relative(path.join(__dirname, "../uploads"), filePath);
  // Convert Windows backslashes to forward slashes
  const normalizedPath = relativePath.replace(/\\/g, "/");
  return `${req.protocol}://${req.get("host")}/kyc-docs/${normalizedPath}`;
};
 const getExtension = (base64Data) => {
  const mimeType = base64Data.split(";")[0].split(":")[1];

  switch (mimeType) {
    case "application/pdf":
      return ".pdf";

    case "image/jpeg":
      return ".jpg";

    case "image/png":
      return ".png";

    case "image/webp":
      return ".webp";

    default:
      throw new Error(`Unsupported file type: ${mimeType}`);
  }
};
// ════════════════════════════════════════════════════════════════════════════
// SCREEN 1 — GET KYC STATUS  →  GET /api/kyc/verification-status
// Returns current KYC record (or "not_started") so the app knows which screen
// to show on launch.
// ════════════════════════════════════════════════════════════════════════════
const getVerificationStatus = async (req, res) => {
  try {
    const kyc = await Kyc.findOne({ userId: req.userId });
 
    if (!kyc) {
      return res.status(200).json({
        success: true,
        status: "not_started",
        kyc: null,
        message: "KYC not initiated yet",
      });
    }
 
    return res.status(200).json({
      success: true,
      status: kyc.status,
      kyc: {
        documentType:   kyc.documentType,
        status:         kyc.status,
        rejectionReason: kyc.rejectionReason,
        submissionCount: kyc.submissionCount,
        updatedAt:      kyc.updatedAt,
      },
    });
  } catch (err) {
    console.error("getVerificationStatus error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
 
// ════════════════════════════════════════════════════════════════════════════
// SCREEN 1 — UPLOAD AADHAR DOCUMENTS  →  POST /api/kyc/upload-aadhar-documents
// Accepts: aadharFront (file), aadharBack (file), selfie (file)
// ════════════════════════════════════════════════════════════════════════════
const uploadAadharDocuments = async (req, res) => {
  try {
    const { aadharFront, selfie } = req.body;

    if (!aadharFront || !selfie) {
      return res.status(400).json({
        success: false,
        message: "Aadhar front and selfie are required",
      });
    }

    const userId = req.userId;

    const uploadDir = path.join(
      __dirname,
      "../uploads/kyc",
      userId.toString()
    );

    fs.mkdirSync(uploadDir, { recursive: true });

    // Aadhaar
    const aadharBase64 = aadharFront.split(";base64,").pop();

    // Aadhaar
const aadharExt = getExtension(aadharFront);

const aadharFileName = `aadharFront-${Date.now()}${aadharExt}`;

    const aadharPath = path.join(
      uploadDir,
      aadharFileName
    );

    fs.writeFileSync(
      aadharPath,
      aadharBase64,
      "base64"
    );

    // Selfie
    const selfieBase64 = selfie.split(";base64,").pop();

   const isPdf = aadharFront.startsWith("data:application/pdf");

// Selfie
const selfieExt = getExtension(selfie);

const selfieFileName = `selfie-${Date.now()}${selfieExt}`;

    const selfiePath = path.join(
      uploadDir,
      selfieFileName
    );

    fs.writeFileSync(
      selfiePath,
      selfieBase64,
      "base64"
    );

    let kyc = await Kyc.findOne({
      userId: req.userId,
    });

    const user = await User.findById(req.userId);

    if (!kyc) {
      kyc = await Kyc.create({
        userId: req.userId,
        fullName: user.name,
        status: "not_started",
        submissionCount: 0,
      });
    }

    kyc.aadharFrontUrl = toPublicUrl(req, aadharPath);
    kyc.selfieUrl = toPublicUrl(req, selfiePath);

    kyc.fullName = user.name;

    await kyc.save();

    return res.status(201).json({
      success: true,
      message: "Aadhar uploaded successfully",
      kycId: kyc._id,
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
// ════════════════════════════════════════════════════════════════════════════
// SCREEN 2 — UPLOAD PAN CARD  →  POST /api/kyc/upload-pan-documents
// Accepts: panCard (file), selfie (file)
// ════════════════════════════════════════════════════════════════════════════
const uploadPanDocuments = async (req, res) => {
  try {
    const { panCard } = req.body;

    if (!panCard) {
      return res.status(400).json({
        success: false,
        message: "PAN card image is required",
      });
    }

    const userId = req.userId;

    const uploadDir = path.join(
      __dirname,
      "../uploads/kyc",
      userId.toString()
    );

    fs.mkdirSync(uploadDir, { recursive: true });

    const panBase64 = panCard.split(";base64,").pop();

  const ext = getExtension(panCard);

const panFileName = `panCard-${Date.now()}${ext}`;

    const panPath = path.join(
      uploadDir,
      panFileName
    );

    fs.writeFileSync(
      panPath,
      panBase64,
      "base64"
    );

    let kyc = await Kyc.findOne({
      userId: req.userId,
    });

    if (!kyc || !kyc.aadharFrontUrl) {
      return res.status(400).json({
        success: false,
        message: "Please upload Aadhar first",
      });
    }

    kyc.panCardUrl = toPublicUrl(req, panPath);

    // ✅ FIX: use correct schema field names (cancelChequeUrl, bankStatementUrl)
    if (
      kyc.aadharFrontUrl &&
      kyc.selfieUrl &&
      (kyc.panCardUrl || kyc.passportUrl || kyc.passbookUrl || kyc.cancelChequeUrl || kyc.bankStatementUrl)
    ) {
      kyc.status = "documents_uploaded";
    }


    await kyc.save();

    return res.status(201).json({
      success: true,
      message: "PAN uploaded successfully",
      kycId: kyc._id,
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
 
// ════════════════════════════════════════════════════════════════════════════
// SCREEN 3 — UPLOAD PASSPORT  →  POST /api/kyc/upload-passport-documents
// Accepts: passport (file), selfie (file)
// ════════════════════════════════════════════════════════════════════════════
// In kycController.js - Update uploadPassportDocuments
const uploadPassportDocuments = async (req, res) => {
  try {
    const { passport } = req.body;

    if (!passport) {
      return res.status(400).json({
        success: false,
        message: "Passport image is required",
      });
    }

    const userId = req.userId;

    const uploadDir = path.join(
      __dirname,
      "../uploads/kyc",
      userId.toString()
    );

    fs.mkdirSync(uploadDir, { recursive: true });

    const passportBase64 = passport.split(";base64,").pop();

   const ext = getExtension(passport);

const passportFileName = `passport-${Date.now()}${ext}`;

    const passportPath = path.join(
      uploadDir,
      passportFileName
    );

    fs.writeFileSync(
      passportPath,
      passportBase64,
      "base64"
    );

    let kyc = await Kyc.findOne({
      userId: req.userId,
    });

    if (!kyc || !kyc.aadharFrontUrl) {
      return res.status(400).json({
        success: false,
        message: "Please upload Aadhar first",
      });
    }

    kyc.passportUrl = toPublicUrl(req, passportPath);

    // ✅ FIX: use correct schema field names (cancelChequeUrl, bankStatementUrl)
    if (
      kyc.aadharFrontUrl &&
      kyc.selfieUrl &&
      (kyc.panCardUrl || kyc.passportUrl || kyc.passbookUrl || kyc.cancelChequeUrl || kyc.bankStatementUrl)
    ) {
      kyc.status = "documents_uploaded";
    }


    await kyc.save();

    return res.status(201).json({
      success: true,
      message: "Passport uploaded successfully",
      kycId: kyc._id,
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};



const uploadPassbookDocuments = async (req, res) => {
  try {
    const { passbook } = req.body;

    if (!passbook) {
      return res.status(400).json({
        success: false,
        message: "Passbook image is required",
      });
    }

    const userId = req.userId;

    const uploadDir = path.join(
      __dirname,
      "../uploads/kyc",
      userId.toString()
    );

    fs.mkdirSync(uploadDir, { recursive: true });

    const passBase64 = passbook.split(";base64,").pop();

  const ext = getExtension(passbook);

const passFileName = `passbook-${Date.now()}${ext}`;

    const passPath = path.join(
      uploadDir,
      passFileName
    );

    fs.writeFileSync(
      passPath,
      passBase64,
      "base64"
    );

    let kyc = await Kyc.findOne({
      userId: req.userId,
    });

    if (!kyc || !kyc.aadharFrontUrl) {
      return res.status(400).json({
        success: false,
        message: "Please upload Aadhar first",
      });
    }

    kyc.passbookUrl = toPublicUrl(req, passPath);

    // ✅ FIX: use correct schema field names (cancelChequeUrl, bankStatementUrl)
    if (
      kyc.aadharFrontUrl &&
      kyc.selfieUrl &&
      (kyc.panCardUrl || kyc.passportUrl || kyc.passbookUrl || kyc.cancelChequeUrl || kyc.bankStatementUrl)
    ) {
      kyc.status = "documents_uploaded";
    }

    await kyc.save();

    return res.status(201).json({
      success: true,
      message: "PASSBOOK uploaded successfully",
      kycId: kyc._id,
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};



const uploadCancelledChequeDocuments = async (req, res) => {
  try {
    const { cheque } = req.body;

    if (!cheque) {
      return res.status(400).json({
        success: false,
        message: "Cancelled cheque image is required",
      });
    }

    const userId = req.userId;

    const uploadDir = path.join(
      __dirname,
      "../uploads/kyc",
      userId.toString()
    );

    fs.mkdirSync(uploadDir, { recursive: true });

    const cheBase64 = cheque.split(";base64,").pop();

  const ext = getExtension(cheque);

const cheFileName = `cheque-${Date.now()}${ext}`;

    const chePath = path.join(
      uploadDir,
      cheFileName
    );

    fs.writeFileSync(
      chePath,
      cheBase64,
      "base64"
    );

    let kyc = await Kyc.findOne({
      userId: req.userId,
    });

    if (!kyc || !kyc.aadharFrontUrl) {
      return res.status(400).json({
        success: false,
        message: "Please upload Aadhar first",
      });
    }

    // ✅ FIX: was kyc.cancelledChequeUrl — correct schema field is cancelChequeUrl
    kyc.cancelChequeUrl = toPublicUrl(req, chePath);

    // ✅ FIX: use correct schema field names (cancelChequeUrl, bankStatementUrl)
    if (
      kyc.aadharFrontUrl &&
      kyc.selfieUrl &&
      (kyc.panCardUrl || kyc.passportUrl || kyc.passbookUrl || kyc.cancelChequeUrl || kyc.bankStatementUrl)
    ) {
      kyc.status = "documents_uploaded";
    }

    await kyc.save();

    return res.status(201).json({
      success: true,
      message: "CANCELLED CHEQUE uploaded successfully",
      kycId: kyc._id,
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};



const uploadStatementDocuments = async (req, res) => {
  try {
    const { statement } = req.body;

    if (!statement) {
      return res.status(400).json({
        success: false,
        message: "Statement image is required",
      });
    }

    const userId = req.userId;

    const uploadDir = path.join(
      __dirname,
      "../uploads/kyc",
      userId.toString()
    );

    fs.mkdirSync(uploadDir, { recursive: true });

    const staBase64 = statement.split(";base64,").pop();

  const ext = getExtension(statement);

const staFileName = `statement-${Date.now()}${ext}`;

    const staPath = path.join(
      uploadDir,
      staFileName
    );

    fs.writeFileSync(
      staPath,
      staBase64,
      "base64"
    );

    let kyc = await Kyc.findOne({
      userId: req.userId,
    });

    if (!kyc || !kyc.aadharFrontUrl) {
      return res.status(400).json({
        success: false,
        message: "Please upload Aadhar first",
      });
    }

    // ✅ FIX: was kyc.statementUrl — correct schema field is bankStatementUrl
    kyc.bankStatementUrl = toPublicUrl(req, staPath);

    // ✅ FIX: use correct schema field names (cancelChequeUrl, bankStatementUrl)
    if (
      kyc.aadharFrontUrl &&
      kyc.selfieUrl &&
      (kyc.panCardUrl || kyc.passportUrl || kyc.passbookUrl || kyc.cancelChequeUrl || kyc.bankStatementUrl)
    ) {
      kyc.status = "documents_uploaded";
    }

    await kyc.save();

    return res.status(201).json({
      success: true,
      message: "BANK STATEMENT uploaded successfully",
      kycId: kyc._id,
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

//════════════════════════════════════════════════════════════════════════════
// SCREEN 3 → SCREEN 4  —  SUBMIT FOR REVIEW  →  POST /api/kyc/submit-for-review
// Marks the KYC as "under_review". Call this after uploading documents to
// trigger the "Under Review" screen (Screen 4).
// ════════════════════════════════════════════════════════════════════════════
const submitForReview = async (req, res) => {
  try {
    const kyc = await Kyc.findOne({ userId: req.userId });
 
    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: "No KYC record found. Please upload documents first.",
      });
    }
 
    if (kyc.status !== "documents_uploaded") {
      return res.status(400).json({
        success: false,
        message: `Cannot submit for review. Current status: ${kyc.status}`,
      });
    }
 
    kyc.status = "under_review";
    kyc.submissionCount = (kyc.submissionCount || 0) + 1;
    await kyc.save();
 
    return res.status(200).json({
      success: true,
      message: "KYC submitted for review successfully",
      status: kyc.status,
      pipeline: {
        accountCreated:      "Completed",
        documentsUploaded:   "Completed",
        kycVerification:     "Pending",
        walletActivated:     "Pending",
      },
    });
  } catch (err) {
    console.error("submitForReview error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
 
// ════════════════════════════════════════════════════════════════════════════
// SCREEN 4 — POLL REVIEW PIPELINE  →  GET /api/kyc/review-pipeline-status
// Front-end polls this to animate the checklist on Screen 4.
// ════════════════════════════════════════════════════════════════════════════
const getReviewPipelineStatus = async (req, res) => {
  try {
    const kyc = await Kyc.findOne({ userId: req.userId });
 
    if (!kyc) {
      return res.status(404).json({ success: false, message: "KYC record not found" });
    }
 
    const isApproved  = kyc.status === "approved";
    const isRejected  = kyc.status === "rejected";
    const inReview    = kyc.status === "under_review";
 
    return res.status(200).json({
      success: true,
      status:  kyc.status,
      pipeline: {
        accountCreated:    "Completed",
        documentsUploaded: "Completed",
        kycVerification:   isApproved ? "Completed" : isRejected ? "Failed" : "Pending",
        walletActivated:   isApproved ? "Completed" : "Pending",
      },
    });
  } catch (err) {
    console.error("getReviewPipelineStatus error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
 
// ════════════════════════════════════════════════════════════════════════════
// SCREEN 5 — KYC APPROVED CONFIRMATION  →  GET /api/kyc/approval-confirmation
// Returns the approved KYC record so Screen 5 can show the tick + wallet info.
// ════════════════════════════════════════════════════════════════════════════
const getApprovalConfirmation = async (req, res) => {
  try {
    const kyc = await Kyc.findOne({ userId: req.userId });
 
    if (!kyc || kyc.status !== "approved") {
      return res.status(403).json({
        success: false,
        message: "KYC is not approved yet",
        status: kyc?.status ?? "not_started",
      });
    }
 
    return res.status(200).json({
      success: true,
      message: "KYC approved! Your wallet is now fully activated.",
      status: "approved",
      approvedAt: kyc.reviewedAt,
    });
  } catch (err) {
    console.error("getApprovalConfirmation error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
 
// ════════════════════════════════════════════════════════════════════════════
// SCREEN 6 — VERIFICATION FAILED  →  GET /api/kyc/rejection-details
// Returns why the KYC was rejected so Screen 6 can display the reason.
// ════════════════════════════════════════════════════════════════════════════
const getRejectionDetails = async (req, res) => {
  try {
    const kyc = await Kyc.findOne({ userId: req.userId });
 
    if (!kyc || kyc.status !== "rejected") {
      return res.status(403).json({
        success: false,
        message: "No rejection record found",
        status: kyc?.status ?? "not_started",
      });
    }
 
    return res.status(200).json({
      success: true,
      status: "rejected",
      rejectionReason: kyc.rejectionReason || "Documents could not be verified",
      submissionCount: kyc.submissionCount,
      tips: [
        "Aadhar & PAN details must match exactly",
        "Images must be clear and not cropped",
        "Do not hide or alter any part of your face",
      ],
    });
  } catch (err) {
    console.error("getRejectionDetails error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
 
// ════════════════════════════════════════════════════════════════════════════
// SCREEN 6 — RETRY KYC  →  DELETE /api/kyc/reset-and-retry
// Wipes the rejected KYC so the user can start fresh (Screen 1 again).
// ════════════════════════════════════════════════════════════════════════════
const resetAndRetry = async (req, res) => {
  try {
    const kyc = await Kyc.findOne({ userId: req.userId });
 
    if (!kyc) {
      return res.status(404).json({ success: false, message: "No KYC record found" });
    }
 
    if (kyc.status !== "rejected") {
      return res.status(400).json({
        success: false,
        message: `Cannot retry. Current status: ${kyc.status}`,
      });
    }
 
    // Store count before deleting
    const previousCount = kyc.submissionCount;
  kyc.status = "not_started";

kyc.aadharFrontUrl   = null;
kyc.panCardUrl       = null;
kyc.passportUrl      = null;
kyc.selfieUrl        = null;
// ✅ FIX: also clear bank document fields on retry
kyc.cancelChequeUrl  = null;
kyc.bankStatementUrl = null;
kyc.passbookUrl      = null;

kyc.rejectionReason = null;

await kyc.save();
 
    return res.status(200).json({
      success: true,
      message: "KYC data cleared. You may upload your documents again.",
      previousSubmissions: previousCount,
    });
  } catch (err) {
    console.error("resetAndRetry error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
 

 
module.exports = {
  // User flows
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
  
  
};
