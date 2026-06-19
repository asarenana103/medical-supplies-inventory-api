const database = require('../utils/db');
const { sendSuccess } = require('../utils/responses');

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentYearMonth() {
  return new Date().toISOString().slice(0, 7);
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function getSummary(req, res, next) {
  try {
    const productSummary = await database.get(
      `SELECT
        COUNT(id) AS total_products,
        COALESCE(SUM(stock_quantity), 0) AS total_stock_quantity,
        COALESCE(SUM(stock_quantity * cost_price), 0) AS total_stock_cost_value,
        COALESCE(SUM(stock_quantity * unit_price), 0) AS total_stock_retail_value,
        COALESCE(SUM(CASE WHEN stock_quantity <= low_stock_level THEN 1 ELSE 0 END), 0) AS low_stock_count,
        COALESCE(SUM(CASE WHEN expiry_date IS NOT NULL AND date(expiry_date) < date('now') THEN 1 ELSE 0 END), 0) AS expired_product_count
      FROM products`
    );

    const salesSummary = await database.get(
      `SELECT
        COUNT(id) AS total_sales_count,
        COALESCE(SUM(total_amount), 0) AS total_sales_amount,
        COALESCE(SUM(CASE WHEN date(sale_date) = date('now') THEN total_amount ELSE 0 END), 0) AS today_sales_amount,
        COALESCE(SUM(CASE WHEN date(sale_date) = date('now') THEN 1 ELSE 0 END), 0) AS today_sales_count
      FROM sales`
    );

    return sendSuccess(res, 'Inventory summary retrieved successfully', {
      ...productSummary,
      ...salesSummary
    });
  } catch (error) {
    return next(error);
  }
}

async function getDailySales(req, res, next) {
  try {
    const date = req.query.date || getToday();
    const summary = await database.get(
      `SELECT
        date(?) AS sale_day,
        COUNT(sales.id) AS sales_count,
        COALESCE(SUM(sales.total_amount), 0) AS total_sales_amount,
        COALESCE(SUM(sale_items.quantity), 0) AS total_items_sold
      FROM sales
      LEFT JOIN sale_items ON sale_items.sale_id = sales.id
      WHERE date(sales.sale_date) = date(?)`,
      [date, date]
    );

    const sales = await database.all(
      `SELECT
        sales.id,
        sales.customer_name,
        sales.total_amount,
        sales.sale_date,
        users.full_name AS sold_by_name,
        COUNT(sale_items.id) AS item_count
      FROM sales
      LEFT JOIN users ON users.id = sales.sold_by
      LEFT JOIN sale_items ON sale_items.sale_id = sales.id
      WHERE date(sales.sale_date) = date(?)
      GROUP BY sales.id
      ORDER BY sales.sale_date DESC, sales.id DESC`,
      [date]
    );

    return sendSuccess(res, 'Daily sales report retrieved successfully', {
      summary,
      sales
    });
  } catch (error) {
    return next(error);
  }
}

async function getMonthlySales(req, res, next) {
  try {
    const month = req.query.month || getCurrentYearMonth();
    const summary = await database.get(
      `SELECT
        ? AS sales_month,
        COUNT(id) AS sales_count,
        COALESCE(SUM(total_amount), 0) AS total_sales_amount
      FROM sales
      WHERE strftime('%Y-%m', sale_date) = ?`,
      [month, month]
    );

    const dailyBreakdown = await database.all(
      `SELECT
        date(sales.sale_date) AS sale_day,
        COUNT(DISTINCT sales.id) AS sales_count,
        COALESCE(SUM(sales.total_amount), 0) AS total_sales_amount,
        COALESCE(SUM(sale_items.quantity), 0) AS total_items_sold
      FROM sales
      LEFT JOIN sale_items ON sale_items.sale_id = sales.id
      WHERE strftime('%Y-%m', sales.sale_date) = ?
      GROUP BY date(sales.sale_date)
      ORDER BY sale_day ASC`,
      [month]
    );

    return sendSuccess(res, 'Monthly sales report retrieved successfully', {
      summary,
      daily_breakdown: dailyBreakdown
    });
  } catch (error) {
    return next(error);
  }
}

async function getLowStockReport(req, res, next) {
  try {
    const products = await database.all(
      `SELECT
        products.*,
        suppliers.name AS supplier_name,
        (products.low_stock_level - products.stock_quantity) AS restock_gap
      FROM products
      LEFT JOIN suppliers ON suppliers.id = products.supplier_id
      WHERE products.stock_quantity <= products.low_stock_level
      ORDER BY restock_gap DESC, products.stock_quantity ASC, products.name ASC`
    );

    return sendSuccess(res, 'Low-stock report retrieved successfully', products);
  } catch (error) {
    return next(error);
  }
}

async function getExpiryAlerts(req, res, next) {
  try {
    const days = parsePositiveInteger(req.query.days, 30);
    const products = await database.all(
      `SELECT
        products.*,
        suppliers.name AS supplier_name,
        CAST(julianday(products.expiry_date) - julianday(date('now')) AS INTEGER) AS days_until_expiry,
        CASE
          WHEN date(products.expiry_date) < date('now') THEN 'expired'
          ELSE 'expiring_soon'
        END AS expiry_status
      FROM products
      LEFT JOIN suppliers ON suppliers.id = products.supplier_id
      WHERE products.expiry_date IS NOT NULL
        AND date(products.expiry_date) <= date('now', ?)
      ORDER BY date(products.expiry_date) ASC, products.name ASC`,
      [`+${days} day`]
    );

    return sendSuccess(res, 'Expiry alert report retrieved successfully', {
      alert_window_days: days,
      products
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getSummary,
  getDailySales,
  getMonthlySales,
  getLowStockReport,
  getExpiryAlerts
};
