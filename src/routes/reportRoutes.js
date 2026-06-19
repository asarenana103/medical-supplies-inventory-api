const express = require('express');
const {
  getDailySales,
  getExpiryAlerts,
  getLowStockReport,
  getMonthlySales,
  getSummary
} = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect);
router.use(authorizeRoles('admin', 'manager'));

router.get('/summary', getSummary);
router.get('/daily-sales', getDailySales);
router.get('/monthly-sales', getMonthlySales);
router.get('/low-stock', getLowStockReport);
router.get('/expiry-alerts', getExpiryAlerts);

module.exports = router;
