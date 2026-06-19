const database = require('../utils/db');
const { sendCreated, sendSuccess } = require('../utils/responses');

function parsePositiveInteger(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return parsed;
}

function parseNonNegativeInteger(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be zero or greater.`);
  }

  return parsed;
}

function normalizeCreatedBy(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return parsePositiveInteger(value, 'created_by');
}

async function getProductById(id) {
  return database.get('SELECT * FROM products WHERE id = ?', [id]);
}

async function addStock(req, res, next) {
  try {
    const productId = parsePositiveInteger(req.body.product_id, 'product_id');
    const quantity = parsePositiveInteger(req.body.quantity, 'quantity');
    const createdBy = req.user ? req.user.id : normalizeCreatedBy(req.body.created_by);
    const reason = req.body.reason ? String(req.body.reason).trim() : 'Stock added';

    const product = await getProductById(productId);

    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }

    await database.run('BEGIN TRANSACTION');

    try {
      await database.run(
        `UPDATE products
        SET stock_quantity = stock_quantity + ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [quantity, productId]
      );

      await database.run(
        `INSERT INTO stock_movements (product_id, movement_type, quantity, reason, created_by)
        VALUES (?, 'IN', ?, ?, ?)`,
        [productId, quantity, reason, createdBy]
      );

      await database.run('COMMIT');
    } catch (error) {
      await database.run('ROLLBACK');
      throw error;
    }

    const updatedProduct = await getProductById(productId);
    return sendCreated(res, 'Stock added successfully', {
      product: updatedProduct,
      quantity_added: quantity
    });
  } catch (error) {
    if (error.message.includes('must be')) {
      res.status(400);
    }

    return next(error);
  }
}

async function adjustStock(req, res, next) {
  try {
    const productId = parsePositiveInteger(req.body.product_id, 'product_id');
    const newQuantity = parseNonNegativeInteger(req.body.quantity, 'quantity');
    const createdBy = req.user ? req.user.id : normalizeCreatedBy(req.body.created_by);
    const reason = req.body.reason ? String(req.body.reason).trim() : 'Manual stock adjustment';

    const product = await getProductById(productId);

    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }

    const difference = Math.abs(newQuantity - product.stock_quantity);

    if (difference === 0) {
      res.status(400);
      throw new Error('New stock quantity is the same as the current stock quantity.');
    }

    await database.run('BEGIN TRANSACTION');

    try {
      await database.run(
        `UPDATE products
        SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [newQuantity, productId]
      );

      await database.run(
        `INSERT INTO stock_movements (product_id, movement_type, quantity, reason, created_by)
        VALUES (?, 'ADJUSTMENT', ?, ?, ?)`,
        [
          productId,
          difference,
          `Adjusted from ${product.stock_quantity} to ${newQuantity}. ${reason}`,
          createdBy
        ]
      );

      await database.run('COMMIT');
    } catch (error) {
      await database.run('ROLLBACK');
      throw error;
    }

    const updatedProduct = await getProductById(productId);
    return sendSuccess(res, 'Stock adjusted successfully', {
      product: updatedProduct,
      previous_quantity: product.stock_quantity,
      new_quantity: newQuantity,
      adjustment_quantity: difference
    });
  } catch (error) {
    if (error.message.includes('must be') || error.message.includes('same as')) {
      res.status(400);
    }

    return next(error);
  }
}

async function listStockMovements(req, res, next) {
  try {
    const conditions = [];
    const params = [];

    if (req.query.product_id) {
      conditions.push('stock_movements.product_id = ?');
      params.push(req.query.product_id);
    }

    if (req.query.movement_type) {
      conditions.push('stock_movements.movement_type = ?');
      params.push(String(req.query.movement_type).toUpperCase());
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const movements = await database.all(
      `SELECT
        stock_movements.*,
        products.name AS product_name,
        users.full_name AS created_by_name
      FROM stock_movements
      INNER JOIN products ON products.id = stock_movements.product_id
      LEFT JOIN users ON users.id = stock_movements.created_by
      ${whereClause}
      ORDER BY stock_movements.created_at DESC, stock_movements.id DESC`,
      params
    );

    return sendSuccess(res, 'Stock movements retrieved successfully', movements);
  } catch (error) {
    return next(error);
  }
}

async function listLowStockProducts(req, res, next) {
  try {
    const products = await database.all(
      `SELECT
        products.*,
        suppliers.name AS supplier_name
      FROM products
      LEFT JOIN suppliers ON suppliers.id = products.supplier_id
      WHERE products.stock_quantity <= products.low_stock_level
      ORDER BY products.stock_quantity ASC, products.name ASC`
    );

    return sendSuccess(res, 'Low-stock products retrieved successfully', products);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  addStock,
  adjustStock,
  listStockMovements,
  listLowStockProducts
};
