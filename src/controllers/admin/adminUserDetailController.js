const mongoose = require("mongoose");

const Kyc         = require("../models/Kyc");
const User        = require("../models/User");
const Transaction = require("../models/Transaction");
const Wallet      = require("../models/Wallet");

// ════════════════════════════════════════════════════════════════════════════
// HELPER — convert stored file path → public URL
// ════════════════════════════════════════════════════════════════════════════
function buildFileUrl(req, filePath) {
  if (!filePath) return null;
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }
  const relativePart = filePath.replace(/^uploads[\\/]/, "");
  return `${req.protocol}://${req.get("host")}/kyc-docs/${relativePart}`;
}

// ════════════════════════════════════════════════════════════════════════════
// GET USER KYC DOCUMENTS
// GET /api/admin/user-details/:userId/kyc
// Protected: super_admin | kyc_admin | support_admin
// ════════════════════════════════════════════════════════════════════════════
const getUserKycDocs = async (req, res) => {
  try {
    const { userId } = req.params;

    const kyc = await Kyc.findOne({ userId });

    if (!kyc) {
      return res.status(200).json({
        success: true,
        found: false,
        message: "No KYC record found for this user",
        kyc: null,
      });
    }

    return res.status(200).json({
      success: true,
      found: true,
      kyc: {
        status:             kyc.status,
        fullName:           kyc.fullName           || null,
        submissionCount:    kyc.submissionCount,
        rejectionReason:    kyc.rejectionReason    || null,
        reviewedAt:         kyc.reviewedAt         || null,
        lastStatusChangeAt: kyc.lastStatusChangeAt || null,
        submittedAt:        kyc.createdAt,

        // Identity documents
        selfie:      buildFileUrl(req, kyc.selfieUrl),
        aadharFront: buildFileUrl(req, kyc.aadharFrontUrl),
        panCard:     buildFileUrl(req, kyc.panCardUrl),
        passport:    buildFileUrl(req, kyc.passportUrl),

        // Bank documents
        cancelCheque:  buildFileUrl(req, kyc.cancelChequeUrl),
        bankStatement: buildFileUrl(req, kyc.bankStatementUrl),
        passbook:      buildFileUrl(req, kyc.passbookUrl),
      },
    });
  } catch (err) {
    console.error("getUserKycDocs error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// GET USER TRANSACTION HISTORY
// GET /api/admin/user-details/:userId/transactions?page=1&limit=20&status=
// Protected: super_admin | operations_admin | support_admin
// ════════════════════════════════════════════════════════════════════════════
const getUserTransactions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    // ── 1. Look up this user's wallet address ────────────────────────────
    const userWallet = await Wallet.findOne({ userId }).lean();
    const walletAddress = userWallet?.walletAddress || null;

    // ── 2. Build filter: user is sender (userId) OR receiver (receiverWallet)
    const orConditions = [{ userId }];
    if (walletAddress) {
      orConditions.push({ receiverWallet: walletAddress });
    }

    const filter = { $or: orConditions };

    if (status && ["pending", "success", "failed"].includes(status)) {
      filter.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    // ── 3. Resolve sender and receiver display names ─────────────────────
    const list = await Promise.all(
      transactions.map(async (txn) => {
        let senderName   = null;
        let receiverName = null;

        // Sender
        if (txn.senderWallet === "REFERRAL_BONUS") {
          senderName = "Referral Bonus";
        } else if (txn.senderWallet) {
          const sw = await Wallet.findOne({ walletAddress: txn.senderWallet }).lean();
          if (sw) {
            const su = await User.findById(sw.userId).select("name mobile").lean();
            senderName = su ? (su.name || su.mobile) : null;
          }
        }

        // Receiver
        if (txn.receiverWallet) {
          const rw = await Wallet.findOne({ walletAddress: txn.receiverWallet }).lean();
          if (rw) {
            const ru = await User.findById(rw.userId).select("name mobile").lean();
            receiverName = ru ? (ru.name || ru.mobile) : null;
          }
        }

        return {
          transactionId:  txn.transactionId,
          amount:         txn.amount,
          status:         txn.status,
          failureReason:  txn.failureReason || null,
          senderWallet:   txn.senderWallet,
          receiverWallet: txn.receiverWallet,
          senderName,
          receiverName,
          // "sent" if this user initiated it, "received" if they were the receiver
          direction: txn.userId?.toString() === userId ? "sent" : "received",
          createdAt: txn.createdAt,
        };
      })
    );

    // ── 4. Summary counts (covers both sent and received) ────────────────
    const summaryFilter = walletAddress
      ? {
          $or: [
            { userId: new mongoose.Types.ObjectId(userId) },
            { receiverWallet: walletAddress },
          ],
        }
      : { userId: new mongoose.Types.ObjectId(userId) };

    const [successCount, failedCount, pendingCount, sentAgg] = await Promise.all([
      Transaction.countDocuments({ ...summaryFilter, status: "success" }),
      Transaction.countDocuments({ ...summaryFilter, status: "failed" }),
      Transaction.countDocuments({ ...summaryFilter, status: "pending" }),
      // totalSent = only transactions the user initiated (not received)
      Transaction.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            status: "success",
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      total,
      page:       parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      summary: {
        total,
        successCount,
        failedCount,
        pendingCount,
        totalSent: sentAgg[0]?.total || 0,
      },
      transactions: list,
    });
  } catch (err) {
    console.error("getUserTransactions error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// GET USER REFERRAL DETAILS
// GET /api/admin/user-details/:userId/referral
// Protected: super_admin | operations_admin | support_admin
// ════════════════════════════════════════════════════════════════════════════
const getUserReferralDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select("name mobile myReferralCode referredBy referralcode")
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const myReferralCode = user.myReferralCode || user.referralcode || null;

    // Who referred this user
    let referredByUser = null;
    if (user.referredBy) {
      const referrer = await User.findOne({
        $or: [
          { myReferralCode: user.referredBy },
          { referralcode:   user.referredBy },
        ],
      }).select("name mobile myReferralCode referralcode").lean();

      if (referrer) {
        referredByUser = {
          name:         referrer.name   || null,
          mobile:       referrer.mobile || null,
          referralCode: referrer.myReferralCode || referrer.referralcode || null,
        };
      }
    }

    // All users this user referred
    const referredUsers = myReferralCode
      ? await User.find({ referredBy: myReferralCode })
          .select("name mobile createdAt")
          .sort({ createdAt: -1 })
          .lean()
      : [];

    // Referral earnings (bonus transactions credited to this user)
    const earningsAgg = await Transaction.aggregate([
      {
        $match: {
          userId:       new mongoose.Types.ObjectId(userId),
          senderWallet: "REFERRAL_BONUS",
          status:       "success",
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    return res.status(200).json({
      success: true,
      referral: {
        myReferralCode,
        referredByCode: user.referredBy || null,
        referredByUser,
        totalReferrals:   referredUsers.length,
        referralEarnings: earningsAgg[0]?.total || 0,
        referredUsers: referredUsers.map((u) => ({
          name:     u.name   || null,
          mobile:   u.mobile || null,
          joinedAt: u.createdAt,
        })),
      },
    });
  } catch (err) {
    console.error("getUserReferralDetails error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getUserKycDocs,
  getUserTransactions,
  getUserReferralDetails,
};