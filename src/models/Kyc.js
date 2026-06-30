const mongoose = require("mongoose");

const kycSchema = new mongoose.Schema(
  {
    // ───────────────────────────────
    // USER REFERENCE
    // ───────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    fullName: {
      type: String,
      default: null,
    },

    // ───────────────────────────────
    // FILES (uploaded docs)
    // ───────────────────────────────
    aadharFrontUrl: {
      type: String,
      default: null,
    },

    panCardUrl: {
      type: String,
      default: null,
    },

    passportUrl: {
      type: String,
      default: null,
    },

    selfieUrl: {
      type: String,
      default: null,
    },

    // ───────────────────────────────
    // BANK DOCUMENTS
    // ───────────────────────────────
    cancelChequeUrl: {
      type: String,
      default: null,
    },

    bankStatementUrl: {
      type: String,
      default: null,
    },

    passbookUrl: {
      type: String,
      default: null,
    },

    // ───────────────────────────────
    // PIPELINE STATUS
    // ───────────────────────────────
    status: {
      type: String,
      enum: [
        "not_started",
        "documents_uploaded",
        "under_review",
        "approved",
        "rejected",
      ],
      default: "not_started",
      index: true,
    },

    // ───────────────────────────────
    // ADMIN FIELDS
    // ───────────────────────────────
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    rejectionReason: {
      type: String,
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    // ───────────────────────────────
    // TRACKING / AUDIT
    // ───────────────────────────────
    submissionCount: {
      type: Number,
      default: 1,
    },

    lastStatusChangeAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Kyc", kycSchema);