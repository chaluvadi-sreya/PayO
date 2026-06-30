
const axios = require('axios');
const NodeCache = require('node-cache');

class ChartDataService {
  constructor() {
    this.cache = new NodeCache({ stdTTL: 60 }); // 1 minute cache
    this.binanceClient = axios.create({
      baseURL: 'https://api.binance.com',
      timeout: 10000
    });
  }

  // Get candlestick/klines data for a symbol
  async getKlineData(symbol, interval, limit = 500) {
    const cacheKey = `${symbol}_${interval}_${limit}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.binanceClient.get('/api/v3/klines', {
        params: {
          symbol: symbol.toUpperCase(),
          interval: interval,
          limit: limit
        }
      });

      const formattedData = response.data.map(kline => ({
        openTime: kline[0],
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5]),
        closeTime: kline[6],
        quoteVolume: parseFloat(kline[7]),
        trades: kline[8],
        buyBaseVolume: parseFloat(kline[9]),
        buyQuoteVolume: parseFloat(kline[10])
      }));

      this.cache.set(cacheKey, formattedData, 60);
      return formattedData;
    } catch (error) {
      console.error('Error fetching kline data:', error.message);
      throw error;
    }
  }

  // Calculate moving averages from kline data
  calculateMovingAverages(data, periods) {
    const movingAverages = {};
    
    for (const period of periods) {
      const ma = [];
      for (let i = period - 1; i < data.length; i++) {
        const sum = data.slice(i - period + 1, i + 1).reduce((acc, candle) => acc + candle.close, 0);
        ma.push({
          timestamp: data[i].openTime,
          value: sum / period
        });
      }
      movingAverages[`MA${period}`] = ma;
    }
    
    return movingAverages;
  }

  // Get current trading data for a symbol (similar to your screenshot)
  async getCurrentTradingData(symbol) {
    try {
      const [ticker24h, klineData] = await Promise.all([
        this.binanceClient.get('/api/v3/ticker/24hr', {
          params: { symbol: symbol.toUpperCase() }
        }),
        this.getKlineData(symbol, '1h', 100)
      ]);

      const data = ticker24h.data;
      
      // Calculate moving averages from kline data
      const closes = klineData.map(k => k.close);
      const ma7 = this.calculateSimpleMA(closes, 7);
      const ma25 = this.calculateSimpleMA(closes, 25);
      const ma99 = this.calculateSimpleMA(closes, 99);
      
      // Calculate range percentage
      const range = ((data.highPrice - data.lowPrice) / data.lowPrice) * 100;
      
      return {
        symbol: symbol.toUpperCase(),
        fullSymbol: `${symbol.toUpperCase()}USDT`,
        open: parseFloat(data.openPrice),
        high: parseFloat(data.highPrice),
        low: parseFloat(data.lowPrice),
        close: parseFloat(data.lastPrice),
        change: parseFloat(data.priceChangePercent),
        range: range.toFixed(2),
        volume: {
          btc: parseFloat(data.volume),
          usdt: parseFloat(data.quoteVolume)
        },
        movingAverages: {
          ma7: ma7,
          ma25: ma25,
          ma99: ma99
        },
        high24h: parseFloat(data.highPrice),
        low24h: parseFloat(data.lowPrice),
        bidPrice: parseFloat(data.bidPrice),
        askPrice: parseFloat(data.askPrice),
        weightedAvgPrice: parseFloat(data.weightedAvgPrice),
        lastUpdate: Date.now()
      };
    } catch (error) {
      console.error('Error fetching trading data:', error.message);
      throw error;
    }
  }

  // Calculate simple moving average
  calculateSimpleMA(prices, period) {
    if (prices.length < period) return null;
    const recentPrices = prices.slice(-period);
    const sum = recentPrices.reduce((acc, price) => acc + price, 0);
    return parseFloat((sum / period).toFixed(2));
  }

  // Get multiple timeframe data for technical analysis
  async getMultiTimeframeData(symbol) {
    const timeframes = ['1m', '15m', '1h', '4h', '1d', '1w'];
    const timeframeData = {};
    
    for (const tf of timeframes) {
      const klineData = await this.getKlineData(symbol, tf, 100);
      const closes = klineData.map(k => k.close);
      
      timeframeData[tf] = {
        currentPrice: closes[closes.length - 1],
        ma7: this.calculateSimpleMA(closes, 7),
        ma25: this.calculateSimpleMA(closes, 25),
        ma99: this.calculateSimpleMA(closes, 99),
        high: Math.max(...klineData.slice(-24).map(k => k.high)),
        low: Math.min(...klineData.slice(-24).map(k => k.low)),
        volatility: this.calculateVolatility(closes.slice(-24))
      };
    }
    
    return timeframeData;
  }

  // Calculate volatility percentage
  calculateVolatility(prices) {
    if (prices.length < 2) return 0;
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((acc, ret) => acc + Math.pow(ret - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    return parseFloat((stdDev * 100).toFixed(2));
  }

  // Get order book depth data
  async getOrderBookDepth(symbol, limit = 100) {
    try {
      const response = await this.binanceClient.get('/api/v3/depth', {
        params: {
          symbol: symbol.toUpperCase(),
          limit: limit
        }
      });
      
      return {
        symbol: symbol.toUpperCase(),
        bids: response.data.bids.map(bid => ({
          price: parseFloat(bid[0]),
          quantity: parseFloat(bid[1])
        })),
        asks: response.data.asks.map(ask => ({
          price: parseFloat(ask[0]),
          quantity: parseFloat(ask[1])
        })),
        lastUpdateId: response.data.lastUpdateId
      };
    } catch (error) {
      console.error('Error fetching order book:', error.message);
      throw error;
    }
  }

  // Get recent trades
  async getRecentTrades(symbol, limit = 100) {
    try {
      const response = await this.binanceClient.get('/api/v3/trades', {
        params: {
          symbol: symbol.toUpperCase(),
          limit: limit
        }
      });
      
      return response.data.map(trade => ({
        id: trade.id,
        price: parseFloat(trade.price),
        quantity: parseFloat(trade.qty),
        quoteQuantity: parseFloat(trade.quoteQty),
        time: trade.time,
        isBuyerMaker: trade.isBuyerMaker,
        isBestMatch: trade.isBestMatch
      }));
    } catch (error) {
      console.error('Error fetching recent trades:', error.message);
      throw error;
    }
  }

  // Calculate technical indicators
  async getTechnicalIndicators(symbol, interval = '1h') {
    const klineData = await this.getKlineData(symbol, interval, 200);
    const closes = klineData.map(k => k.close);
    const highs = klineData.map(k => k.high);
    const lows = klineData.map(k => k.low);
    
    return {
      rsi: this.calculateRSI(closes, 14),
      macd: this.calculateMACD(closes),
      bollingerBands: this.calculateBollingerBands(closes, 20, 2),
      support: this.findSupportLevels(lows),
      resistance: this.findResistanceLevels(highs),
      trend: this.determineTrend(closes)
    };
  }

  // Calculate RSI (Relative Strength Index)
  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return null;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = prices.length - period; i < prices.length; i++) {
      const difference = prices[i] - prices[i - 1];
      if (difference >= 0) {
        gains += difference;
      } else {
        losses -= difference;
      }
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return parseFloat(rsi.toFixed(2));
  }

  // Calculate MACD
  calculateMACD(prices) {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    
    if (!ema12 || !ema26) return null;
    
    const macdLine = ema12 - ema26;
    const signalLine = this.calculateEMA([macdLine], 9);
    
    return {
      macdLine: parseFloat(macdLine.toFixed(4)),
      signalLine: parseFloat(signalLine.toFixed(4)),
      histogram: parseFloat((macdLine - signalLine).toFixed(4))
    };
  }

  // Calculate EMA (Exponential Moving Average)
  calculateEMA(prices, period) {
    if (prices.length < period) return null;
    
    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  // Calculate Bollinger Bands
  calculateBollingerBands(prices, period = 20, stdDev = 2) {
    if (prices.length < period) return null;
    
    const recentPrices = prices.slice(-period);
    const sma = recentPrices.reduce((a, b) => a + b, 0) / period;
    const variance = recentPrices.reduce((acc, price) => acc + Math.pow(price - sma, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);
    
    return {
      upper: parseFloat((sma + (standardDeviation * stdDev)).toFixed(2)),
      middle: parseFloat(sma.toFixed(2)),
      lower: parseFloat((sma - (standardDeviation * stdDev)).toFixed(2))
    };
  }

  // Find support levels
  findSupportLevels(lows, lookback = 50) {
    const recentLows = lows.slice(-lookback);
    const supports = [];
    
    for (let i = 1; i < recentLows.length - 1; i++) {
      if (recentLows[i] < recentLows[i-1] && recentLows[i] < recentLows[i+1]) {
        supports.push(recentLows[i]);
      }
    }
    
    return supports.slice(-3).map(s => parseFloat(s.toFixed(2)));
  }

  // Find resistance levels
  findResistanceLevels(highs, lookback = 50) {
    const recentHighs = highs.slice(-lookback);
    const resistances = [];
    
    for (let i = 1; i < recentHighs.length - 1; i++) {
      if (recentHighs[i] > recentHighs[i-1] && recentHighs[i] > recentHighs[i+1]) {
        resistances.push(recentHighs[i]);
      }
    }
    
    return resistances.slice(-3).map(r => parseFloat(r.toFixed(2)));
  }

  // Determine trend
  determineTrend(prices) {
    if (prices.length < 50) return 'neutral';
    
    const ma20 = this.calculateSimpleMA(prices, 20);
    const ma50 = this.calculateSimpleMA(prices, 50);
    const currentPrice = prices[prices.length - 1];
    
    if (currentPrice > ma20 && ma20 > ma50) return 'bullish';
    if (currentPrice < ma20 && ma20 < ma50) return 'bearish';
    return 'neutral';
  }
}

module.exports = new ChartDataService();