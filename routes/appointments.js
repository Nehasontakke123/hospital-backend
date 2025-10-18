const express = require('express');
const { protect, authorize } = require('../middlewares/auth');
const Appointment = require('../models/Appointment');
const User = require('../models/User');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Appointments
 *   description: Appointment management endpoints
 */

// Get all appointments
router.get('/', protect, authorize('admin', 'doctor', 'nurse', 'receptionist'), async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, date, doctorId, patientId } = req.query;
    
    // Build filter object
    const filter = {};
    
    if (status) filter.status = status;
    if (doctorId) filter.doctor = doctorId;
    if (patientId) filter.patient = patientId;
    
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      filter.appointmentDate = { $gte: startDate, $lte: endDate };
    }
    
    // Search functionality
    if (search) {
      const patients = await User.find({
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ],
        role: 'patient'
      }).select('_id');
      
      filter.patient = { $in: patients.map(p => p._id) };
    }
    
    const appointments = await Appointment.find(filter)
      .populate('patient', 'firstName lastName email phone patientId')
      .populate('doctor', 'firstName lastName email specialization')
      .populate('createdBy', 'firstName lastName')
      .sort({ appointmentDate: 1, appointmentTime: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Appointment.countDocuments(filter);
    
    res.json({
      status: 'success',
      data: {
        appointments,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching appointments',
      error: error.message
    });
  }
});

// Create new appointment
router.post('/', protect, authorize('admin', 'receptionist'), async (req, res) => {
  try {
    const {
      patientId,
      doctorId,
      appointmentDate,
      appointmentTime,
      reason,
      type = 'consultation',
      priority = 'normal',
      duration = 30,
      notes
    } = req.body;
    
    // Validate required fields
    if (!patientId || !doctorId || !appointmentDate || !appointmentTime || !reason) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: patientId, doctorId, appointmentDate, appointmentTime, reason'
      });
    }
    
    // Check if patient exists
    const patient = await User.findById(patientId);
    if (!patient || patient.role !== 'patient') {
      return res.status(404).json({
        status: 'error',
        message: 'Patient not found'
      });
    }
    
    // Check if doctor exists
    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({
        status: 'error',
        message: 'Doctor not found'
      });
    }
    
    // Check doctor availability
    const isAvailable = await Appointment.checkDoctorAvailability(
      doctorId,
      appointmentDate,
      appointmentTime,
      duration
    );
    
    if (!isAvailable) {
      return res.status(400).json({
        status: 'error',
        message: 'Doctor is not available at the requested time'
      });
    }
    
    // Create appointment
    const appointment = new Appointment({
      patient: patientId,
      doctor: doctorId,
      department: doctor.specialization || 'General',
      appointmentDate: new Date(appointmentDate),
      appointmentTime,
      duration,
      type,
      priority,
      reason,
      notes,
      createdBy: req.user.id,
      status: 'scheduled'
    });
    
    await appointment.save();
    
    // Populate the appointment with patient and doctor details
    await appointment.populate([
      { path: 'patient', select: 'firstName lastName email phone patientId' },
      { path: 'doctor', select: 'firstName lastName email specialization' },
      { path: 'createdBy', select: 'firstName lastName' }
    ]);
    
    res.status(201).json({
      status: 'success',
      message: 'Appointment created successfully',
      data: { appointment }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error creating appointment',
      error: error.message
    });
  }
});

// Get appointment by ID
router.get('/:id', protect, authorize('admin', 'doctor', 'nurse', 'receptionist'), async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patient', 'firstName lastName email phone patientId')
      .populate('doctor', 'firstName lastName email specialization')
      .populate('createdBy', 'firstName lastName');
    
    if (!appointment) {
      return res.status(404).json({
        status: 'error',
        message: 'Appointment not found'
      });
    }
    
    res.json({
      status: 'success',
      data: { appointment }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching appointment',
      error: error.message
    });
  }
});

// Update appointment
router.put('/:id', protect, authorize('admin', 'receptionist'), async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({
        status: 'error',
        message: 'Appointment not found'
      });
    }
    
    // Update appointment
    Object.assign(appointment, req.body);
    appointment.updatedBy = req.user.id;
    
    await appointment.save();
    
    await appointment.populate([
      { path: 'patient', select: 'firstName lastName email phone patientId' },
      { path: 'doctor', select: 'firstName lastName email specialization' },
      { path: 'createdBy', select: 'firstName lastName' }
    ]);
    
    res.json({
      status: 'success',
      message: 'Appointment updated successfully',
      data: { appointment }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error updating appointment',
      error: error.message
    });
  }
});

// Cancel appointment
router.patch('/:id/cancel', protect, authorize('admin', 'receptionist'), async (req, res) => {
  try {
    const { cancellationReason } = req.body;
    
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({
        status: 'error',
        message: 'Appointment not found'
      });
    }
    
    appointment.status = 'cancelled';
    appointment.cancelledBy = req.user.id;
    appointment.cancellationReason = cancellationReason;
    appointment.cancelledAt = new Date();
    
    await appointment.save();
    
    res.json({
      status: 'success',
      message: 'Appointment cancelled successfully',
      data: { appointment }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error cancelling appointment',
      error: error.message
    });
  }
});

// Complete appointment
router.patch('/:id/complete', protect, authorize('admin', 'doctor'), async (req, res) => {
  try {
    const { diagnosis, treatment, prescription, notes } = req.body;
    
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({
        status: 'error',
        message: 'Appointment not found'
      });
    }
    
    appointment.status = 'completed';
    appointment.diagnosis = diagnosis;
    appointment.treatment = treatment;
    appointment.prescription = prescription;
    appointment.doctorNotes = notes;
    appointment.updatedBy = req.user.id;
    
    await appointment.save();
    
    res.json({
      status: 'success',
      message: 'Appointment completed successfully',
      data: { appointment }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error completing appointment',
      error: error.message
    });
  }
});

module.exports = router;
