const express = require('express');
const router = express.Router();
const {
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  addVitals,
  generateAIHealthSummary,
  getHealthTrends,
  getPatientsWithActiveAlerts,
  acknowledgeHealthAlert,
  deletePatient
} = require('../controllers/patientController');
const { protect, authorize } = require('../middlewares/auth');
const { body } = require('express-validator');

/**
 * @swagger
 * tags:
 *   name: Patients
 *   description: Advanced Patient management with AI features
 */

// Validation middleware
const validatePatient = [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('age').isNumeric().isInt({ min: 0, max: 150 }).withMessage('Age must be between 0-150'),
  body('address').notEmpty().withMessage('Address is required'),
  body('bloodGroup').isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).withMessage('Valid blood group is required'),
  body('contactNumber').notEmpty().withMessage('Contact number is required'),
  body('disease').notEmpty().withMessage('Health issue/disease is required'),
  body('emergencyContactName').notEmpty().withMessage('Emergency contact name is required'),
  body('emergencyContactNumber').notEmpty().withMessage('Emergency contact number is required'),
  body('compounderContactNumber').notEmpty().withMessage('Compounder contact number is required'),
  body('height').optional({ nullable: true, checkFalsy: true }).isNumeric().isFloat({ min: 50, max: 300 }).withMessage('Height must be between 50-300 cm'),
  body('weight').optional({ nullable: true, checkFalsy: true }).isNumeric().isFloat({ min: 1, max: 500 }).withMessage('Weight must be between 1-500 kg')
];

const validateVitals = [
  body('bloodPressure.systolic').optional().isNumeric().isFloat({ min: 50, max: 300 }),
  body('bloodPressure.diastolic').optional().isNumeric().isFloat({ min: 30, max: 200 }),
  body('heartRate').optional().isNumeric().isFloat({ min: 30, max: 200 }),
  body('temperature').optional().isNumeric().isFloat({ min: 30, max: 45 }),
  body('bloodSugar').optional().isNumeric().isFloat({ min: 50, max: 500 }),
  body('oxygenSaturation').optional().isNumeric().isFloat({ min: 70, max: 100 })
];

// @route   GET /api/patients
// @desc    Get all patients with advanced filtering and pagination
// @access  Private (Admin, Doctor, Nurse, Receptionist)
router.get('/', protect, authorize('admin', 'doctor', 'nurse', 'receptionist'), getAllPatients);

// @route   GET /api/patients/alerts/active
// @desc    Get patients with active health alerts
// @access  Private (Doctor, Nurse, Admin)
router.get('/alerts/active', protect, authorize('admin', 'doctor', 'nurse'), getPatientsWithActiveAlerts);

// @route   GET /api/patients/:id
// @desc    Get patient by ID with full details
// @access  Private (Admin, Doctor, Nurse, Receptionist, Patient)
router.get('/:id', protect, authorize('admin', 'doctor', 'nurse', 'receptionist', 'patient'), getPatientById);

// @route   GET /api/patients/:id/trends
// @desc    Get health trends for a patient
// @access  Private (Doctor, Nurse, Patient)
router.get('/:id/trends', protect, authorize('admin', 'doctor', 'nurse', 'patient'), getHealthTrends);

// @route   POST /api/patients
// @desc    Create new patient with QR code generation
// @access  Private (Admin, Receptionist)
router.post('/', protect, authorize('admin', 'receptionist'), validatePatient, createPatient);

// @route   POST /api/patients/:id/vitals
// @desc    Add vitals with health alert checking
// @access  Private (Doctor, Nurse)
router.post('/:id/vitals', protect, authorize('admin', 'doctor', 'nurse'), validateVitals, addVitals);

// @route   POST /api/patients/:id/ai-summary
// @desc    Generate AI health summary
// @access  Private (Doctor, Admin)
router.post('/:id/ai-summary', protect, authorize('admin', 'doctor'), generateAIHealthSummary);

// @route   PUT /api/patients/:id
// @desc    Update patient information
// @access  Private (Admin, Doctor, Nurse, Receptionist)
router.put('/:id', protect, authorize('admin', 'doctor', 'nurse', 'receptionist'), validatePatient, updatePatient);

// @route   PUT /api/patients/:id/alerts/:alertId/acknowledge
// @desc    Acknowledge health alert
// @access  Private (Doctor, Nurse, Admin)
router.put('/:id/alerts/:alertId/acknowledge', protect, authorize('admin', 'doctor', 'nurse'), acknowledgeHealthAlert);

// @route   DELETE /api/patients/:id
// @desc    Delete patient (soft delete)
// @access  Private (Admin)
router.delete('/:id', protect, authorize('admin'), deletePatient);

module.exports = router;