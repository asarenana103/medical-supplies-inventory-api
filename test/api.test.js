const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const testDbFile = 'database/test.sqlite';
const testDbPath = path.resolve(process.cwd(), testDbFile);

process.env.DB_FILE = testDbFile;
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';

if (fs.existsSync(testDbPath)) {
  fs.rmSync(testDbPath, { force: true });
}

const app = require('../src/app');
const db = require('../src/config/db');

const schema = fs.readFileSync(path.resolve(process.cwd(), 'database/schema.sql'), 'utf8');

function exec(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({
        id: this.lastID,
        changes: this.changes
      });
    });
  });
}

function execSchema() {
  return new Promise((resolve, reject) => {
    db.exec(schema, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function closeDb() {
  return new Promise((resolve, reject) => {
    db.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      resolve(server);
    });
  });
}

function stopServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function request(baseUrl, method, route, options = {}) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json();

  return {
    status: response.status,
    data
  };
}

test('MSI API integration flow', async () => {
  await execSchema();

  const server = await startServer();
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  try {
    const adminRegister = await request(baseUrl, 'POST', '/auth/register', {
      body: {
        full_name: 'Test Admin',
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin'
      }
    });

    assert.equal(adminRegister.status, 201);
    assert.equal(adminRegister.data.data.user.role, 'admin');
    assert.ok(adminRegister.data.data.token);

    const staffRegister = await request(baseUrl, 'POST', '/auth/register', {
      body: {
        full_name: 'Test Staff',
        email: 'staff@example.com',
        password: 'password123',
        role: 'staff'
      }
    });

    assert.equal(staffRegister.status, 201);
    assert.equal(staffRegister.data.data.user.role, 'staff');

    const login = await request(baseUrl, 'POST', '/auth/login', {
      body: {
        email: 'admin@example.com',
        password: 'password123'
      }
    });

    assert.equal(login.status, 200);

    const adminToken = login.data.data.token;
    const staffToken = staffRegister.data.data.token;

    const duplicateRegister = await request(baseUrl, 'POST', '/auth/register', {
      body: {
        full_name: 'Duplicate Admin',
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin'
      }
    });

    assert.equal(duplicateRegister.status, 409);

    const unauthenticatedProducts = await request(baseUrl, 'GET', '/products');
    assert.equal(unauthenticatedProducts.status, 401);

    const supplier = await request(baseUrl, 'POST', '/suppliers', {
      token: adminToken,
      body: {
        name: 'Test Medical Supplier',
        phone: '0240000000',
        email: 'supplier@example.com',
        address: 'Test Address'
      }
    });

    assert.equal(supplier.status, 201);

    const product = await request(baseUrl, 'POST', '/products', {
      token: adminToken,
      body: {
        name: 'Test Glucose Strips',
        category: 'Consumable',
        description: 'Integration test product',
        unit_price: 25,
        cost_price: 10,
        stock_quantity: 10,
        low_stock_level: 5,
        expiry_date: '2026-07-01',
        supplier_id: supplier.data.data.id
      }
    });

    assert.equal(product.status, 201);

    const productId = product.data.data.id;

    const lowStockProduct = await request(baseUrl, 'POST', '/products', {
      token: adminToken,
      body: {
        name: 'Test Low Stock Lancets',
        category: 'Consumable',
        description: 'Integration low-stock product',
        unit_price: 2,
        cost_price: 1,
        stock_quantity: 2,
        low_stock_level: 5,
        expiry_date: '2027-03-20'
      }
    });

    assert.equal(lowStockProduct.status, 201);

    const staffProductRead = await request(baseUrl, 'GET', `/products/${productId}`, {
      token: staffToken
    });

    assert.equal(staffProductRead.status, 200);

    const staffProductCreate = await request(baseUrl, 'POST', '/products', {
      token: staffToken,
      body: {
        name: 'Blocked Product',
        category: 'Consumable',
        unit_price: 1,
        cost_price: 1,
        stock_quantity: 1,
        low_stock_level: 1
      }
    });

    assert.equal(staffProductCreate.status, 403);

    const stockIn = await request(baseUrl, 'POST', '/stock/in', {
      token: adminToken,
      body: {
        product_id: productId,
        quantity: 5,
        reason: 'Integration restock'
      }
    });

    assert.equal(stockIn.status, 201);
    assert.equal(stockIn.data.data.product.stock_quantity, 15);

    const sale = await request(baseUrl, 'POST', '/sales', {
      token: staffToken,
      body: {
        customer_name: 'Integration Customer',
        items: [
          {
            product_id: productId,
            quantity: 3
          }
        ]
      }
    });

    assert.equal(sale.status, 201);
    assert.equal(sale.data.data.total_amount, 75);
    assert.equal(sale.data.data.items.length, 1);

    const productAfterSale = await request(baseUrl, 'GET', `/products/${productId}`, {
      token: adminToken
    });

    assert.equal(productAfterSale.data.data.stock_quantity, 12);

    const insufficientSale = await request(baseUrl, 'POST', '/sales', {
      token: staffToken,
      body: {
        customer_name: 'Too Large Sale',
        items: [
          {
            product_id: productId,
            quantity: 999
          }
        ]
      }
    });

    assert.equal(insufficientSale.status, 400);
    assert.match(insufficientSale.data.message, /Insufficient stock/);

    const productAfterFailedSale = await request(baseUrl, 'GET', `/products/${productId}`, {
      token: adminToken
    });

    assert.equal(productAfterFailedSale.data.data.stock_quantity, 12);

    const staffSalesList = await request(baseUrl, 'GET', '/sales', {
      token: staffToken
    });

    assert.equal(staffSalesList.status, 403);

    const reportsSummary = await request(baseUrl, 'GET', '/reports/summary', {
      token: adminToken
    });

    assert.equal(reportsSummary.status, 200);
    assert.equal(reportsSummary.data.data.today_sales_amount, 75);

    const dailySales = await request(baseUrl, 'GET', '/reports/daily-sales', {
      token: adminToken
    });

    assert.equal(dailySales.status, 200);
    assert.equal(dailySales.data.data.summary.total_sales_amount, 75);

    const monthlySales = await request(baseUrl, 'GET', `/reports/monthly-sales?month=${new Date().toISOString().slice(0, 7)}`, {
      token: adminToken
    });

    assert.equal(monthlySales.status, 200);
    assert.equal(monthlySales.data.data.summary.total_sales_amount, 75);

    const lowStockReport = await request(baseUrl, 'GET', '/reports/low-stock', {
      token: adminToken
    });

    assert.equal(lowStockReport.status, 200);
    assert.ok(lowStockReport.data.data.some((item) => item.name === 'Test Low Stock Lancets'));

    const expiryAlerts = await request(baseUrl, 'GET', '/reports/expiry-alerts?days=30', {
      token: adminToken
    });

    assert.equal(expiryAlerts.status, 200);
    assert.ok(expiryAlerts.data.data.products.some((item) => item.name === 'Test Glucose Strips'));

    const staffReports = await request(baseUrl, 'GET', '/reports/summary', {
      token: staffToken
    });

    assert.equal(staffReports.status, 403);
  } finally {
    await exec('DELETE FROM sales');
    await exec('DELETE FROM products');
    await exec('DELETE FROM suppliers');
    await exec('DELETE FROM users');
    await stopServer(server);
    await closeDb();

    if (fs.existsSync(testDbPath)) {
      fs.rmSync(testDbPath, { force: true });
    }
  }
});
