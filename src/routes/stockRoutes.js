const express = require('express');
const {
  addStock,
  adjustStock,
  listLowStockProducts,
  listStockMovements
} = require('../controllers/stockController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect);

router.post('/in', authorizeRoles('admin', 'manager'), addStock);
router.post('/adjust', authorizeRoles('admin', 'manager'), adjustStock);
router.get('/movements', authorizeRoles('admin', 'manager'), listStockMovements);
router.get('/low', authorizeRoles('admin', 'manager', 'staff'), listLowStockProducts);

module.exports = router;
