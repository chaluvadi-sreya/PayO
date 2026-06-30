const coingeckoService = require("./coingeckoService");
const marketCache = require("../cache/marketCache");

async function updateMarketCache() {
  try {

    const [market, trending, global] = await Promise.all([
      coingeckoService.getMarketData("usd", 50),
      coingeckoService.getTrending(),
      coingeckoService.getGlobalData()
    ]);

    marketCache.market = market;
    marketCache.trending = trending;
    marketCache.global = global;
    marketCache.lastUpdated = new Date();

   
  } catch (error) {
    console.error(
      "CoinGecko cache update failed:",
      error.message
    );
  }
}

module.exports = updateMarketCache;