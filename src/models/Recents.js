const mongoose = require("mongoose");
 
const recentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  receiverName: String,
  walletAddress: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});
 
module.exports = mongoose.model("Recent", recentSchema);
 