const axios = require('axios');

class CoinGeckoService {

  constructor() {

    this.baseURL =
      process.env.COINGECKO_API_URL ||
      'https://api.coingecko.com/api/v3';

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        Accept: 'application/json'
      }
    });
  }

  // Get top market data
  async getMarketData(
    currency = 'usd',
    perPage = 100,
    page = 1
  ) {

    try {

      const response =
        await this.client.get(
          '/coins/markets',
          {
            params: {
              vs_currency: currency,
              order: 'market_cap_desc',
              per_page: perPage,
              page,
              sparkline: false,
              price_change_percentage: '24h,7d'
            }
          }
        );

      return response.data.map(coin => ({

        id: coin.id,

        symbol:
          coin.symbol.toUpperCase(),

        name: coin.name,

        image: coin.image,

        currentPrice:
          coin.current_price,

        marketCap:
          coin.market_cap,

        marketCapRank:
          coin.market_cap_rank,

        totalVolume:
          coin.total_volume,

        high24h:
          coin.high_24h,

        low24h:
          coin.low_24h,

        priceChange24h:
          coin.price_change_24h,

        priceChangePercentage24h:
          coin.price_change_percentage_24h,

        priceChangePercentage7d:
          coin.price_change_percentage_7d_in_currency,

        circulatingSupply:
          coin.circulating_supply,

        totalSupply:
          coin.total_supply,

        ath:
          coin.ath,

        atl:
          coin.atl,

        lastUpdated:
          coin.last_updated
      }));

    } catch (error) {

      console.error(
        'Market data error:',
        error.response?.data ||
        error.message
      );

      return [];
    }
  }

  // Trending coins
  async getTrending() {

    try {

      const response =
        await this.client.get(
          '/search/trending'
        );

      return response.data.coins.map(
        item => ({

          id: item.item.id,

          name: item.item.name,

          symbol:
            item.item.symbol.toUpperCase(),

          thumb:
            item.item.thumb,

          large:
            item.item.large,

          marketCapRank:
            item.item.market_cap_rank,

          priceBtc:
            item.item.price_btc,

          score:
            item.item.score
        })
      );

    } catch (error) {

      console.error(
        'Trending error:',
        error.response?.data ||
        error.message
      );

      return [];
    }
  }

  // Global market data
  async getGlobalData() {

    try {

      const response =
        await this.client.get('/global');

      const data =
        response.data.data;

      return {

        totalMarketCap:
          data.total_market_cap,

        totalVolume:
          data.total_volume,

        marketCapPercentage:
          data.market_cap_percentage,

        activeCryptocurrencies:
          data.active_cryptocurrencies,

        markets:
          data.markets
      };

    } catch (error) {

      console.error(
        'Global data error:',
        error.response?.data ||
        error.message
      );

      return null;
    }
  }

  // Get coin id from symbol
  async getCoinIdFromSymbol(symbol) {

    try {

      const response =
        await this.client.get(
          '/coins/markets',
          {
            params: {
              vs_currency: 'usd',
              per_page: 250,
              page: 1
            }
          }
        );

      const coin =
        response.data.find(
          c =>
            c.symbol.toLowerCase() ===
            symbol.toLowerCase()
        );

      if (!coin) {
        return null;
      }

      return coin.id;

    } catch (error) {

      console.error(
        'Coin symbol lookup error:',
        error.response?.data ||
        error.message
      );

      return null;
    }
  }

  // Full coin details
  async getCoinFullData(coinId) {

    try {

      const response =
        await this.client.get(
          `/coins/${coinId}`,
          {
            params: {
              localization: false,
              tickers: false,
              market_data: true,
              community_data: true,
              developer_data: true,
              sparkline: true
            }
          }
        );

      const data =
        response.data;

      return {

        id: data.id,

        symbol:
          data.symbol.toUpperCase(),

        name:
          data.name,

        description:
          data.description?.en
            ?.replace(
              /<\/?[^>]+(>|$)/g,
              ''
            )
            ?.slice(0, 1500) || '',

        image:
          data.image?.large,

        banner:
          data.image?.large,

        hashingAlgorithm:
          data.hashing_algorithm,

        genesisDate:
          data.genesis_date,

        sentimentUp:
          data.sentiment_votes_up_percentage || 0,

        sentimentDown:
          data.sentiment_votes_down_percentage || 0,

        marketCapRank:
          data.market_cap_rank,

        marketCap:
          data.market_data?.market_cap?.usd,

        fullyDilutedValuation:
          data.market_data
            ?.fully_diluted_valuation?.usd,

        totalVolume:
          data.market_data
            ?.total_volume?.usd,

        circulatingSupply:
          data.market_data
            ?.circulating_supply,

        totalSupply:
          data.market_data
            ?.total_supply,

        maxSupply:
          data.market_data
            ?.max_supply,

        ath:
          data.market_data?.ath?.usd,

        athChangePercentage:
          data.market_data
            ?.ath_change_percentage?.usd,

        athDate:
          data.market_data
            ?.ath_date?.usd,

        atl:
          data.market_data?.atl?.usd,

        atlDate:
          data.market_data
            ?.atl_date?.usd,

        homepage:
          data.links?.homepage?.[0],

        twitter:
          data.links
            ?.twitter_screen_name,

        telegram:
          data.links
            ?.telegram_channel_identifier,

        github:
          data.links
            ?.repos_url?.github?.[0],

        categories:
          data.categories || [],

        sparkline:
          data.market_data
            ?.sparkline_7d?.price || [],

        lastUpdated:
          data.last_updated
      };

    } catch (error) {

      console.error(
        'Coin full data error:',
        error.response?.data ||
        error.message
      );

      throw error;
    }
  }
}

module.exports =
  new CoinGeckoService();