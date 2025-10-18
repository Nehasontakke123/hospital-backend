const express = require('express');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: EMR
 *   description: Electronic Medical Records endpoints
 */

// Placeholder routes for EMR management
router.get('/', protect, authorize('admin', 'doctor', 'nurse'), (req, res) => {
  res.json({
    status: 'success',
    message: 'EMR management module - Coming soon',
    data: []
  });
});

module.exports = router;
