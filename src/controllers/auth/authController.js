const bcrypt = require("bcrypt");
const jwt    = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const User        = require("../models/User");
const Otp         = require("../models/Otp");
const Wallet      = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const Kyc         = require("../models/Kyc");           // ← NEW
const { sendNotification } = require("../utils/notify");
const { generateWalletAddress, generateQR } = require("../utils/helpers");

// ======================register========================
exports.register = async (req, res) => {
  try {
    const { name, email, password, confirmpassword, referralCode } = req.body;

    // ── Token ──────────────────────────────────────────────
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token or invalid format" });
    }
    const token   = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, "mysecretkey");
    const mobile  = decoded.mobile;

    if (!mobile) {
      return res.status(400).json({ message: "Mobile missing" });
    }

    // ── Validations ────────────────────────────────────────
    if (!name || !email || !password || !confirmpassword) {
      return res.status(400).json({ message: "All fields required" });
    }

    if (typeof name !== "string" || name.trim().length < 3) {
      return res.status(400).json({ message: "Name must contain minimum 3 characters" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format. Example: user@gmail.com" });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message: "Use 8+ chars with uppercase, lowercase, number & special character",
      });
    }

    if (password !== confirmpassword) {
      return res.status(400).json({ message: "Passwords mismatch" });
    }

    const existEmail = await User.findOne({ email });
    if (existEmail) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const existMobile = await User.findOne({ mobile });
    if (existMobile) {
      return res.status(400).json({ message: "Mobile number already exists" });
    }

    const otpRecord = await Otp.findOne({ mobile, isVerified: true });
    if (!otpRecord) {
      return res.status(400).json({ message: "OTP not verified" });
    }

    // ── Referral check ─────────────────────────────────────
    let referrer = null;
    if (referralCode) {
      referrer = await User.findOne({ myReferralCode: referralCode });
      if (!referrer) {
        return res.status(400).json({ message: "Invalid referral code" });
      }
    }

    // ── Create user ────────────────────────────────────────
    const hash       = await bcrypt.hash(password, 10);
    const myReferral = "PAYO" + uuidv4().slice(0, 6);

    const user = await User.create({
      name,
      email,
      password: hash,
      mobile,
      referredBy:      referralCode || null,
      myReferralCode:  myReferral,
      isVerified:      true,
      // KYC starts as false — only true after admin approves
      kycVerified:     false,
      walletActivated: false,
    });

    await sendNotification({
      userId:  user._id,
      title:   "Welcome to PAYO",
      message: "Please complete KYC to activate your wallet",
      type:    "SYSTEM",
    });

    // ── Create wallet ──────────────────────────────────────
    const walletAddress = generateWalletAddress();
    const qr            = await generateQR(walletAddress);

    const wallet = await Wallet.create({
      userId:        user._id,
      walletAddress: generateWalletAddress(),
      addressExpiry: Date.now() + 60 * 60 * 1000,
      qrToken:       uuidv4(),
      qrExpiry:      Date.now() + 15 * 60 * 1000,
    });

    await User.findByIdAndUpdate(user._id, { walletId: wallet._id });

    // ── Referral bonus ─────────────────────────────────────
    const REFERRAL_BONUS = 50;
    if (referralCode && referrer) {
      if (referrer._id.toString() === user._id.toString()) {
        return res.status(400).json({ message: "You cannot refer yourself" });
      }

      const referrerWallet = await Wallet.findOne({ userId: referrer._id });
      if (!referrerWallet) {
        return res.status(404).json({ message: "Referrer wallet not found" });
      }

      referrerWallet.balance += REFERRAL_BONUS;
      await referrerWallet.save();

      await Transaction.create({
        userId:  referrer._id,
        amount:  REFERRAL_BONUS,
        type:    "credit",
        message: "Referral bonus received",
      });

      await sendNotification({
        userId:  referrer._id,
        title:   "Referral Reward",
        message: `You earned ${REFERRAL_BONUS} PAYO`,
        type:    "REWARD",
      });
    }

    // ── Cleanup ────────────────────────────────────────────
    await Otp.deleteOne({ mobile });

    // ── Response ───────────────────────────────────────────
    res.status(201).json({
      message:        "Registered successfully. Please complete KYC to access the app.",
      myReferralCode: user.myReferralCode,
      kycRequired:    true,         // ← tells the app to go to KYC screen
      wallet: {
        walletAddress: wallet.walletAddress,
        balance:       wallet.balance,
      },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// ======================login========================
// ── KEY CHANGE: checks KYC status and tells app where to send user ──────────
exports.login = async (req, res) => {
  try {
    const { email, mobile, password } = req.body;

    // find user
    const user = email
      ? await User.findOne({ email })
      : await User.findOne({ mobile });

    if (!user) return res.status(400).json({ message: "User not found" });

    // check password
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Wrong password" });

    // ── KYC STATUS CHECK ──────────────────────────────────────────────────
    // Check KYC record to know the exact status
    const kyc = await Kyc.findOne({ userId: user._id });

    const kycStatus = kyc ? kyc.status : "not_started";

    // Block login ONLY if KYC was rejected (they must retry)
    // Allow login for not_started, documents_uploaded, under_review, approved
    if (kycStatus === "rejected") {
      return res.status(403).json({
        message:   "Your KYC verification failed. Please retry.",
        kycStatus: "rejected",
        action:    "retry_kyc",  // tells app to show retry screen
      });
    }

    // generate token
    const token = jwt.sign(
      { id: user._id, mobile: user.mobile },
      "mysecretkey",
      { expiresIn: "24h" } 
    );

    await sendNotification({
      userId:  user._id,
      title:   "Login Alert",
      message: "You logged into your account",
      type:    "SECURITY",
    });

    // ── Tell the app exactly where to navigate ────────────────────────────
    let redirectTo = "home"; // default — KYC approved, full access

    if (kycStatus === "not_started") {
      redirectTo = "kyc_upload";      // → go to Screen 1 (upload docs)
    } else if (kycStatus === "documents_uploaded" || kycStatus === "under_review") {
      redirectTo = "kyc_under_review"; // → go to Screen 4 (waiting)
    } else if (kycStatus === "approved") {
      redirectTo = "home";             // → full app access
    }

    res.json({
      message:   "Login success",
      token,
      kycStatus,
      redirectTo,  // ← front-end uses this to navigate to correct screen
      user: {
        id:              user._id,
        name:            user.name,
        email:           user.email,
        mobile:          user.mobile,
        kycVerified:     user.kycVerified,
        walletActivated: user.walletActivated,
      },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ======================verify login otp========================
exports.verifyLoginOtp = async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    const record = await Otp.findOne({ mobile });
    if (!record) return res.status(400).json({ message: "OTP not found" });

    if (record.expiresAt < Date.now()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    const isMatch = await bcrypt.compare(otp, record.otp);
    if (!isMatch) return res.status(400).json({ message: "Invalid OTP" });

    const user = await User.findOne({ mobile });
    if (!user) return res.status(400).json({ message: "User not found" });

    // ── Same KYC check as normal login ────────────────────────────────────
    const kyc       = await Kyc.findOne({ userId: user._id });
    const kycStatus = kyc ? kyc.status : "not_started";

    if (kycStatus === "rejected") {
      return res.status(403).json({
        message:   "Your KYC verification failed. Please retry.",
        kycStatus: "rejected",
        action:    "retry_kyc",
      });
    }

    const token = jwt.sign(
      { id: user._id, mobile: user.mobile },
      "mysecretkey",
      { expiresIn: "24h" }
    );

    await Otp.deleteOne({ mobile });

    let redirectTo = "home";
    if (kycStatus === "not_started")                                      redirectTo = "kyc_upload";
    else if (kycStatus === "documents_uploaded" || kycStatus === "under_review") redirectTo = "kyc_under_review";
    else if (kycStatus === "approved")                                    redirectTo = "home";

    res.json({
      message: "Login success via OTP",
      token,
      kycStatus,
      redirectTo,
    });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ======================resend otp========================
exports.resendOtp = async (req, res) => {
  const { mobile } = req.body;

  const record = await Otp.findOne({ mobile });
  if (!record) return res.status(400).json({ message: "Please request OTP first" });

  const now = Date.now();
  if (record.expiresAt > now) {
    return res.status(400).json({ message: "OTP still valid. Please wait before resending" });
  }

  const otp       = Math.floor(1000 + Math.random() * 9000).toString();
  const hashedOtp = await bcrypt.hash(otp, 10);

  record.otp        = hashedOtp;
  record.isVerified = false;
  record.expiresAt  = now + 2 * 60 * 1000;
  await record.save();

  console.log("New OTP:", otp);
  res.json({ message: "OTP resent", otp });
};

// ====================verify otp========================
exports.verifyOtp = async (req, res) => {
  try {
    const { mobile, otp } = req.body;
    const record = await Otp.findOne({ mobile });

    if (!record || !record.otp) return res.status(400).json({ message: "OTP not found" });
    if (record.expiresAt < Date.now()) return res.status(400).json({ message: "Expired OTP" });

    const isMatch = await bcrypt.compare(String(otp).trim(), record.otp);
    if (!isMatch) return res.status(400).json({ message: "Invalid OTP" });

    record.isVerified = true;
    await record.save();

    const token = jwt.sign({ mobile }, "mysecretkey", { expiresIn: "24h" });
    return res.json({ message: "OTP verified", token });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ======================send otp========================
exports.sendOtp = async (req, res) => {
  const { mobile } = req.body;

  if (!/^[0-9]{10}$/.test(mobile)) {
    return res.status(400).json({ message: "Invalid mobile" });
  }

  const existingUser = await User.findOne({ mobile });
  if (existingUser) {
    return res.status(400).json({ message: "Mobile number already registered. Please login" });
  }

  const otp       = Math.floor(1000 + Math.random() * 9000).toString();
  const hashedOtp = await bcrypt.hash(otp, 10);

  await Otp.findOneAndUpdate(
    { mobile },
    { $set: { otp: hashedOtp, isVerified: false, expiresAt: Date.now() + 2 * 60 * 1000 } },
    { upsert: true, returnDocument: "after" }
  );

  console.log("OTP:", otp);
  res.json({ message: "OTP sent", otp });
};

// ================= set pin =================
exports.setPin = async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin) return res.status(400).json({ message: "PIN is required" });
    if (!/^\d{4}$/.test(pin)) return res.status(400).json({ message: "PIN must be 4 digits" });
    if (!req.userId) return res.status(401).json({ message: "Invalid token (no userId)" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.transactionPin = await bcrypt.hash(pin, 10);
    await user.save();

    res.json({ message: "Transaction PIN set successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error setting PIN" });
  }
};

// ================= change transaction pin =================
exports.changePin = async (req, res) => {
  try {
    const { old_pin, new_pin } = req.body;

    if (!old_pin || !new_pin) return res.status(400).json({ message: "Old PIN and New PIN are required" });
    if (!/^\d{4}$/.test(new_pin)) return res.status(400).json({ message: "New PIN must be 4 digits" });
    if (!req.userId) return res.status(401).json({ message: "Invalid token" });

    const user = await User.findById(req.userId);
    if (!user || !user.transactionPin) return res.status(404).json({ message: "User or PIN not found" });

    const isMatch = await bcrypt.compare(old_pin, user.transactionPin);
    if (!isMatch) return res.status(400).json({ message: "Old PIN is incorrect" });

    const isSame = await bcrypt.compare(new_pin, user.transactionPin);
    if (isSame) return res.status(400).json({ message: "New PIN cannot be same as old PIN" });

    user.transactionPin = await bcrypt.hash(new_pin, 10);
    await user.save();

    res.json({ message: "PIN changed successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error changing PIN" });
  }
};

// ================= send login otp =================
exports.sendLoginOtp = async (req, res) => {
  const { mobile } = req.body;

  const user = await User.findOne({ mobile });
  if (!user) return res.status(400).json({ message: "User not registered" });

  const otp       = Math.floor(1000 + Math.random() * 9000).toString();
  const hashedOtp = await bcrypt.hash(otp, 10);

  await Otp.findOneAndUpdate(
    { mobile },
    { otp: hashedOtp, isVerified: false, expiresAt: Date.now() + 2 * 60 * 1000 },
    { upsert: true, returnDocument: "after" }
  );

  console.log("Login OTP:", otp);
  res.json({ message: "OTP sent", otp });
};

// ================= resend login otp =================
exports.resendLoginOtp = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile || !/^[0-9]{10}$/.test(mobile)) {
      return res.status(400).json({ message: "Valid mobile required" });
    }

    const user = await User.findOne({ mobile });
    if (!user) return res.status(400).json({ message: "User not registered" });

    const record = await Otp.findOne({ mobile });
    const now    = Date.now();

    if (record && record.expiresAt > now) {
      const secondsLeft = Math.floor((record.expiresAt - now) / 1000);
      return res.status(400).json({ message: `Please wait ${secondsLeft}s before requesting new OTP` });
    }

    const otp       = Math.floor(1000 + Math.random() * 9000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);

    await Otp.findOneAndUpdate(
      { mobile },
      { otp: hashedOtp, isVerified: false, expiresAt: now + 2 * 60 * 1000 },
      { upsert: true, returnDocument: "after" }
    );

    console.log("Resent Login OTP:", otp);
    res.json({ message: "OTP resent successfully", otp });

  } catch (err) {
    console.error("RESEND LOGIN OTP ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ================= reset password =================
exports.resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;

    if (!password || !confirmPassword) return res.status(400).json({ message: "All fields required" });
    if (password !== confirmPassword) return res.status(400).json({ message: "Passwords mismatch" });

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ message: "Use 8+ chars with uppercase, lowercase, number & special character" });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isSame = await bcrypt.compare(password, user.password);
    if (isSame) return res.status(400).json({ message: "New password cannot be same as old password" });

    user.password = await bcrypt.hash(password, 10);
    await user.save();

    if (req.mobile) await Otp.deleteOne({ mobile: req.mobile });

    res.json({ message: "Password changed successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ================= reset verify otp =================
exports.resetVerifyOtp = async (req, res) => {
  try {
    const { mobile, otp } = req.body;
    const record = await Otp.findOne({ mobile });

    if (!record || !record.otp) return res.status(400).json({ message: "OTP not found" });
    if (record.expiresAt < Date.now()) return res.status(400).json({ message: "Expired OTP" });

    const isMatch = await bcrypt.compare(String(otp).trim(), record.otp);
    if (!isMatch) return res.status(400).json({ message: "Invalid OTP" });

    record.isVerified = true;
    await record.save();

    const token = jwt.sign({ mobile }, "mysecretkey", { expiresIn: "24h" });
    return res.json({ message: "OTP verified", token });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ================= reset send otp =================
exports.resetSendOtp = async (req, res) => {
  const { mobile } = req.body;

  if (!/^[0-9]{10}$/.test(mobile)) return res.status(400).json({ message: "Invalid mobile" });

  const existingUser = await User.findOne({ mobile });
  if (!existingUser) return res.status(400).json({ message: "Mobile number not registered" });

  const otp       = Math.floor(1000 + Math.random() * 9000).toString();
  const hashedOtp = await bcrypt.hash(otp, 10);

  await Otp.findOneAndUpdate(
    { mobile },
    { $set: { otp: hashedOtp, isVerified: false, expiresAt: Date.now() + 2 * 60 * 1000 } },
    { upsert: true, returnDocument: "after" }
  );

  console.log("OTP:", otp);
  res.json({ message: "OTP sent", otp });
};