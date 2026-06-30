const Wallet = require("../models/Wallet");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { generateWalletAddress, generateQR } = require("../utils/helpers");
const bcrypt = require("bcrypt");
const QRCode = require("qrcode");
const { v4: uuidv4 } = require("uuid");
const Recent = require("../models/Recents");
const Bank = require("../models/Bank");
const Notification = require("../models/Notification");
const { sendNotification } = require("../utils/notify");

// ================= CREATE =================
exports.createNotification = async (req, res) => {
  try {
    const { title, message, type } = req.body;

    const notification = await Notification.create({
      userId: req.userId,
      title,
      message,
      type
    });

    res.json({
      message: "Notification created",
      notification
    });

  } catch (err) {
    console.log("Notification error:", err);
    res.status(500).json({ message: "Error creating notification" });
  }
};


// ================= GET ALL =================
exports.getAllNotifications = async (req, res) => {
  try {
    const data = await Notification.find({
      userId: req.userId
    }).sort({ createdAt: -1 });

    const formatted = data.map(n => ({
  _id: n._id,
  title: n.title,
  message: n.message,
  date: n.createdAt,
  read: n.isRead   
}));

res.json(formatted);

  } catch (err) {
    res.status(500).json({ message: "Error fetching notifications" });
  }
};


// ================= MARK ONE =================
exports.markOneAsRead = async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, {
      isRead: true
    });

    res.json({ message: "Marked as read" });

  } catch (err) {
    res.status(500).json({ message: "Error updating" });
  }
};


// ================= MARK ALL =================
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.userId, isRead: false },
      { isRead: true }
    );

    res.json({ message: "All marked as read" });

  } catch (err) {
    res.status(500).json({ message: "Error updating" });
  }
};


// ================= UNREAD COUNT =================
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.userId,
      isRead: false
    });

    res.json({ count });

  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
};

