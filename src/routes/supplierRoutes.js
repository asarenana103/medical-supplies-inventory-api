const express = require('express');
const {
  createSupplier,
  deleteSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier
} = require('../controllers/supplierController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', authorizeRoles('admin', 'manager'), listSuppliers);
router.get('/:id', authorizeRoles('admin', 'manager'), getSupplier);
router.post('/', authorizeRoles('admin', 'manager'), createSupplier);
router.put('/:id', authorizeRoles('admin', 'manager'), updateSupplier);
router.delete('/:id', authorizeRoles('admin'), deleteSupplier);

module.exports = router;
