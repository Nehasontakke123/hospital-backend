const express = require('express');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Reports and analytics endpoints
 */

// Placeholder routes for reports management
router.get('/', protect, authorize('admin', 'doctor', 'nurse', 'receptionist'), (req, res) => {
  res.json({
    status: 'success',
    message: 'Reports management module - Coming soon',
    data: []
  });
});

module.exports = router;
