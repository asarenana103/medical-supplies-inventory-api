const express = require('express');
const {
  createSale,
  getSale,
  listSales
} = require('../controllers/salesController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect);

router.post('/', authorizeRoles('admin', 'manager', 'staff'), createSale);
router.get('/', authorizeRoles('admin', 'manager'), listSales);
router.get('/:id', authorizeRoles('admin', 'manager'), getSale);

module.exports = router;
