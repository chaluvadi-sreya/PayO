const axios = require('axios');

class BinanceService {
  constructor() {
    this.baseURL = process.env.BINANCE_API_URL || 'https://api.binance.com';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000
    });
  }

  // Get 24hr ticker for all symbols
  async get24hrTicker() {
    try {
      const response = await this.client.get('/api/v3/ticker/24hr');
      return response.data;
    } catch (error) {
      console.error('Binance API Error:', error.message);
      throw error;
    }
  }

  // Get kline/candlestick data
  async getKlines(symbol, interval = '1h', limit = 500) {
    try {
      const response = await this.client.get('/api/v3/klines', {
        params: {
          symbol: symbol.toUpperCase(),
          interval: interval,
          limit: limit
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching klines:', error);
      throw error;
    }
  }

  // Get order book
  async getOrderBook(symbol, limit = 100) {
    try {
      const response = await this.client.get('/api/v3/depth', {
        params: {
          symbol: symbol.toUpperCase(),
          limit: limit
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching order book:', error);
      throw error;
    }
  }

  // Get 24hr ticker for specific symbol
  async get24hrTickerForSymbol(symbol) {
    try {
      const response = await this.client.get('/api/v3/ticker/24hr', {
        params: { symbol: symbol.toUpperCase() }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching ticker:', error);
      throw error;
    }
  }

  // Get recent trades
  async getRecentTrades(symbol, limit = 500) {
    try {
      const response = await this.client.get('/api/v3/trades', {
        params: {
          symbol: symbol.toUpperCase(),
          limit: limit
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching recent trades:', error);
      throw error;
    }
  }

  // Get aggregate trades (compressed)
  async getAggTrades(symbol, fromId = null, limit = 500) {
    try {
      const params = { symbol: symbol.toUpperCase(), limit: limit };
      if (fromId) params.fromId = fromId;
      
      const response = await this.client.get('/api/v3/aggTrades', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching aggregate trades:', error);
      throw error;
    }
  }

  // Get exchange info
  async getExchangeInfo() {
    try {
      const response = await this.client.get('/api/v3/exchangeInfo');
      return response.data;
    } catch (error) {
      console.error('Error fetching exchange info:', error);
      throw error;
    }
  }

  // Get specific symbols data  
  async getSymbolsData(symbols = null) {
  try {
    const allTickers = await this.get24hrTicker();

    let filteredTickers = allTickers;

    // if symbols provided → filter
    if (symbols && symbols.length > 0) {
      filteredTickers = allTickers.filter(ticker =>
        symbols.includes(ticker.symbol)
      );
    }

    // only USDT pairs
    filteredTickers = filteredTickers.filter(ticker =>
      ticker.symbol.endsWith('USDT')
    );

   return filteredTickers.map(ticker => ({
  symbol: ticker.symbol.replace('USDT', ''),
  fullSymbol: ticker.symbol,

  price: Number(parseFloat(ticker.lastPrice).toFixed(2)),

  priceChange: Number(parseFloat(ticker.priceChange).toFixed(2)),

  priceChangePercent: Number(parseFloat(ticker.priceChangePercent).toFixed(2)),

  volume: Number(parseFloat(ticker.volume).toFixed(3)),

  quoteVolume: Number(parseFloat(ticker.quoteVolume).toFixed(2)),

  high: Number(parseFloat(ticker.highPrice).toFixed(2)),

  low: Number(parseFloat(ticker.lowPrice).toFixed(2)),

  open: Number(parseFloat(ticker.openPrice).toFixed(2)),

  close: Number(parseFloat(ticker.lastPrice).toFixed(2)),

  bidPrice: Number(parseFloat(ticker.bidPrice).toFixed(2)),

  askPrice: Number(parseFloat(ticker.askPrice).toFixed(2)),

  weightedAvgPrice: Number(parseFloat(ticker.weightedAvgPrice).toFixed(2)),

  count: ticker.count
}));

  } catch (error) {
    console.error('Error fetching symbols data:', error);
    throw error;
  }
}

  // Get top gainers and losers
  async getTopMovers(limit = 5) {
    try {
      const allTickers = await this.get24hrTicker();
      
      // Filter out low volume coins and stablecoins
      const validTickers = allTickers.filter(ticker => 
        parseFloat(ticker.quoteVolume) > 1000000 && 
        !ticker.symbol.includes('USDC') &&
        !ticker.symbol.includes('BUSD') &&
        !ticker.symbol.includes('TUSD')
      );
      
      const withChanges = validTickers.map(ticker => ({
        symbol: ticker.symbol.replace('USDT', ''),
        fullSymbol: ticker.symbol,
        price: parseFloat(ticker.lastPrice),
        changePercent: parseFloat(ticker.priceChangePercent),
        volume: parseFloat(ticker.volume),
        quoteVolume: parseFloat(ticker.quoteVolume)
      }));
      
      const gainers = withChanges
        .sort((a, b) => b.changePercent - a.changePercent)
        .slice(0, limit);
      
      const losers = withChanges
        .sort((a, b) => a.changePercent - b.changePercent)
        .slice(0, limit);
      
      return { gainers, losers };
    } catch (error) {
      console.error('Error fetching top movers:', error);
      throw error;
    }
  }

  // Get single symbol price
  async getSymbolPrice(symbol) {
    try {
      const response = await this.client.get('/api/v3/ticker/price', {
        params: { symbol: symbol.toUpperCase() }
      });
      return {
        symbol: symbol.toUpperCase(),
        price: parseFloat(response.data.price)
      };
    } catch (error) {
      console.error('Error fetching symbol price:', error);
      throw error;
    }
  }
}

module.exports = new BinanceService();