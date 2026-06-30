const multer = require("multer");
const path = require("path");
const fs = require("fs");
 
// ─── Storage: save to /uploads/kyc/<userId>/ ────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.userId ? req.userId.toString() : "anonymous";
    const dir = path.join(__dirname, "../uploads/kyc", userId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${file.fieldname}-${Date.now()}${ext}`;
    cb(null, name);
  },
});
 
// ─── Filter: images and PDFs only ───────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, PNG, WEBP, or PDF files are allowed"), false);
  }
};
 
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, 
});
 
// ─── Named field sets per document type ─────────────────────────────────────
 
// In kycUpload.js

/** Screen 1 — Aadhar: front only + selfie (NO back) */
const uploadAadhar = upload.fields([
  { name: "aadharFront", maxCount: 1 },
  { name: "selfie", maxCount: 1 },
  
]);

/** Screen 2 — PAN Card: card image only */
const uploadPan = upload.fields([
  { name: "panCard", maxCount: 1 },
]);

/** Screen 3 — Passport: passport image only */
const uploadPassbook = upload.fields([
  { name: "passbook", maxCount: 1 },
]);
 const uploadPassport = upload.fields([
  { name: "passport", maxCount: 1 },
]);
const uploadStatement = upload.fields([
  { name: "statement", maxCount: 1 },
]);
const uploadCheque = upload.fields([
  { name: "cheque", maxCount: 1 },
]);
module.exports = { uploadAadhar, uploadPan, uploadPassport,uploadCheque,uploadPassbook,uploadStatement};
 