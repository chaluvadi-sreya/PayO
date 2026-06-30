const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "No token or invalid format",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "mysecretkey"
    );

    //  SUPER ADMIN SUPPORT
    if (decoded.superAdmin) {
      req.userId = "super_admin";
      req.mobile = process.env.ADMIN_MOBILE;
      req.userRole = "admin";
      req.superAdmin = true;

      return next();
    }

    // NORMAL USERS / ADMINS
    let user;

    if (decoded.id) {
      user = await User.findById(decoded.id);
    } else if (decoded.mobile) {
      user = await User.findOne({ mobile: decoded.mobile });
    } else {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    req.userId = user._id;
    req.mobile = user.mobile;
    req.userRole = user.role;

    next();

  } catch (err) {
    console.error("Auth error:", err);

    res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};