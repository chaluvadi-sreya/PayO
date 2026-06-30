
class RealtimePriceCache {
  constructor() {
    this.prices = new Map();
    this.lastUpdate = null;
    this.updateCallbacks = [];
  }

  updatePrices(marketData) {
    Object.keys(marketData).forEach(symbol => {
      this.prices.set(symbol, marketData[symbol]);
    });
    this.lastUpdate = Date.now();
    
    // Notify all subscribers of price updates
    this.updateCallbacks.forEach(callback => {
      callback(marketData);
    });
  }

  getPrice(symbol) {
    return this.prices.get(symbol);
  }

  getAllPrices() {
    return Array.from(this.prices.values());
  }

  subscribe(callback) {
    this.updateCallbacks.push(callback);
    return () => {
      const index = this.updateCallbacks.indexOf(callback);
      if (index > -1) this.updateCallbacks.splice(index, 1);
    };
  }

  // Get prices filtered by symbols
  getFilteredPrices(symbols = null) {
    if (!symbols || symbols.length === 0) {
      return this.getAllPrices();
    }
    
    return symbols
      .map(s => this.prices.get(s))
      .filter(p => p !== undefined);
  }
}

module.exports = new RealtimePriceCache();