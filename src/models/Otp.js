// models/Otp.js
const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  mobile: String,
  otp: String,
  isVerified: { type: Boolean, default: false },
  expiresAt: Date
});

module.exports = mongoose.model("Otp", otpSchema);