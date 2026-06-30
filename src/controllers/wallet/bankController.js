
const Bank = require("../models/Bank");
const Notification = require("../models/Notification");
const { sendNotification } = require("../utils/notify");
const bcrypt = require("bcrypt");

 //=========================add bank============

 exports.addBank = async (req, res) => {
  try {
    const {
      name,
      mobile,
      bank,
      account,
      confirmAccount,
      ifsc,
      accountType
    } = req.body;
 
    // Check required fields
    if (
      !name ||
      !mobile ||
      !bank ||
      !account ||
      !confirmAccount ||
      !ifsc ||
      !accountType
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }
 
    // Mobile validation
    const mobileRegex = /^[1-9]\d{9}$/;
 
    if (!mobileRegex.test(mobile)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mobile number"
      });
    }
 
    // Account number validation
    const accountRegex = /^\d{9,18}$/;
 
    if (!accountRegex.test(account)) {
      return res.status(400).json({
        success: false,
        message: "Account number must be 9 to 18 digits"
      });
    }
 
    // Confirm account validation
    if (account !== confirmAccount) {
      return res.status(400).json({
        success: false,
        message: "Account numbers do not match"
      });
    }
 
    // IFSC validation
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
 
    if (!ifscRegex.test(ifsc.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid IFSC code"
      });
    }
 // Check duplicate bank account
    const existingBank = await Bank.findOne({
      userId: req.userId,
      accountNumber: account
    });

    if (existingBank) {
      return res.status(400).json({
        success: false,
        message: "Bank already added"
      });
    }
    // Save bank details
    const bankDetails = await Bank.create({
      userId: req.userId,
      accountHolderName: name,
      mobileNumber: mobile,
      bankName: bank,
      accountNumber: account,
      ifscCode: ifsc.toUpperCase(),
      accountType
    });
await sendNotification({
  userId: req.userId,
  title: "Bank added successfully",
  message: "Your bank account has been added successfully",
  type: "SYSTEM"
});
    return res.status(201).json({
      success: true,
      message: "Bank details added successfully",
      data: bankDetails
    });
 
  } catch (error) {
    console.error("Add Bank Error:", error);
 
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
 
//============================tpin================

exports.createTpin = async (req, res) => {  
  try {

    const { bankId, tpin} = req.body;

    if (!bankId || !tpin) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // TPIN validation
    if (!/^\d{4}$/.test(tpin)) {
      return res.status(400).json({
        success: false,
        message: "TPIN must be 4 digits"
      });
    }


    const bank = await Bank.findOne({
      _id: bankId,
      userId: req.userId
    });

    if (!bank) {
      return res.status(404).json({
        success: false,
        message: "Bank not found"
      });
    }

    // Hash TPIN
    const hashedTpin = await bcrypt.hash(tpin, 10);

    bank.tpin = hashedTpin;
    bank.isTpinCreated = true;

    await bank.save();
await sendNotification({
  userId: req.userId,
  title: "tpin added successfully",
  message: "Your transaction pin has been added successfully",
  type: "SECURITY"
});
    return res.status(200).json({
      success: true,
      message: "TPIN created successfully"
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

//======================to get added banks=======================


exports.getMyBank = async (req, res) => {
  try {

    const bank = await Bank.find({
      userId: req.userId
    });

    // Check if bank exists
    if (!bank) {
      return res.status(404).json({
        success: false,
        message: "Bank details not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Bank details fetched successfully",
      data: bank
    });

  } catch (error) {
    console.error("Get Bank Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
