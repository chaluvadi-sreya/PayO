const express = require('express');
const router = express.Router();
const marketController = require('../../controllers/market/marketController');

// Market overview routes
router.get('/overview', marketController.getMarketOverview);


module.exports = router;