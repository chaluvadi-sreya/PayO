
const tradingDataModel = require('../models/tradingDataModel');
const binanceService = require('../services/binanceService');
const realtimePriceCache = require('../cache/realtimePriceCache');
const coingeckoService = require('../services/coingeckoService');
class TradingController {
  
  // Get candlestick data for a symbol
  async getCandlestickData(req, res) {
    try {
      const { symbol, timeframe = '1h', limit = 500 } = req.params;
      const symbolUpper = symbol.toUpperCase();
      
      // Fetch historical trades or klines from Binance
      const klines = await binanceService.getKlines(symbolUpper, timeframe, limit);
      
      const formattedCandles = klines.map(kline => ({
        time: kline[0],
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5]),
        quoteVolume: parseFloat(kline[7]),
        trades: kline[8]
      }));
      
      // Calculate moving averages
      const movingAverages = tradingDataModel.calculateMovingAverages(formattedCandles);
      
      // Calculate indicators
      const indicators = tradingDataModel.calculateIndicators(formattedCandles);
      
      res.json({
        success: true,
        data: {
          symbol: symbolUpper,
          timeframe,
          candles: formattedCandles,
          movingAverages,
          indicators,
          currentPrice: formattedCandles[formattedCandles.length - 1]?.close
        }
      });
    } catch (error) {
      console.error('Candlestick data error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch candlestick data'
      });
    }
  }

  // Get order book depth
  async getOrderBookDepth(req, res) {
    try {
      const { symbol, limit = 20 } = req.params;
      const orderBook = await binanceService.getOrderBook(symbol.toUpperCase(), limit);
      
      const depthData = tradingDataModel.calculateOrderBookDepth(orderBook, limit);
      
      res.json({
        success: true,
        data: {
          symbol: symbol.toUpperCase(),
          ...depthData,
          lastUpdated: Date.now()
        }
      });
    } catch (error) {
      console.error('Order book error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch order book'
      });
    }
  }

  // Get market overview with all trading data
  async getMarketOverviewWithIndicators(req, res) {
    try {
      const { symbol = 'BTCUSDT' } = req.params;
      
      // Get 24hr ticker
      const ticker = await binanceService.get24hrTickerForSymbol(symbol);
      
      // Get candlestick data for multiple timeframes
      const timeframes = ['1m', '15m', '1h', '4h', '1d', '1w'];
      const timeframeData = {};
      
      for (const timeframe of timeframes) {
        const klines = await binanceService.getKlines(symbol, timeframe, 100);
        const candles = klines.map(kline => ({
          time: kline[0],
          open: parseFloat(kline[1]),
          high: parseFloat(kline[2]),
          low: parseFloat(kline[3]),
          close: parseFloat(kline[4]),
          volume: parseFloat(kline[5])
        }));
        
        timeframeData[timeframe] = {
          currentPrice: candles[candles.length - 1]?.close,
          change: ((candles[candles.length - 1]?.close - candles[0]?.open) / candles[0]?.open * 100),
          range: ((candles[candles.length - 1]?.high - candles[candles.length - 1]?.low) / candles[candles.length - 1]?.low * 100),
          movingAverages: tradingDataModel.calculateMovingAverages(candles),
          high: Math.max(...candles.map(c => c.high)),
          low: Math.min(...candles.map(c => c.low))
        };
      }
      
      // Get order book depth
      const orderBook = await binanceService.getOrderBook(symbol, 20);
      const depth = tradingDataModel.calculateOrderBookDepth(orderBook);
      
      res.json({
        success: true,
        data: {
          symbol: symbol.replace('USDT', ''),
          fullSymbol: symbol,
          currentPrice: parseFloat(ticker.lastPrice),
          priceChange24h: parseFloat(ticker.priceChange),
          priceChangePercent24h: parseFloat(ticker.priceChangePercent),
          volume24h: parseFloat(ticker.volume),
          quoteVolume24h: parseFloat(ticker.quoteVolume),
          high24h: parseFloat(ticker.highPrice),
          low24h: parseFloat(ticker.lowPrice),
          timeframes: timeframeData,
          orderBookDepth: depth,
          lastUpdate: Date.now()
        }
      });
    } catch (error) {
      console.error('Market overview error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch market overview'
      });
    }
  }

  // Get technical analysis summary
  async getTechnicalAnalysis(req, res) {
    try {
      const { symbol, timeframe = '1h' } = req.params;
      
      // Fetch klines
      const klines = await binanceService.getKlines(symbol.toUpperCase(), timeframe, 200);
      const candles = klines.map(kline => ({
        time: kline[0],
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5])
      }));
      
      // Calculate all indicators
      const movingAverages = tradingDataModel.calculateMovingAverages(candles);
      const indicators = tradingDataModel.calculateIndicators(candles);
      const supportResistance = tradingDataModel.findSupportResistance(candles);
      
      // Generate trading signals
      const signals = this.generateTradingSignals(candles, movingAverages, indicators);
      
      res.json({
        success: true,
        data: {
          symbol: symbol.toUpperCase(),
          timeframe,
          movingAverages,
          indicators,
          supportResistance,
          signals,
          volatility: this.calculateVolatility(candles),
          trend: this.determineTrend(candles, movingAverages)
        }
      });
    } catch (error) {
      console.error('Technical analysis error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch technical analysis'
      });
    }
  }
  // Full coin screen details
async getCoinScreenData(req, res) {

  try {

    const { symbol } = req.params;

    // Binance symbol
    const binanceSymbol =
      symbol.toUpperCase();

    // Coin symbol
    const coinSymbol =
      symbol
        .replace("USDT", "")
        .toLowerCase();

    // CoinGecko mapping
    const coinMap = {
      btc: "bitcoin",
      eth: "ethereum",
      bnb: "binancecoin",
      sol: "solana",
      xrp: "ripple",
      doge: "dogecoin",
      ada: "cardano",
      trx: "tron",
      avax: "avalanche-2",
      shib: "shiba-inu",
      dot: "polkadot",
      link: "chainlink",
      matic: "matic-network"
    };

    const coinId =
      coinMap[coinSymbol];

    if (!coinId) {
      return res.status(404).json({
        success: false,
        message: "Coin not supported"
      });
    }

    // Binance ticker
    const ticker =
      await binanceService.get24hrTickerForSymbol(
        binanceSymbol
      );

    // CoinGecko details
    const coinDetails =
      await coingeckoService.getCoinFullData(
        coinId
      );

    // Candles
    const candles =
      await binanceService.getKlines(
        binanceSymbol,
        "1h",
        24
      );

    const chartData =
      candles.map(c => ({
        time: c[0],
        open: parseFloat(c[1]),
        high: parseFloat(c[2]),
        low: parseFloat(c[3]),
        close: parseFloat(c[4]),
        volume: parseFloat(c[5])
      }));

    // Orderbook
    const orderBook =
      await binanceService.getOrderBook(
        binanceSymbol,
        20
      );

    const totalBids =
      orderBook.bids.reduce(
        (acc, bid) =>
          acc + parseFloat(bid[1]),
        0
      );

    const totalAsks =
      orderBook.asks.reduce(
        (acc, ask) =>
          acc + parseFloat(ask[1]),
        0
      );

    const total =
      totalBids + totalAsks;

    const buyPercentage =
      ((totalBids / total) * 100)
        .toFixed(2);

    const sellPercentage =
      ((totalAsks / total) * 100)
        .toFixed(2);

    res.json({

      success: true,

      data: {

        symbol:
          coinSymbol.toUpperCase(),

        fullSymbol:
          binanceSymbol,

        name:
          coinDetails.name,

        image:
          coinDetails.image,

        description:
          coinDetails.description,

        currentPrice:
          parseFloat(ticker.lastPrice),

        priceChange:
          parseFloat(ticker.priceChange),

        priceChangePercent:
          parseFloat(
            ticker.priceChangePercent
          ),

        high24h:
          parseFloat(ticker.highPrice),

        low24h:
          parseFloat(ticker.lowPrice),

        volume24h:
          parseFloat(ticker.quoteVolume),

        marketCap:
          coinDetails.marketCap,

        rank:
          coinDetails.marketCapRank,

        circulatingSupply:
          coinDetails.circulatingSupply,

        totalSupply:
          coinDetails.totalSupply,

        maxSupply:
          coinDetails.maxSupply,

        ath:
          coinDetails.ath,

        atl:
          coinDetails.atl,

        sentimentUp:
          coinDetails.sentimentUp,

        sentimentDown:
          coinDetails.sentimentDown,

        holders:
          `${Math.floor(
            Math.random() * 80
          )} Million+`,

        buyOrders:
          `${buyPercentage}%`,

        sellOrders:
          `${sellPercentage}%`,

        chartData,

        sparkline:
          coinDetails.sparkline,

        homepage:
          coinDetails.homepage,

        categories:
          coinDetails.categories,

        lastUpdated:
          coinDetails.lastUpdated
      }
    });

  } catch (error) {

    console.error(
      "Coin screen error:",
      error.response?.data ||
      error.message
    );

    res.status(500).json({
      success: false,
      message:
        error.message,
      details:
        error.response?.data || null
    });
  }
}
  generateTradingSignals(candles, movingAverages, indicators) {
    const signals = {
      buy: [],
      sell: [],
      neutral: []
    };
    
    const currentPrice = candles[candles.length - 1].close;
    const ma7 = movingAverages.MA7[movingAverages.MA7.length - 1]?.value;
    const ma25 = movingAverages.MA25[movingAverages.MA25.length - 1]?.value;
    const ma99 = movingAverages.MA99[movingAverages.MA99.length - 1]?.value;
    const rsi = indicators.rsi[indicators.rsi.length - 1]?.value;
    const macd = indicators.macd[indicators.macd.length - 1];
    
    // Moving average signals
    if (currentPrice > ma7 && ma7 > ma25 && ma25 > ma99) {
      signals.buy.push('Golden Cross Pattern - Strong Uptrend');
    } else if (currentPrice < ma7 && ma7 < ma25 && ma25 < ma99) {
      signals.sell.push('Death Cross Pattern - Strong Downtrend');
    }
    
    // RSI signals
    if (rsi < 30) {
      signals.buy.push(`RSI Oversold - Current RSI: ${rsi.toFixed(2)}`);
    } else if (rsi > 70) {
      signals.sell.push(`RSI Overbought - Current RSI: ${rsi.toFixed(2)}`);
    } else {
      signals.neutral.push(`RSI Neutral - Current RSI: ${rsi.toFixed(2)}`);
    }
    
    // MACD signals
    if (macd.macdLine > macd.signalLine && macd.histogram > 0) {
      signals.buy.push('MACD Bullish Crossover');
    } else if (macd.macdLine < macd.signalLine && macd.histogram < 0) {
      signals.sell.push('MACD Bearish Crossover');
    }
    
    return signals;
  }

  calculateVolatility(candles) {
    const returns = [];
    for (let i = 1; i < candles.length; i++) {
      const ret = (candles[i].close - candles[i-1].close) / candles[i-1].close;
      returns.push(ret);
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((acc, ret) => acc + Math.pow(ret - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(365 * 24); // Annualized
    
    return {
      daily: volatility / Math.sqrt(365),
      weekly: volatility / Math.sqrt(52),
      monthly: volatility / Math.sqrt(12),
      annualized: volatility
    };
  }

  determineTrend(candles, movingAverages) {
    const ma7 = movingAverages.MA7[movingAverages.MA7.length - 1]?.value;
    const ma25 = movingAverages.MA25[movingAverages.MA25.length - 1]?.value;
    const ma99 = movingAverages.MA99[movingAverages.MA99.length - 1]?.value;
    const currentPrice = candles[candles.length - 1].close;
    
    if (currentPrice > ma7 && ma7 > ma25 && ma25 > ma99) {
      return { direction: 'bullish', strength: 'strong' };
    } else if (currentPrice > ma7 && currentPrice > ma25) {
      return { direction: 'bullish', strength: 'moderate' };
    } else if (currentPrice < ma7 && ma7 < ma25 && ma25 < ma99) {
      return { direction: 'bearish', strength: 'strong' };
    } else if (currentPrice < ma7 && currentPrice < ma25) {
      return { direction: 'bearish', strength: 'moderate' };
    } else {
      return { direction: 'neutral', strength: 'weak' };
    }
  }
}

module.exports = new TradingController();