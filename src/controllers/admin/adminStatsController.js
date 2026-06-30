const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const User = require("../models/User");

const REFERRAL_BONUS = 50;

// ════════════════════════════════════════════════════════════════════════════
// EXISTING — GET DASHBOARD WIDGET STATS
// GET /api/admin/stats/widgets
// ════════════════════════════════════════════════════════════════════════════
const getWidgetStats = async (req, res) => {
  try {
    const [totalTransactions, circulationResult, referredUsersCount] =
      await Promise.all([
        Transaction.countDocuments({}),
        Wallet.aggregate([{ $group: { _id: null, total: { $sum: "$balance" } } }]),
        User.countDocuments({ referredBy: { $exists: true, $ne: null } }),
      ]);

    return res.status(200).json({
      success: true,
      totalTransactions,
      payoInCirculation: circulationResult[0]?.total ?? 0,
      referralRewardsDistributed: referredUsersCount * REFERRAL_BONUS,
    });
  } catch (err) {
    console.error("getWidgetStats error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// REFERRAL MANAGEMENT PAGE
// GET /api/admin/stats/referrals
// Query params: page, limit, search
// ════════════════════════════════════════════════════════════════════════════
const getReferralManagement = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 20);
    const search = (req.query.search || "").trim();
    const skip = (page - 1) * limit;


    
    const searchMatch = search
      ? {
          $or: [
            { "referrerDoc.name":  { $regex: search, $options: "i" } },
            { "referrerDoc.email": { $regex: search, $options: "i" } },
            { name:                { $regex: search, $options: "i" } },
            { email:               { $regex: search, $options: "i" } },
          ],
        }
      : null;

    const pipeline = [
      { $match: { referredBy: { $exists: true, $ne: null } } },
      {
        $lookup: {
          from:         "users",
          localField:   "referredBy",
          foreignField: "myReferralCode",
          as:           "referrerDoc",
        },
      },
      { $unwind: { path: "$referrerDoc", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from:         "wallets",
          localField:   "_id",
          foreignField: "userId",
          as:           "walletDoc",
        },
      },
      { $unwind: { path: "$walletDoc", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "transactions",
          let:  { addr: "$walletDoc.walletAddress" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$senderWallet", "$$addr"] },
                status: "success",
              },
            },
            { $limit: 1 },
          ],
          as: "successTxn",
        },
      },
      ...(searchMatch ? [{ $match: searchMatch }] : []),
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 0,
                referrer: {
                  $cond: {
                    if: "$referrerDoc",
                    then: {
                      name:         "$referrerDoc.name",
                      email:        "$referrerDoc.email",
                      mobile:       "$referrerDoc.mobile",
                      referralCode: "$referrerDoc.myReferralCode",
                    },
                    else: null,
                  },
                },
                referredUser: {
                  name:     "$name",
                  email:    "$email",
                  mobile:   "$mobile",
                  joinedAt: "$createdAt",
                },
                rewardAmount: { $literal: REFERRAL_BONUS },
                rewardStatus: {
                  $cond: {
                    if:   { $gt: [{ $size: "$successTxn" }, 0] },
                    then: "paid",
                    else: "pending",
                  },
                },
              },
            },
          ],
        },
      },
    ];

    const topReferrersPipeline = [
      { $match: { referredBy: { $exists: true, $ne: null } } },
      {
        $lookup: {
          from:         "users",
          localField:   "referredBy",
          foreignField: "myReferralCode",
          as:           "referrerDoc",
        },
      },
      { $unwind: "$referrerDoc" },
      {
        $lookup: {
          from: "transactions",
          let:  { uid: "$_id" },
          pipeline: [
            {
              $lookup: {
                from:         "wallets",
                localField:   "senderWallet",
                foreignField: "walletAddress",
                as:           "walletDoc",
              },
            },
            { $unwind: "$walletDoc" },
            {
              $match: {
                $expr:  { $eq: ["$walletDoc.userId", "$$uid"] },
                status: "success",
              },
            },
            { $limit: 1 },
          ],
          as: "successTxn",
        },
      },
      {
        $group: {
          _id:            "$referrerDoc._id",
          name:           { $first: "$referrerDoc.name" },
          email:          { $first: "$referrerDoc.email" },
          mobile:         { $first: "$referrerDoc.mobile" },
          referralCode:   { $first: "$referrerDoc.myReferralCode" },
          totalReferrals: { $sum: 1 },
          paidCount: {
            $sum: { $cond: [{ $gt: [{ $size: "$successTxn" }, 0] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          name: 1, email: 1, mobile: 1, referralCode: 1,
          totalReferrals: 1,
          totalEarnings: { $multiply: ["$paidCount", REFERRAL_BONUS] },
        },
      },
      { $sort: { totalReferrals: -1 } },
      { $limit: 5 },
    ];

    const [
      [facetResult],
      totalReferrals,
      topReferrers,
    ] = await Promise.all([
      User.aggregate(pipeline),
      User.countDocuments({ referredBy: { $exists: true, $ne: null } }),
      User.aggregate(topReferrersPipeline),
    ]);

    const filteredTotal = facetResult.metadata[0]?.total ?? 0;

    return res.status(200).json({
      success: true,
      summary: {
        totalReferrals,
        totalRewardsDistributed: totalReferrals * REFERRAL_BONUS,
        topReferrers,
      },
      total:      filteredTotal,
      page,
      totalPages: Math.ceil(filteredTotal / limit),
      referrals:  facetResult.data,
    });
  } catch (err) {
    console.error("getReferralManagement error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// TRANSACTION MONITORING PAGE
// GET /api/admin/stats/transactions
// Query params: page, limit, status, search, dateFilter
// ════════════════════════════════════════════════════════════════════════════
const getTransactionMonitoring = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 20);
    const { status, search = "", dateFilter } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};

    if (status && ["pending", "success", "failed"].includes(status)) {
      filter.status = status;
    }

    if (dateFilter) {
      const now = new Date();
      const offsets = { today: 0, week: 7, month: 30 };
      if (dateFilter in offsets) {
        const start = new Date(now);
        if (dateFilter === "today") {
          start.setHours(0, 0, 0, 0);
        } else {
          start.setDate(now.getDate() - offsets[dateFilter]);
        }
        filter.createdAt = { $gte: start };
      }
    }

    if (search.trim()) {
      filter.$or = [
        { transactionId:  { $regex: search, $options: "i" } },
        { senderWallet:   { $regex: search, $options: "i" } },
        { receiverWallet: { $regex: search, $options: "i" } },
      ];
    }

    const [summaryResults, transactions, filteredTotal] = await Promise.all([
      Transaction.aggregate([
        {
          $facet: {
            counts: [
              {
                $group: {
                  _id:    "$status",
                  count:  { $sum: 1 },
                  volume: { $sum: { $cond: [{ $eq: ["$status", "success"] }, "$amount", 0] } },
                },
              },
            ],
            total: [{ $count: "n" }],
          },
        },
      ]),
      Transaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    const counts = summaryResults[0].counts.reduce(
      (acc, row) => {
        acc[row._id] = row.count;
        if (row._id === "success") acc.totalVolume = row.volume;
        return acc;
      },
      { success: 0, pending: 0, failed: 0, totalVolume: 0 }
    );
    const totalTransactions = summaryResults[0].total[0]?.n ?? 0;
    const successRate =
      totalTransactions > 0
        ? ((counts.success / totalTransactions) * 100).toFixed(1)
        : "0.0";

    const walletAddresses = [
      ...new Set(
        transactions.flatMap((t) =>
          [t.senderWallet, t.receiverWallet].filter(
            (w) => w && w !== "REFERRAL_BONUS"
          )
        )
      ),
    ];

    const wallets = await Wallet.find({
      walletAddress: { $in: walletAddresses },
    })
      .select("walletAddress userId")
      .lean();

    const userIds = [...new Set(wallets.map((w) => w.userId.toString()))];
    const users   = await User.find({ _id: { $in: userIds } })
      .select("_id name")
      .lean();

    const userMap   = Object.fromEntries(users.map((u) => [u._id.toString(), u.name]));
    const walletMap = Object.fromEntries(
      wallets.map((w) => [w.walletAddress, userMap[w.userId.toString()] ?? null])
    );

    const formatted = transactions.map((txn) => ({
      transactionId:  txn.transactionId,
      senderWallet:   txn.senderWallet,
      receiverWallet: txn.receiverWallet,
      senderName:     txn.senderWallet !== "REFERRAL_BONUS"
                        ? (walletMap[txn.senderWallet] ?? null)
                        : null,
      receiverName:   walletMap[txn.receiverWallet] ?? null,
      amount:         txn.amount,
      status:         txn.status,
      failureReason:  txn.failureReason ?? null,
      createdAt:      txn.createdAt,
    }));

    return res.status(200).json({
      success: true,
      summary: {
        totalTransactions,
        successCount:  counts.success,
        pendingCount:  counts.pending,
        failedCount:   counts.failed,
        totalVolume:   counts.totalVolume,
        successRate:   `${successRate}%`,
      },
      total:        filteredTotal,
      page,
      totalPages:   Math.ceil(filteredTotal / limit),
      transactions: formatted,
    });
  } catch (err) {
    console.error("getTransactionMonitoring error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// TRANSACTION DETAILS
// GET /api/admin/stats/transactions/:transactionId
// ════════════════════════════════════════════════════════════════════════════
const getTransactionDetails = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const txn = await Transaction.findOne({ transactionId }).lean();

    if (!txn) {
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found" });
    }

    const addresses = [txn.senderWallet, txn.receiverWallet].filter(
      (w) => w && w !== "REFERRAL_BONUS"
    );

    const wallets = await Wallet.find({ walletAddress: { $in: addresses } })
      .select("walletAddress userId")
      .lean();

    const userIds = wallets.map((w) => w.userId);
    const users   = await User.find({ _id: { $in: userIds } })
      .select("_id name email mobile")
      .lean();

    const userMap   = Object.fromEntries(users.map((u) => [u._id.toString(), u]));
    const walletMap = Object.fromEntries(
      wallets.map((w) => [w.walletAddress, userMap[w.userId.toString()] ?? null])
    );

    const toParty = (addr) => {
      const u = walletMap[addr];
      return u ? { name: u.name, email: u.email, mobile: u.mobile } : null;
    };

    const blockchainHash =
      "0x" +
      Buffer.from(txn.transactionId)
        .toString("hex")
        .padEnd(64, "0")
        .slice(0, 64);

    return res.status(200).json({
      success: true,
      transaction: {
        transactionId:  txn.transactionId,
        blockchainHash,
        amount:         txn.amount,
        status:         txn.status,
        failureReason:  txn.failureReason ?? null,
        createdAt:      txn.createdAt,
        senderWallet:   txn.senderWallet,
        receiverWallet: txn.receiverWallet,
        sender:         txn.senderWallet !== "REFERRAL_BONUS"
                          ? toParty(txn.senderWallet)
                          : null,
        receiver:       toParty(txn.receiverWallet),
      },
    });
  } catch (err) {
    console.error("getTransactionDetails error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getWidgetStats,
  getReferralManagement,
  getTransactionMonitoring,
  getTransactionDetails,
};