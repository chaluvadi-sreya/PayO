const express = require("express");
const router = express.Router();
const authController = require("../../controllers/auth/authController");
const auth = require("../middleware/auth");

router.post("/send-otp", authController.sendOtp);
router.post("/verify-otp", authController.verifyOtp);
router.post("/resend-otp",authController.resendOtp);
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/set-pin",auth,authController.setPin);
router.post("/send-login-otp",authController.sendLoginOtp);
router.post("/change-pin",auth,authController.changePin);
router.post("/verify-login-otp",authController.verifyLoginOtp);
router.post("/resend-login-otp",authController.resendLoginOtp);
router.post("/reset-password",auth,authController.resetPassword);
router.post("/reset-send-otp",authController.resetSendOtp);
router.post("/reset-verify-otp",authController.resetVerifyOtp);

module.exports = router;
