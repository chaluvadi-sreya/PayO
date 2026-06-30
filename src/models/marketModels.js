// models/marketModels.js (updated)
const NodeCache = require('node-cache');
const marketCache = require("../cache/marketCache");
const realtimePriceCache = require("../cache/realtimePriceCache");
const binanceWebSocket = require("../services/binanceWebSocketService");

class MarketModel {
  constructor() {
    this.cache = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL) || 60 });
    this.staticDataCache = new NodeCache({ stdTTL: 300 }); // 5 minutes for static data
  }

  // Format market data using real-time prices from WebSocket
  formatMarketData(binanceData, coingeckoData) {
    // Get real-time prices from WebSocket cache
    const realtimePrices = realtimePriceCache.getAllPrices();
    
    // If WebSocket has data, use it; otherwise fallback to REST API data
    const priceSource = realtimePrices.length > 0 ? realtimePrices : binanceData;
    
    const combinedMap = new Map();
    
    priceSource.forEach(bItem => {
      const coingeckoItem = coingeckoData.find(c => 
        c.symbol === bItem.symbol || 
        c.symbol === bItem.symbol + 'USDT'
      );
      
      combinedMap.set(bItem.symbol, {
        symbol: bItem.symbol,
        name: coingeckoItem?.name || bItem.symbol,
        price: bItem.price,
        priceChange24h: bItem.priceChange,
        priceChangePercentage24h: bItem.priceChangePercent,
        volume24h: bItem.volume,
        marketCap: coingeckoItem?.marketCap || null,
        high24h: bItem.high,
        low24h: bItem.low,
        image: coingeckoItem?.image || null,
        rank: coingeckoItem?.marketCapRank || null,
        lastUpdate: bItem.lastUpdate || Date.now()
      });
    });
    
    return Array.from(combinedMap.values());
  }

  // Get cached or fetch new data
  getCachedData(key) {
    return this.cache.get(key);
  }

  setCachedData(key, data, ttl = 60) {
    this.cache.set(key, data, ttl);
  }

  // Get real-time market data (no caching for prices)
  async getRealtimeMarketData(binanceService, coingeckoService) {
    try {
      // Get static data from cache (Coingecko data doesn't change rapidly)
      let coingeckoData = this.staticDataCache.get('coingecko_data');
      let trending = this.staticDataCache.get('trending_data');
      let globalData = this.staticDataCache.get('global_data');
      
      if (!coingeckoData) {
        coingeckoData = marketCache.market;
        trending = marketCache.trending;
        globalData = marketCache.global;
        
        // Cache static data for 5 minutes
        this.staticDataCache.set('coingecko_data', coingeckoData, 300);
        this.staticDataCache.set('trending_data', trending, 300);
        this.staticDataCache.set('global_data', globalData, 300);
      }
      
      // Get real-time prices from WebSocket or fallback to REST
      let binanceData = realtimePriceCache.getAllPrices();
      
      if (binanceData.length === 0) {
        // Fallback to REST API if WebSocket not ready
        binanceData = await binanceService.getSymbolsData();
      }
      
      const formattedData = this.formatMarketData(binanceData, coingeckoData);
      
      return {
        timestamp: new Date(),
        marketOverview: {
          totalMarketCap: globalData?.totalMarketCap || 0,
          totalVolume24h: globalData?.totalVolume || 0,
          btcDominance: globalData?.marketCapPercentage?.btc || 0,
          ethDominance: globalData?.marketCapPercentage?.eth || 0,
          activeCurrencies: globalData?.activeCryptocurrencies || 0,
          markets: globalData?.markets || 0
        },
        marketData: formattedData,
        lastUpdate: new Date(),
        isRealtime: binanceData.length > 0
      };
    } catch (error) {
      console.error('Error preparing realtime market data:', error);
      throw error;
    }
  }

  // Prepare enhanced market overview (for REST fallback)
  async prepareMarketOverview(binanceService, coingeckoService) {
    try {
      const [binanceData, topMovers] = await Promise.all([
        binanceService.getSymbolsData(),
        binanceService.getTopMovers(5)
      ]);

      const coingeckoData = marketCache.market;
      const trending = marketCache.trending;
      const globalData = marketCache.global;
      
      const formattedData = this.formatMarketData(binanceData, coingeckoData);
      
      return {
        timestamp: new Date(),
        marketOverview: {
          totalMarketCap: globalData?.totalMarketCap || 0,
          totalVolume24h: globalData?.totalVolume || 0,
          btcDominance: globalData?.marketCapPercentage?.btc || 0,
          ethDominance: globalData?.marketCapPercentage?.eth || 0,
          activeCurrencies: globalData?.activeCryptocurrencies || 0,
          markets: globalData?.markets || 0
        },
        topGainers: topMovers.gainers,
        topLosers: topMovers.losers,
        trendingCoins: trending,
        marketData: formattedData,
        lastUpdate: new Date()
      };
    } catch (error) {
      console.error('Error preparing market overview:', error);
      throw error;
    }
  }
}

module.exports = new MarketModel();