const express = require('express');
const { sendSuccess } = require('../utils/responses');

const router = express.Router();

const endpointGroups = {
  health: ['GET /api/health'],
  auth: ['POST /api/auth/register', 'POST /api/auth/login'],
  products: [
    'GET /api/products',
    'GET /api/products/:id',
    'POST /api/products',
    'PUT /api/products/:id',
    'DELETE /api/products/:id'
  ],
  suppliers: [
    'GET /api/suppliers',
    'GET /api/suppliers/:id',
    'POST /api/suppliers',
    'PUT /api/suppliers/:id',
    'DELETE /api/suppliers/:id'
  ],
  stock: [
    'POST /api/stock/in',
    'POST /api/stock/adjust',
    'GET /api/stock/movements',
    'GET /api/stock/low'
  ],
  sales: ['POST /api/sales', 'GET /api/sales', 'GET /api/sales/:id'],
  reports: [
    'GET /api/reports/summary',
    'GET /api/reports/daily-sales',
    'GET /api/reports/monthly-sales',
    'GET /api/reports/low-stock',
    'GET /api/reports/expiry-alerts'
  ]
};

router.get('/', (req, res) => {
  return sendSuccess(res, 'Welcome to the Medical Supplies Inventory API', {
    service: 'Medical Supplies Inventory API',
    short_name: 'MSI API',
    status: 'ready',
    current_phase: 'Deployment Preparation',
    documentation: 'See README.md for setup, authentication, testing, and deployment instructions.',
    local_urls: {
      api_index: '/',
      health: '/api/health'
    },
    endpoint_groups: endpointGroups
  });
});

router.get('/api', (req, res) => {
  return sendSuccess(res, 'MSI API endpoint overview', {
    service: 'Medical Supplies Inventory API',
    endpoint_groups: endpointGroups,
    auth_note: 'Protected endpoints require Authorization: Bearer <token>.'
  });
});

module.exports = router;
