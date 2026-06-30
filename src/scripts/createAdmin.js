const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");
const dotenv   = require("dotenv");
 
dotenv.config();
 
const User = require("../models/User");
 
const ADMIN_DATA = {
  name:     "Super Admin",
  mobile:   process.env.ADMIN_MOBILE   || "9000000000",
  email:    process.env.ADMIN_EMAIL    || "admin@payo.com",
  password: process.env.ADMIN_PASSWORD || "Admin@123",
  role:     "admin",
};
 
const createAdmin = async () => {
  try {
    // Connect to DB
    await mongoose.connect(process.env.MONGO_URI);
    console.log(" Connected to MongoDB");
 
    // Check if admin already exists
    const existing = await User.findOne({
      $or: [
        { email:  ADMIN_DATA.email  },
        { mobile: ADMIN_DATA.mobile },
      ],
    });
 
    if (existing) {
      // If user exists but isn't admin, upgrade them
      if (existing.role !== "admin") {
        existing.role = "admin";
        await existing.save();
        console.log(" Existing user upgraded to admin:", existing.email);
      } else {
        console.log("  Admin already exists:", existing.email);
      }
      process.exit(0);
    }
 
    // Hash password
    const hashedPassword = await bcrypt.hash(ADMIN_DATA.password, 10);
 
    // Create admin
    const admin = await User.create({
      ...ADMIN_DATA,
      password: hashedPassword,
    });
 
    console.log(" Admin created successfully!");
    console.log("   Name:   ", admin.name);
    console.log("   Email:  ", admin.email);
    console.log("   Mobile: ", admin.mobile);
    console.log("   Role:   ", admin.role);
    console.log("\n Login with these credentials and keep them safe!");
 
  } catch (err) {
    console.error(" Error creating admin:", err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};
 
createAdmin();
