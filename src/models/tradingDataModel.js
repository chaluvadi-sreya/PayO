
class TradingDataModel {
  constructor() {
    this.timeframes = ['1m', '15m', '1h', '4h', '1d', '1w'];
    this.chartTypes = ['candlestick', 'line', 'depth'];
  }

  // Format OHLC data for candlestick charts
  formatOHLCData(symbol, timeframe, trades) {
    const candles = this.groupIntoCandles(trades, timeframe);
    
    return candles.map(candle => ({
      time: candle.timestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      quoteVolume: candle.quoteVolume,
      trades: candle.trades
    }));
  }

  groupIntoCandles(trades, timeframe) {
    const timeframeMap = {
      '1m': 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000
    };
    
    const interval = timeframeMap[timeframe];
    const candles = new Map();
    
    trades.forEach(trade => {
      const candleTime = Math.floor(trade.timestamp / interval) * interval;
      
      if (!candles.has(candleTime)) {
        candles.set(candleTime, {
          timestamp: candleTime,
          open: trade.price,
          high: trade.price,
          low: trade.price,
          close: trade.price,
          volume: 0,
          quoteVolume: 0,
          trades: 0
        });
      }
      
      const candle = candles.get(candleTime);
      candle.high = Math.max(candle.high, trade.price);
      candle.low = Math.min(candle.low, trade.price);
      candle.close = trade.price;
      candle.volume += trade.quantity;
      candle.quoteVolume += trade.price * trade.quantity;
      candle.trades++;
    });
    
    return Array.from(candles.values());
  }

  // Calculate moving averages
  calculateMovingAverages(candles, periods = [7, 25, 99]) {
    const result = {};
    
    periods.forEach(period => {
      const ma = [];
      for (let i = period - 1; i < candles.length; i++) {
        const sum = candles.slice(i - period + 1, i + 1)
          .reduce((acc, candle) => acc + candle.close, 0);
        ma.push({
          time: candles[i].time,
          value: sum / period
        });
      }
      result[`MA${period}`] = ma;
    });
    
    return result;
  }

  // Calculate technical indicators
  calculateIndicators(candles) {
    return {
      rsi: this.calculateRSI(candles, 14),
      macd: this.calculateMACD(candles),
      bollingerBands: this.calculateBollingerBands(candles, 20, 2),
      volumeProfile: this.calculateVolumeProfile(candles),
      supportResistance: this.findSupportResistance(candles)
    };
  }

  calculateRSI(candles, period = 14) {
    const rsi = [];
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i < candles.length; i++) {
      const change = candles[i].close - candles[i - 1].close;
      
      if (i <= period) {
        if (change > 0) gains += change;
        if (change < 0) losses -= change;
        
        if (i === period) {
          let avgGain = gains / period;
          let avgLoss = losses / period;
          const rs = avgGain / avgLoss;
          rsi.push({
            time: candles[i].time,
            value: 100 - (100 / (1 + rs))
          });
        }
      } else {
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;
        
        const avgGain = ((rsi[rsi.length - 1].value * (period - 1)) + gain) / period;
        const avgLoss = ((100 - rsi[rsi.length - 1].value) * (period - 1) / 100 + loss) / period;
        
        const rs = avgGain / avgLoss;
        rsi.push({
          time: candles[i].time,
          value: 100 - (100 / (1 + rs))
        });
      }
    }
    
    return rsi;
  }

  calculateMACD(candles, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const prices = candles.map(c => c.close);
    const emaFast = this.calculateEMA(prices, fastPeriod);
    const emaSlow = this.calculateEMA(prices, slowPeriod);
    const macdLine = emaFast.map((fast, i) => fast - emaSlow[i]);
    const signalLine = this.calculateEMA(macdLine, signalPeriod);
    const histogram = macdLine.map((macd, i) => macd - signalLine[i]);
    
    return candles.map((candle, i) => ({
      time: candle.time,
      macdLine: macdLine[i],
      signalLine: signalLine[i],
      histogram: histogram[i]
    }));
  }

  calculateEMA(prices, period) {
    const multiplier = 2 / (period + 1);
    const ema = [prices[0]];
    
    for (let i = 1; i < prices.length; i++) {
      ema.push((prices[i] - ema[i - 1]) * multiplier + ema[i - 1]);
    }
    
    return ema;
  }

  calculateBollingerBands(candles, period = 20, stdDev = 2) {
    const bands = [];
    
    for (let i = period - 1; i < candles.length; i++) {
      const slice = candles.slice(i - period + 1, i + 1);
      const closes = slice.map(c => c.close);
      const sma = closes.reduce((a, b) => a + b, 0) / period;
      const variance = closes.reduce((acc, price) => acc + Math.pow(price - sma, 2), 0) / period;
      const standardDeviation = Math.sqrt(variance);
      
      bands.push({
        time: candles[i].time,
        upper: sma + (standardDeviation * stdDev),
        middle: sma,
        lower: sma - (standardDeviation * stdDev)
      });
    }
    
    return bands;
  }

  calculateVolumeProfile(candles) {
    const volumeAtPrice = new Map();
    
    candles.forEach(candle => {
      const priceLevel = Math.floor(candle.close);
      const volume = volumeAtPrice.get(priceLevel) || 0;
      volumeAtPrice.set(priceLevel, volume + candle.volume);
    });
    
    return Array.from(volumeAtPrice.entries())
      .map(([price, volume]) => ({ price, volume }))
      .sort((a, b) => b.volume - a.volume);
  }

  findSupportResistance(candles, lookback = 20) {
    const pivots = [];
    
    for (let i = lookback; i < candles.length - lookback; i++) {
      let isHigh = true;
      let isLow = true;
      
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j === i) continue;
        
        if (candles[j].high >= candles[i].high) isHigh = false;
        if (candles[j].low <= candles[i].low) isLow = false;
      }
      
      if (isHigh) {
        pivots.push({ time: candles[i].time, price: candles[i].high, type: 'resistance' });
      }
      if (isLow) {
        pivots.push({ time: candles[i].time, price: candles[i].low, type: 'support' });
      }
    }
    
    return this.clusterPivots(pivots);
  }

  clusterPivots(pivots, tolerance = 0.005) {
    const clusters = [];
    
    pivots.forEach(pivot => {
      let found = false;
      
      for (const cluster of clusters) {
        const priceDiff = Math.abs(cluster.price - pivot.price) / cluster.price;
        if (priceDiff < tolerance && cluster.type === pivot.type) {
          cluster.price = (cluster.price + pivot.price) / 2;
          cluster.strength++;
          found = true;
          break;
        }
      }
      
      if (!found) {
        clusters.push({
          price: pivot.price,
          type: pivot.type,
          strength: 1,
          lastSeen: pivot.time
        });
      }
    });
    
    return clusters.filter(c => c.strength >= 2);
  }

  // Calculate depth chart data
  calculateOrderBookDepth(orderBook, levels = 20) {
    const bids = orderBook.bids.slice(0, levels).map(bid => ({
      price: bid[0],
      quantity: bid[1],
      total: bid[0] * bid[1]
    }));
    
    const asks = orderBook.asks.slice(0, levels).map(ask => ({
      price: ask[0],
      quantity: ask[1],
      total: ask[0] * ask[1]
    }));
    
    // Calculate cumulative depth
    let cumulativeBids = 0;
    let cumulativeAsks = 0;
    
    const bidsWithCumulative = bids.map(bid => {
      cumulativeBids += bid.quantity;
      return { ...bid, cumulative: cumulativeBids };
    });
    
    const asksWithCumulative = asks.map(ask => {
      cumulativeAsks += ask.quantity;
      return { ...ask, cumulative: cumulativeAsks };
    });
    
    return {
      bids: bidsWithCumulative,
      asks: asksWithCumulative,
      spread: asks[0]?.price - bids[0]?.price,
      midPrice: (asks[0]?.price + bids[0]?.price) / 2
    };
  }
}

module.exports = new TradingDataModel();