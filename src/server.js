// server.js (updated)
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const dotenv = require("dotenv");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

dotenv.config();

const connectDB = require("./config/db");
const websocketManager = require("./utils/websocketManager");
const binanceWebSocket = require("./services/binanceWebSocketService");
const realtimePriceCache = require("./cache/realtimePriceCache");

// cron
require("./cron/walletCron");

// routes
const authRoutes = require("./routes/auth/authRoutes");
const walletRoutes = require("./routes/wallet/walletRoutes");
const notificationRoutes = require("./routes/notification/notificationRoutes");
const marketRoutes = require("./routes/market/marketRoutes");
const updateMarketCache = require("./services/marketUpdater");
const bankRoutes = require("./routes/wallet/bankRoutes");
const tradingRoutes = require('./routes/trading/tradingRoutes');
const kycRoutes= require("./routes/kyc/kycRoutes");
const adminKycRoutes = require("./routes/admin/adminKycRoutes");
const adminAuthRoutes = require("./routes/admin/adminAuthRoutes");
const adminStatsRoutes = require("./routes/admin/adminStatsRoutes");
const adminUserDetailRoutes = require("./routes/admin/adminUserDetailRoutes");


// connect database
connectDB();

// Initial fetch of static data
updateMarketCache();

// Refresh static data every 5 minutes
setInterval(() => {
  updateMarketCache();
}, 5 * 60 * 1000);

// Initialize Binance WebSocket for real-time prices
binanceWebSocket.connect();

// Connect WebSocket price updates to your cache and broadcast to clients
binanceWebSocket.on('marketUpdate', (marketData) => {
  // Update real-time price cache
  realtimePriceCache.updatePrices(marketData);
  
  // Broadcast to all connected WebSocket clients
  websocketManager.broadcastMarketData(marketData);
});

const app = express();
const server = http.createServer(app);

// Middleware
app.use(helmet());


const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173"
  ],
  credentials: true,
};

app.use(cors(corsOptions));      

app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({
  limit: "50mb",
  extended: true,
}));
// server.js - Update the static files middleware
app.use("/kyc-docs", express.static(path.join(__dirname, "uploads"), {
  maxAge: "1d",
  dotfiles: "deny",
}));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/bank", bankRoutes);
app.use("/api/trading", tradingRoutes);
app.use("/api/kyc",kycRoutes);
app.use("/api/admin/kyc",adminKycRoutes);

// ── Admin routes ──────────────────────────────────────────────────────────────
app.use("/api/admin/auth", adminAuthRoutes);               // login, create admin, users
app.use("/api/admin/stats", adminStatsRoutes);             // dashboard widget stats
app.use("/api/admin/user-details", adminUserDetailRoutes); // kyc docs, transactions, referral


// Root Route
app.get("/", (req, res) => {
  res.send("Server is running");
});

// Health Check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date(),
    websocketConnected: binanceWebSocket.isConnected,
    realtimePricesCount: realtimePriceCache.getAllPrices().length
  });
});

// Initialize WebSocket Server for client connections
const wss = new WebSocket.Server({ server });
websocketManager.initialize(wss);

// Start Server
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("WebSocket server ready for live updates");
  console.log("Binance WebSocket connecting for real-time prices...");
});