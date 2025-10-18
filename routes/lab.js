const express = require('express');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Lab
 *   description: Laboratory management endpoints
 */

// Placeholder routes for lab management
router.get('/', protect, authorize('admin', 'lab_technician'), (req, res) => {
  res.json({
    status: 'success',
    message: 'Laboratory management module - Coming soon',
    data: []
  });
});

module.exports = router;
