const cron = require('node-cron');
const Wallet = require('../models/Wallet');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { generateWalletAddress, generateQR } = require('../utils/helpers');
 
 
// ================= CRON JOB =================
cron.schedule("* * * * *", async () => {
  try {
    const wallets = await Wallet.find();
 
    for (let w of wallets) {
 
      // QR expiry
      if (w.qrExpiry && w.qrExpiry < Date.now()) {
        w.qrToken = uuidv4();
        w.qrExpiry = Date.now() + 15 * 60 * 1000;
      }
 
      // Wallet expiry
      if (w.addressExpiry && w.addressExpiry < Date.now()) {
        w.walletAddress = generateWalletAddress();
        w.addressExpiry = Date.now() + 60 * 60 * 1000;
 
        // reset QR also
        w.qrToken = uuidv4();
        w.qrExpiry = Date.now() + 15 * 60 * 1000;
      }
 
      await w.save();
    }
  } catch (err) {
    console.error("Cron error:", err.message);
  }
});
 