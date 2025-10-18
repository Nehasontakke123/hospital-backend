const express = require('express');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Pharmacy
 *   description: Pharmacy management endpoints
 */

// Placeholder routes for pharmacy management
router.get('/', protect, authorize('admin', 'pharmacist'), (req, res) => {
  res.json({
    status: 'success',
    message: 'Pharmacy management module - Coming soon',
    data: []
  });
});

module.exports = router;
