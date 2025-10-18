const express = require('express');
const { protect, authorize } = require('../middlewares/auth');
const User = require('../models/User');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Doctors
 *   description: Doctor management endpoints
 */

// Get all doctors
router.get('/', protect, authorize('admin', 'receptionist', 'doctor'), async (req, res) => {
  try {
    const doctors = await User.find({ role: 'doctor', isActive: true })
      .select('-password')
      .populate('address');
    
    res.json({
      status: 'success',
      data: { doctors }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching doctors',
      error: error.message
    });
  }
});

// Get doctor by ID
router.get('/:id', protect, authorize('admin', 'receptionist', 'doctor'), async (req, res) => {
  try {
    const doctor = await User.findById(req.params.id)
      .select('-password')
      .populate('address');
    
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({
        status: 'error',
        message: 'Doctor not found'
      });
    }
    
    res.json({
      status: 'success',
      data: { doctor }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching doctor',
      error: error.message
    });
  }
});

module.exports = router;
