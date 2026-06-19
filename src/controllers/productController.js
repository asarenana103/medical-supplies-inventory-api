const database = require('../utils/db');
const { sendCreated, sendSuccess } = require('../utils/responses');

const productFields = [
  'name',
  'category',
  'description',
  'unit_price',
  'cost_price',
  'stock_quantity',
  'low_stock_level',
  'expiry_date',
  'supplier_id'
];

function parseOptionalNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? NaN : parsed;
}

function validateProductPayload(payload, isUpdate = false) {
  const errors = [];

  if (!isUpdate || payload.name !== undefined) {
    if (!payload.name || String(payload.name).trim() === '') {
      errors.push('Product name is required.');
    }
  }

  if (!isUpdate || payload.category !== undefined) {
    if (!payload.category || String(payload.category).trim() === '') {
      errors.push('Category is required.');
    }
  }

  const numberFields = ['unit_price', 'cost_price', 'stock_quantity', 'low_stock_level'];

  numberFields.forEach((field) => {
    if (!isUpdate || payload[field] !== undefined) {
      const value = Number(payload[field]);

      if (Number.isNaN(value)) {
        errors.push(`${field} must be a valid number.`);
      } else if (value < 0) {
        errors.push(`${field} must be zero or greater.`);
      }
    }
  });

  if (payload.expiry_date) {
    const date = new Date(payload.expiry_date);
    if (Number.isNaN(date.getTime())) {
      errors.push('Expiry date must be a valid date.');
    }
  }

  if (payload.supplier_id !== undefined && payload.supplier_id !== null && payload.supplier_id !== '') {
    const supplierId = Number(payload.supplier_id);
    if (!Number.isInteger(supplierId) || supplierId <= 0) {
      errors.push('Supplier ID must be a positive integer.');
    }
  }

  return errors;
}

function normalizeProductPayload(payload) {
  return {
    name: payload.name ? String(payload.name).trim() : payload.name,
    category: payload.category ? String(payload.category).trim() : payload.category,
    description: payload.description ? String(payload.description).trim() : null,
    unit_price: Number(payload.unit_price),
    cost_price: Number(payload.cost_price),
    stock_quantity: Number(payload.stock_quantity),
    low_stock_level: Number(payload.low_stock_level),
    expiry_date: payload.expiry_date || null,
    supplier_id: parseOptionalNumber(payload.supplier_id)
  };
}

function buildProductFilters(query) {
  const conditions = [];
  const params = [];

  if (query.search) {
    conditions.push('(products.name LIKE ? OR products.category LIKE ?)');
    params.push(`%${query.search}%`, `%${query.search}%`);
  }

  if (query.category) {
    conditions.push('products.category = ?');
    params.push(query.category);
  }

  if (query.low_stock === 'true') {
    conditions.push('products.stock_quantity <= products.low_stock_level');
  }

  return {
    whereClause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  };
}

async function getProductById(id) {
  return database.get(
    `SELECT
      products.*,
      suppliers.name AS supplier_name
    FROM products
    LEFT JOIN suppliers ON suppliers.id = products.supplier_id
    WHERE products.id = ?`,
    [id]
  );
}

async function listProducts(req, res, next) {
  try {
    const { whereClause, params } = buildProductFilters(req.query);
    const products = await database.all(
      `SELECT
        products.*,
        suppliers.name AS supplier_name
      FROM products
      LEFT JOIN suppliers ON suppliers.id = products.supplier_id
      ${whereClause}
      ORDER BY products.created_at DESC, products.id DESC`,
      params
    );

    return sendSuccess(res, 'Products retrieved successfully', products);
  } catch (error) {
    return next(error);
  }
}

async function getProduct(req, res, next) {
  try {
    const product = await getProductById(req.params.id);

    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }

    return sendSuccess(res, 'Product retrieved successfully', product);
  } catch (error) {
    return next(error);
  }
}

async function createProduct(req, res, next) {
  try {
    const errors = validateProductPayload(req.body);

    if (errors.length) {
      res.status(400);
      throw new Error(errors.join(' '));
    }

    const product = normalizeProductPayload(req.body);

    const result = await database.run(
      `INSERT INTO products (
        name,
        category,
        description,
        unit_price,
        cost_price,
        stock_quantity,
        low_stock_level,
        expiry_date,
        supplier_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      productFields.map((field) => product[field])
    );

    const createdProduct = await getProductById(result.id);
    return sendCreated(res, 'Product added successfully', createdProduct);
  } catch (error) {
    return next(error);
  }
}

async function updateProduct(req, res, next) {
  try {
    const existingProduct = await getProductById(req.params.id);

    if (!existingProduct) {
      res.status(404);
      throw new Error('Product not found');
    }

    const errors = validateProductPayload(req.body, true);

    if (errors.length) {
      res.status(400);
      throw new Error(errors.join(' '));
    }

    const mergedPayload = normalizeProductPayload({
      ...existingProduct,
      ...req.body
    });

    await database.run(
      `UPDATE products
      SET
        name = ?,
        category = ?,
        description = ?,
        unit_price = ?,
        cost_price = ?,
        stock_quantity = ?,
        low_stock_level = ?,
        expiry_date = ?,
        supplier_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [...productFields.map((field) => mergedPayload[field]), req.params.id]
    );

    const updatedProduct = await getProductById(req.params.id);
    return sendSuccess(res, 'Product updated successfully', updatedProduct);
  } catch (error) {
    return next(error);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const existingProduct = await getProductById(req.params.id);

    if (!existingProduct) {
      res.status(404);
      throw new Error('Product not found');
    }

    await database.run('DELETE FROM products WHERE id = ?', [req.params.id]);
    return sendSuccess(res, 'Product deleted successfully');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct
};
