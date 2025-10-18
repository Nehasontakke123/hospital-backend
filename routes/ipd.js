const express = require('express');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: IPD
 *   description: Inpatient management endpoints
 */

// Placeholder routes for IPD management
router.get('/', protect, authorize('admin', 'doctor', 'nurse'), (req, res) => {
  res.json({
    status: 'success',
    message: 'IPD management module - Coming soon',
    data: []
  });
});

module.exports = router;
