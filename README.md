# Medical Supplies Inventory API

MSI API is a Node.js, Express, and SQLite backend for managing medical supplies, suppliers, stock movements, sales, authentication, and reports.

## Current Phase

Completed through Phase 10: Deployment Preparation

- Express server scaffold
- SQLite database schema
- Database initialization script
- Shared middleware and response helpers
- Health check endpoint
- Product CRUD endpoints
- Supplier CRUD endpoints
- Stock-in, stock adjustment, stock movement, and low-stock endpoints
- Sales endpoints with automatic total calculation and stock reduction
- User registration, login, JWT authentication, protected routes, and role permissions
- Inventory summary, sales, low-stock, and expiry alert reports
- Automated integration tests for authentication, authorization, product, stock, sales, and report flows
- Browser-friendly API index route and deployment configuration

## Getting Started

```bash
npm install
npm run init-db
npm run dev
```

The API starts on `http://localhost:5000` by default.

## Viewing the Finished API

This project is a backend API, so the result is viewed through API responses rather than a visual dashboard.

After starting the server, open these URLs in your browser:

- `http://localhost:5000/` shows the API overview.
- `http://localhost:5000/api` shows grouped endpoint lists.
- `http://localhost:5000/api/health` shows the server health status.

For protected endpoints, use Postman, Thunder Client, Insomnia, or a frontend app:

1. Register an admin with `POST /api/auth/register`.
2. Copy the returned token.
3. Send protected requests with `Authorization: Bearer <token>`.

## Scripts

- `npm run dev` starts the server with nodemon.
- `npm start` starts the server with Node.
- `npm run init-db` creates the SQLite database schema.
- `npm test` runs the automated integration test suite.

## Health Check

```http
GET /api/health
```

Example response:

```json
{
  "success": true,
  "message": "MSI API is running",
  "data": {
    "service": "Medical Supplies Inventory API"
  }
}
```

## API Overview

```http
GET /
GET /api
```

These public endpoints summarize the available modules and route groups.

## Authentication

```http
POST /api/auth/register
POST /api/auth/login
```

Register a user:

```json
{
  "full_name": "Daniel Opare",
  "email": "daniel@example.com",
  "password": "password123",
  "role": "admin"
}
```

Log in:

```json
{
  "email": "daniel@example.com",
  "password": "password123"
}
```

Protected endpoints require a bearer token:

```http
Authorization: Bearer <token>
```

Roles:

- `admin` can manage products, suppliers, stock, and view sales.
- `manager` can manage products, suppliers, stock, and view sales, but cannot delete products or suppliers.
- `staff` can view products, view low-stock items, and record sales.

## Product Endpoints

```http
GET    /api/products
GET    /api/products/:id
POST   /api/products
PUT    /api/products/:id
DELETE /api/products/:id
```

Query filters:

- `GET /api/products?search=strips`
- `GET /api/products?category=Consumable`
- `GET /api/products?low_stock=true`

## Supplier Endpoints

```http
GET    /api/suppliers
GET    /api/suppliers/:id
POST   /api/suppliers
PUT    /api/suppliers/:id
DELETE /api/suppliers/:id
```

Query filter:

- `GET /api/suppliers?search=medical`

## Stock Endpoints

```http
POST /api/stock/in
POST /api/stock/adjust
GET  /api/stock/movements
GET  /api/stock/low
```

`POST /api/stock/in` adds quantity to current stock:

```json
{
  "product_id": 1,
  "quantity": 10,
  "reason": "New stock received"
}
```

`POST /api/stock/adjust` sets the final corrected stock quantity:

```json
{
  "product_id": 1,
  "quantity": 8,
  "reason": "Manual stock correction"
}
```

## Sales Endpoints

```http
POST /api/sales
GET  /api/sales
GET  /api/sales/:id
```

`POST /api/sales` records a sale with one or more products. The API calculates the total amount from product prices, reduces stock automatically, saves sale items, and records `OUT` stock movements.

```json
{
  "customer_name": "Unity Hall Screening Team",
  "items": [
    {
      "product_id": 1,
      "quantity": 2
    },
    {
      "product_id": 3,
      "quantity": 1
    }
  ]
}
```

Optional sale list filters:

- `GET /api/sales?from=2026-06-01`
- `GET /api/sales?to=2026-06-30`
- `GET /api/sales?from=2026-06-01&to=2026-06-30`

## Report Endpoints

Reports require an `admin` or `manager` bearer token.

```http
GET /api/reports/summary
GET /api/reports/daily-sales
GET /api/reports/monthly-sales
GET /api/reports/low-stock
GET /api/reports/expiry-alerts
```

Optional report filters:

- `GET /api/reports/daily-sales?date=2026-06-18`
- `GET /api/reports/monthly-sales?month=2026-06`
- `GET /api/reports/expiry-alerts?days=30`

## Testing

Run the test suite:

```bash
npm test
```

The tests use an isolated SQLite file at `database/test.sqlite`, then remove it after the run. The current suite verifies:

- user registration and login
- duplicate email handling
- protected route `401` behavior
- role permission `403` behavior
- supplier and product creation
- stock-in updates
- sale creation, total calculation, and automatic stock reduction
- insufficient-stock rejection
- sales and report access rules
- summary, daily sales, monthly sales, low-stock, and expiry report endpoints

## Environment Variables

Create a local `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Required variables:

- `NODE_ENV` sets the runtime environment.
- `PORT` sets the server port.
- `DB_FILE` sets the SQLite database file path.
- `JWT_SECRET` signs authentication tokens.
- `JWT_EXPIRES_IN` controls token lifetime.

Use a strong private `JWT_SECRET` before deploying.

## Deployment

The project includes:

- `Procfile` for platforms that detect process commands.
- `render.yaml` for Render-style deployment.

General deployment settings:

- Install command: `npm install`
- Start command: `npm start`
- Health check path: `/api/health`
- Node entry file: `src/server.js`

Before first use on a new host, initialize the database:

```bash
npm run init-db
```

SQLite deployment note: use persistent storage for the `database/` folder. Without persistent disk storage, hosted data may be lost when the service restarts or redeploys.
