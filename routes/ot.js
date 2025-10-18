const express = require('express');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: OT
 *   description: Operation Theatre management endpoints
 */

// Placeholder routes for OT management
router.get('/', protect, authorize('admin', 'doctor'), (req, res) => {
  res.json({
    status: 'success',
    message: 'OT management module - Coming soon',
    data: []
  });
});

module.exports = router;
