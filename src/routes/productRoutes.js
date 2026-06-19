const express = require('express');
const {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct
} = require('../controllers/productController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', authorizeRoles('admin', 'manager', 'staff'), listProducts);
router.get('/:id', authorizeRoles('admin', 'manager', 'staff'), getProduct);
router.post('/', authorizeRoles('admin', 'manager'), createProduct);
router.put('/:id', authorizeRoles('admin', 'manager'), updateProduct);
router.delete('/:id', authorizeRoles('admin'), deleteProduct);

module.exports = router;
