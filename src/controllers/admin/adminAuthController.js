const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
 
const User = require("../models/User");
const BankDetails = require("../models/Bank");
const Wallet = require("../models/Wallet");
 
// Valid adminRole values for sub-admins (super_admin is env-var only, never stored via API)
const VALID_ADMIN_ROLES = [
  "kyc_admin",
  "operations_admin",
  "support_admin",
];
 
// ════════════════════════════════════════════════════════════════════════════
// ADMIN LOGIN
// POST /api/admin/auth/login
// ════════════════════════════════════════════════════════════════════════════
 
const adminLogin = async (req, res) => {
  try {
    const { mobile, email, password } = req.body;
 
    if (!password || (!mobile && !email)) {
      return res.status(400).json({
        success: false,
        message: "Password and mobile or email are required",
      });
    }
 
    // ── SUPER ADMIN LOGIN ────────────────────────────────────────────────────
    if (
      email === process.env.ADMIN_EMAIL &&
      password === process.env.ADMIN_PASSWORD
    ) {
      console.log("✅ Super admin login successful");
 
      const token = jwt.sign(
        {
          id: "super_admin",
          role: "admin",
          superAdmin: true,
          adminRole: "super_admin",
          email: process.env.ADMIN_EMAIL,
        },
        process.env.JWT_SECRET || "mysecretkey",
        { expiresIn: "12h" }
      );
 
      return res.status(200).json({
        success: true,
        message: "Super admin login successful",
        token,
        admin: {
          name: "Super Admin",
          role: "admin",
          superAdmin: true,
          adminRole: "super_admin",
        },
      });
    }
 
    // ── FIND USER ────────────────────────────────────────────────────────────
    const user = await User.findOne(mobile ? { mobile } : { email });
 
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with these credentials",
      });
    }
 
    // ── CHECK ADMIN ROLE ─────────────────────────────────────────────────────
    if (user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. This account does not have admin privileges.",
      });
    }
 
    // ── CHECK PASSWORD ───────────────────────────────────────────────────────
    const isMatch = await bcrypt.compare(password, user.password);
 
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password",
      });
    }
 
    // ── GENERATE TOKEN ───────────────────────────────────────────────────────
    const token = jwt.sign(
      {
        id: user._id,
        role: "admin",
        adminRole: user.adminRole,
      },
      process.env.JWT_SECRET || "mysecretkey",
      { expiresIn: "12h" }
    );
 
    return res.status(200).json({
      success: true,
      message: "Admin login successful",
      token,
      admin: {
        _id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        adminRole: user.adminRole,
      },
    });
  } catch (err) {
    console.error("adminLogin error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
 
// ════════════════════════════════════════════════════════════════════════════
// CREATE SUB ADMIN
// POST /api/admin/auth/create-admin
// Protected: requireRole("super_admin")
// ════════════════════════════════════════════════════════════════════════════
 
const createSubAdmin = async (req, res) => {
  try {
    const { name, mobile, email, password, adminRole } = req.body;
 
    if (!name || !mobile || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "name, mobile, email, and password are all required",
      });
    }
 
    // ── VALIDATE adminRole ───────────────────────────────────────────────────
    if (!adminRole) {
      return res.status(400).json({
        success: false,
        message: `adminRole is required. Must be one of: ${VALID_ADMIN_ROLES.join(", ")}`,
      });
    }
 
    if (!VALID_ADMIN_ROLES.includes(adminRole)) {
      return res.status(400).json({
        success: false,
        message: `Invalid adminRole "${adminRole}". Must be one of: ${VALID_ADMIN_ROLES.join(", ")}`,
      });
    }
 
    // ── CHECK EXISTING USER ──────────────────────────────────────────────────
    const existing = await User.findOne({
      $or: [{ mobile }, { email }],
    });
 
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "An account with this mobile or email already exists",
      });
    }
 
    // ── PASSWORD CHECK ───────────────────────────────────────────────────────
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }
 
    const hashedPassword = await bcrypt.hash(password, 10);
 
    const newAdmin = await User.create({
      name,
      mobile,
      email,
      password: hashedPassword,
      role: "admin",
      adminRole,
    });
 
    return res.status(201).json({
      success: true,
      message: "New admin account created successfully",
      admin: {
        _id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        mobile: newAdmin.mobile,
        role: newAdmin.role,
        adminRole: newAdmin.adminRole,
      },
    });
  } catch (err) {
    console.error("createSubAdmin error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
 
// ════════════════════════════════════════════════════════════════════════════
// GET ALL ADMINS
// GET /api/admin/auth/all-admins
// Protected: requireRole("super_admin")
// ════════════════════════════════════════════════════════════════════════════
 
const getAllAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: "admin" })
      .select("_id name email mobile createdAt role adminRole")
      .sort({ createdAt: -1 });
 
    return res.status(200).json({
      success: true,
      count: admins.length,
      admins,
    });
  } catch (err) {
    console.error("getAllAdmins error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
 
// ════════════════════════════════════════════════════════════════════════════
// REVOKE ADMIN ACCESS (DELETE)
// PATCH /api/admin/auth/revoke-admin/:userId
// Protected: requireRole("super_admin")
// ════════════════════════════════════════════════════════════════════════════
 
const revokeAdminAccess = async (req, res) => {
  try {
    const { userId } = req.params;
 
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
 
    if (user.role !== "admin") {
      return res.status(400).json({ success: false, message: "This user is not an admin" });
    }
 
    await User.findByIdAndDelete(userId);
 
    return res.status(200).json({
      success: true,
      message: `Admin account for ${user.name} has been deleted`,
    });
  } catch (err) {
    console.error("revokeAdminAccess error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
 
// ════════════════════════════════════════════════════════════════════════════
// CHANGE ADMIN PASSWORD
// PATCH /api/admin/auth/change-password
// Protected: all admins
// ════════════════════════════════════════════════════════════════════════════
 
const changeAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
 
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "currentPassword and newPassword are required",
      });
    }
 
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
    }
 
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
 
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }
 
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
 
    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (err) {
    console.error("changeAdminPassword error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
 
// ════════════════════════════════════════════════════════════════════════════
// UPDATE ADMIN ROLE
// PATCH /api/admin/auth/update-admin-role/:userId
// Protected: requireRole("super_admin")
// ════════════════════════════════════════════════════════════════════════════
 
const updateAdminRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { adminRole } = req.body;
 
    if (!adminRole || !VALID_ADMIN_ROLES.includes(adminRole)) {
      return res.status(400).json({
        success: false,
        message: `Invalid adminRole. Must be one of: ${VALID_ADMIN_ROLES.join(", ")}`,
      });
    }
 
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
 
    if (user.role !== "admin") {
      return res.status(400).json({ success: false, message: "This user is not an admin" });
    }
 
    user.adminRole = adminRole;
    await user.save();
 
    return res.status(200).json({
      success: true,
      message: `Role updated to "${adminRole}" for ${user.name}`,
      admin: {
        _id: user._id,
        name: user.name,
        email: user.email,
        adminRole: user.adminRole,
      },
    });
  } catch (err) {
    console.error("updateAdminRole error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
 
// ════════════════════════════════════════════════════════════════════════════
// GET ALL USERS
// GET /api/admin/auth/users
// Protected: requireRole("super_admin", "operations_admin", "support_admin")
// ════════════════════════════════════════════════════════════════════════════
 
const getAllUsers = async (req, res) => {
  try {
    // FIX: User model has no walletBalance field — balance lives in Wallet model as `balance`
    const users = await User.find({})
      .select("_id name email mobile kycVerified createdAt role")
      .sort({ createdAt: -1 });

    const usersWithDetails = await Promise.all(
      users.map(async (user) => {
        const [bankDetails, wallet] = await Promise.all([
          BankDetails.findOne({ userId: user._id }).select(
            "accountHolderName bankName accountNumber ifscCode accountType isTpinCreated"
          ),
          Wallet.findOne({ userId: user._id }).select("balance walletAddress"),
        ]);

        return {
          _id: user._id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          kycVerified: user.kycVerified,
          walletBalance: wallet ? wallet.balance : 0,   // real balance from Wallet model
          walletAddress: wallet ? wallet.walletAddress : null,
          createdAt: user.createdAt,
          role: user.role,
          bankDetails: bankDetails || null,
        };
      })
    );

    const total = users.length;
    const verified = users.filter((u) => u.kycVerified === true).length;
    const pending = users.filter((u) => !u.kycVerified).length;

    return res.status(200).json({
      success: true,
      total,
      verified,
      pending,
      users: usersWithDetails,
    });
  } catch (err) {
    console.error("getAllUsers error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
 
// ════════════════════════════════════════════════════════════════════════════
// GET USER BANK DETAILS
// GET /api/admin/auth/user-bank-details/:userId
// Protected: requireRole("super_admin", "support_admin")
// ════════════════════════════════════════════════════════════════════════════
 
const getUserBankDetails = async (req, res) => {
  try {
    const { userId } = req.params;
 
    const bankDetails = await BankDetails.findOne({ userId });
 
    if (!bankDetails) {
      return res.status(404).json({
        success: false,
        message: "Bank details not found",
      });
    }
 
    return res.status(200).json({
      success: true,
      bankDetails,
    });
  } catch (err) {
    console.error("getUserBankDetails error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
 
module.exports = {
  adminLogin,
  createSubAdmin,
  getAllAdmins,
  revokeAdminAccess,
  changeAdminPassword,
  updateAdminRole,
  getAllUsers,
  getUserBankDetails,
};