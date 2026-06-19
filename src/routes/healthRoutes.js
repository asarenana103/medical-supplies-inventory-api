const express = require('express');
const { sendSuccess } = require('../utils/responses');

const router = express.Router();

router.get('/', (req, res) => {
  return sendSuccess(res, 'MSI API is running', {
    service: 'Medical Supplies Inventory API',
    phase: 'Deployment Preparation'
  });
});

module.exports = router;
