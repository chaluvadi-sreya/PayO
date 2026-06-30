const { v4: uuidv4 } = require("uuid");
const QRCode = require("qrcode");

const generateWalletAddress = () => "PX" + uuidv4().replace(/-/g, "").slice(0, 14).toUpperCase();

const generateQR = async (walletAddress) => {
  return await QRCode.toDataURL(walletAddress);
};

module.exports = { generateWalletAddress, generateQR };