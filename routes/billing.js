const express = require('express');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Billing
 *   description: Billing and payment endpoints
 */

// Placeholder routes for billing management
router.get('/', protect, authorize('admin', 'receptionist'), (req, res) => {
  res.json({
    status: 'success',
    message: 'Billing management module - Coming soon',
    data: []
  });
});

module.exports = router;
