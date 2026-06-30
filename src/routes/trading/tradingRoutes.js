
const express = require('express');
const router = express.Router();
const tradingController = require('../../controllers/trading/tradingController');

// Candlestick data endpoints
router.get('/candles/:symbol', tradingController.getCandlestickData);

router.get('/candles/:symbol/:timeframe', tradingController.getCandlestickData);

router.get('/candles/:symbol/:timeframe/:limit', tradingController.getCandlestickData);
// Market overview
router.get('/market', tradingController.getMarketOverviewWithIndicators);

router.get('/market/:symbol', tradingController.getMarketOverviewWithIndicators);
router.get('/orderbook/:symbol', tradingController.getOrderBookDepth);

router.get('/orderbook/:symbol/:limit', tradingController.getOrderBookDepth);
// Technical analysis
router.get('/analysis/:symbol', tradingController.getTechnicalAnalysis);

router.get('/analysis/:symbol/:timeframe', tradingController.getTechnicalAnalysis);
router.get('/coin/:symbol',tradingController.getCoinScreenData);
// Multiple symbols comparison
router.post('/compare', async (req, res) => {
  try {
    const { symbols, timeframe = '1h' } = req.body;
    const results = {};
    
    for (const symbol of symbols) {
      const analysis = await tradingController.getTechnicalAnalysis({
        params: { symbol, timeframe }
      });
      results[symbol] = analysis.data;
    }
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to compare symbols'
    });
  }
});

// Watchlist with real-time updates
router.get('/watchlist/:symbols', async (req, res) => {
  try {
    const symbols = req.params.symbols.split(',');
    const watchlistData = {};
    
    for (const symbol of symbols) {
      const ticker = await binanceService.get24hrTickerForSymbol(symbol);
      watchlistData[symbol] = {
        symbol: symbol.replace('USDT', ''),
        price: parseFloat(ticker.lastPrice),
        change24h: parseFloat(ticker.priceChangePercent),
        volume24h: parseFloat(ticker.volume),
        high24h: parseFloat(ticker.highPrice),
        low24h: parseFloat(ticker.lowPrice)
      };
    }
    
    res.json({
      success: true,
      data: watchlistData,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch watchlist'
    });
  }
});

module.exports = router;