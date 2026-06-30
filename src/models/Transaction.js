const mongoose = require("mongoose");
 
const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    unique: true,
    default: () => "TXN" + Date.now()
  },
 
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
 
  senderWallet: String,
  receiverWallet: String,
 
  amount: Number,
 
  status: {
    type: String,
    enum: ["pending", "success", "failed"],
    default: "success"
  },
  failureReason: String,
 
  createdAt: {
    type: Date,
    default: Date.now
  }
});
 
module.exports = mongoose.model("Transaction", transactionSchema);
 