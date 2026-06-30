// controllers/marketController.js (updated)
const binanceService = require("../services/binanceService");
const coingeckoService = require("../services/coingeckoService");
const marketModel = require("../models/marketModels");
const realtimePriceCache = require("../cache/realtimePriceCache");
const websocketManager = require("../utils/websocketManager");

class MarketController {

  // REST endpoint with real-time data (no caching or minimal caching)
  async getMarketOverview(req, res) {
    try {
      // Use real-time data instead of cached data
      const marketData = await marketModel.getRealtimeMarketData(
        binanceService,
        coingeckoService
      );

      res.json({
        success: true,
        data: marketData.marketData,
        isRealtime: marketData.isRealtime,
        lastUpdate: marketData.lastUpdate
      });
    } catch (error) {
      console.error("Market Overview Error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch market data"
      });
    }
  }

  // New endpoint for getting a single symbol price
  async getSymbolPrice(req, res) {
    try {
      const { symbol } = req.params;
      const price = realtimePriceCache.getPrice(symbol.toUpperCase());
      
      if (!price) {
        return res.status(404).json({
          success: false,
          message: "Symbol not found"
        });
      }
      
      res.json({
        success: true,
        data: price
      });
    } catch (error) {
      console.error("Symbol Price Error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch symbol price"
      });
    }
  }

  // Endpoint for batch price updates
  async getMultiplePrices(req, res) {
    try {
      const { symbols } = req.body;
      const prices = realtimePriceCache.getFilteredPrices(symbols);
      
      res.json({
        success: true,
        data: prices,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error("Batch Price Error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch prices"
      });
    }
  }
}

module.exports = new MarketController();