const database = require('../utils/db');
const { sendCreated, sendSuccess } = require('../utils/responses');

function parsePositiveInteger(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return parsed;
}

function normalizeSoldBy(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return parsePositiveInteger(value, 'sold_by');
}

function validateSaleItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Items list is required.');
  }

  const normalizedItems = new Map();

  items.forEach((item, index) => {
    const productId = parsePositiveInteger(item.product_id, `items[${index}].product_id`);
    const quantity = parsePositiveInteger(item.quantity, `items[${index}].quantity`);
    const currentQuantity = normalizedItems.get(productId) || 0;

    normalizedItems.set(productId, currentQuantity + quantity);
  });

  return Array.from(normalizedItems.entries()).map(([productId, quantity]) => ({
    product_id: productId,
    quantity
  }));
}

async function getSaleById(id) {
  const sale = await database.get(
    `SELECT
      sales.*,
      users.full_name AS sold_by_name
    FROM sales
    LEFT JOIN users ON users.id = sales.sold_by
    WHERE sales.id = ?`,
    [id]
  );

  if (!sale) {
    return null;
  }

  sale.items = await database.all(
    `SELECT
      sale_items.*,
      products.name AS product_name,
      products.category AS product_category
    FROM sale_items
    INNER JOIN products ON products.id = sale_items.product_id
    WHERE sale_items.sale_id = ?
    ORDER BY sale_items.id ASC`,
    [id]
  );

  return sale;
}

async function getProductsForSale(items) {
  const products = [];

  for (const item of items) {
    const product = await database.get('SELECT * FROM products WHERE id = ?', [item.product_id]);

    if (!product) {
      const error = new Error(`Product not found: ${item.product_id}`);
      error.statusCode = 404;
      throw error;
    }

    if (product.stock_quantity < item.quantity) {
      const error = new Error(
        `Insufficient stock for ${product.name}. Only ${product.stock_quantity} items available.`
      );
      error.statusCode = 400;
      throw error;
    }

    products.push({
      ...product,
      sale_quantity: item.quantity,
      line_total: item.quantity * product.unit_price
    });
  }

  return products;
}

async function createSale(req, res, next) {
  try {
    const customerName = req.body.customer_name ? String(req.body.customer_name).trim() : null;
    const soldBy = req.user ? req.user.id : normalizeSoldBy(req.body.sold_by);
    const items = validateSaleItems(req.body.items);
    const products = await getProductsForSale(items);
    const totalAmount = products.reduce((total, product) => total + product.line_total, 0);

    await database.run('BEGIN TRANSACTION');

    let saleId;

    try {
      const saleResult = await database.run(
        'INSERT INTO sales (customer_name, total_amount, sold_by) VALUES (?, ?, ?)',
        [customerName, totalAmount, soldBy]
      );

      saleId = saleResult.id;

      for (const product of products) {
        await database.run(
          `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, line_total)
          VALUES (?, ?, ?, ?, ?)`,
          [saleId, product.id, product.sale_quantity, product.unit_price, product.line_total]
        );

        await database.run(
          `UPDATE products
          SET stock_quantity = stock_quantity - ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
          [product.sale_quantity, product.id]
        );

        await database.run(
          `INSERT INTO stock_movements (product_id, movement_type, quantity, reason, created_by)
          VALUES (?, 'OUT', ?, ?, ?)`,
          [product.id, product.sale_quantity, `Sale #${saleId}`, soldBy]
        );
      }

      await database.run('COMMIT');
    } catch (error) {
      await database.run('ROLLBACK');
      throw error;
    }

    const createdSale = await getSaleById(saleId);
    return sendCreated(res, 'Sale recorded successfully', createdSale);
  } catch (error) {
    if (error.statusCode) {
      res.status(error.statusCode);
    } else if (
      error.message.includes('must be') ||
      error.message.includes('Items list') ||
      error.message.includes('Insufficient stock')
    ) {
      res.status(400);
    }

    return next(error);
  }
}

async function listSales(req, res, next) {
  try {
    const conditions = [];
    const params = [];

    if (req.query.from) {
      conditions.push('date(sales.sale_date) >= date(?)');
      params.push(req.query.from);
    }

    if (req.query.to) {
      conditions.push('date(sales.sale_date) <= date(?)');
      params.push(req.query.to);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const sales = await database.all(
      `SELECT
        sales.*,
        users.full_name AS sold_by_name,
        COUNT(sale_items.id) AS item_count
      FROM sales
      LEFT JOIN users ON users.id = sales.sold_by
      LEFT JOIN sale_items ON sale_items.sale_id = sales.id
      ${whereClause}
      GROUP BY sales.id
      ORDER BY sales.sale_date DESC, sales.id DESC`,
      params
    );

    return sendSuccess(res, 'Sales retrieved successfully', sales);
  } catch (error) {
    return next(error);
  }
}

async function getSale(req, res, next) {
  try {
    const sale = await getSaleById(req.params.id);

    if (!sale) {
      res.status(404);
      throw new Error('Sale not found');
    }

    return sendSuccess(res, 'Sale retrieved successfully', sale);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createSale,
  listSales,
  getSale
};
