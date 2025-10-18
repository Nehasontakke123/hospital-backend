const Patient = require('../models/Patient');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const QRCode = require('qrcode');
const OpenAI = require('openai');
const nodemailer = require('nodemailer');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key'
});

// Initialize Twilio (optional)
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  const twilio = require('twilio');
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
}

// Email transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// @desc    Get all patients
// @route   GET /api/patients
// @access  Private (Admin, Doctor, Nurse, Receptionist)
const getAllPatients = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      bloodGroup = '',
      isActive = true,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = { isActive };
    
    if (search) {
      query.$or = [
        { patientId: { $regex: search, $options: 'i' } },
        { 'user.firstName': { $regex: search, $options: 'i' } },
        { 'user.lastName': { $regex: search, $options: 'i' } },
        { 'user.email': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (bloodGroup) {
      query.bloodType = bloodGroup;
    }

    const patients = await Patient.find(query)
      .populate('user', 'firstName lastName email phone dateOfBirth')
      .populate('visits.doctor', 'firstName lastName')
      .populate('vitalsHistory.recordedBy', 'firstName lastName')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Patient.countDocuments(query);

    res.json({
      status: 'success',
      data: {
        patients,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalPatients: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching patients',
      error: error.message
    });
  }
};

// @desc    Get patient by ID
// @route   GET /api/patients/:id
// @access  Private (Admin, Doctor, Nurse, Receptionist, Patient)
const getPatientById = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id)
      .populate('user', 'firstName lastName email phone dateOfBirth')
      .populate('visits.doctor', 'firstName lastName specialization')
      .populate('vitalsHistory.recordedBy', 'firstName lastName')
      .populate('healthAlerts.acknowledgedBy', 'firstName lastName');

    if (!patient) {
      return res.status(404).json({
        status: 'error',
        message: 'Patient not found'
      });
    }

    // Check if user can access this patient's data
    if (req.user.role === 'patient' && patient.user._id.toString() !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied'
      });
    }

    res.json({
      status: 'success',
      data: { patient }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching patient',
      error: error.message
    });
  }
};

// @desc    Create new patient
// @route   POST /api/patients
// @access  Private (Admin, Receptionist)
const createPatient = async (req, res) => {
  try {
    console.log('Received patient data:', req.body);
    console.log('Request body keys:', Object.keys(req.body));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      console.log('Detailed validation errors:');
      errors.array().forEach((error, index) => {
        console.log(`${index + 1}. Field: ${error.path}, Value: ${error.value}, Message: ${error.msg}`);
      });
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      firstName,
      lastName,
      age,
      address,
      bloodGroup,
      contactNumber,
      disease,
      emergencyContactName,
      emergencyContactNumber,
      compounderContactNumber,
      height,
      weight,
      medicalHistory,
      allergies,
      medications,
      insurance
    } = req.body;

    // Generate unique patient ID
    const patientId = `P${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Create a new user for the patient if not provided
    let user;
    try {
      // Check if a user with this contact number already exists
      user = await User.findOne({ phone: contactNumber });
      
      if (!user) {
        // Create new user for the patient
        user = new User({
          firstName,
          lastName,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@patient.hms`,
          password: 'Patient123!', // Default password for patients
          phone: contactNumber,
          role: 'patient',
          dateOfBirth: new Date(Date.now() - (age * 365 * 24 * 60 * 60 * 1000)), // Calculate DOB from age
          gender: 'other', // Default gender
          address: address,
          isActive: true
        });
        await user.save();
      }
    } catch (error) {
      console.error('Error creating user for patient:', error);
      return res.status(400).json({
        status: 'error',
        message: 'Error creating user for patient',
        details: error.message
      });
    }

    // Check if patient already exists for this user
    const existingPatient = await Patient.findOne({ user: user._id });
    if (existingPatient) {
      return res.status(400).json({
        status: 'error',
        message: 'Patient record already exists for this user'
      });
    }

    const patient = new Patient({
      user: user._id,
      patientId,
      firstName,
      lastName,
      age,
      address,
      bloodGroup,
      contactNumber,
      disease,
      emergencyContactName,
      emergencyContactNumber,
      compounderContactNumber,
      weight,
      medicalHistory: medicalHistory || [],
      allergies: allergies || [],
      medications: medications || [],
      insurance: insurance || {}
    });

    await patient.save();

    // Generate QR code
    const qrData = patient.generateQRData();
    const qrCode = await QRCode.toDataURL(JSON.stringify(qrData));
    patient.qrCode = qrCode;
    await patient.save();

    // Populate user data
    await patient.populate('user', 'firstName lastName email phone dateOfBirth');

    res.status(201).json({
      status: 'success',
      message: 'Patient created successfully',
      data: { patient }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error creating patient',
      error: error.message
    });
  }
};

// @desc    Update patient
// @route   PUT /api/patients/:id
// @access  Private (Admin, Doctor, Nurse, Receptionist)
const updatePatient = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({
        status: 'error',
        message: 'Patient not found'
      });
    }

    const {
      bloodType,
      height,
      weight,
      medicalHistory,
      allergies,
      medications,
      insurance
    } = req.body;

    // Update patient data
    Object.assign(patient, {
      bloodType,
      height,
      weight,
      medicalHistory: medicalHistory || patient.medicalHistory,
      allergies: allergies || patient.allergies,
      medications: medications || patient.medications,
      insurance: insurance || patient.insurance
    });

    await patient.save();

    // Regenerate QR code if needed
    const qrData = patient.generateQRData();
    const qrCode = await QRCode.toDataURL(JSON.stringify(qrData));
    patient.qrCode = qrCode;
    await patient.save();

    await patient.populate('user', 'firstName lastName email phone dateOfBirth');

    res.json({
      status: 'success',
      message: 'Patient updated successfully',
      data: { patient }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error updating patient',
      error: error.message
    });
  }
};

// @desc    Add vitals to patient
// @route   POST /api/patients/:id/vitals
// @access  Private (Doctor, Nurse)
const addVitals = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({
        status: 'error',
        message: 'Patient not found'
      });
    }

    const vitalsData = req.body;
    const recordedBy = req.user.id;

    // Add vitals to history
    await patient.addVitals(vitalsData, recordedBy);

    // Check for health alerts
    const alerts = patient.checkHealthAlerts(vitalsData);
    
    if (alerts.length > 0) {
      await patient.save();
      
      // Send alerts to doctor
      await sendHealthAlerts(patient, alerts);
    }

    res.json({
      status: 'success',
      message: 'Vitals recorded successfully',
      data: {
        vitals: vitalsData,
        alerts: alerts.length > 0 ? alerts : null
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error recording vitals',
      error: error.message
    });
  }
};

// @desc    Generate AI Health Summary
// @route   POST /api/patients/:id/ai-summary
// @access  Private (Doctor, Admin)
const generateAIHealthSummary = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id)
      .populate('user', 'firstName lastName')
      .populate('visits.doctor', 'firstName lastName');

    if (!patient) {
      return res.status(404).json({
        status: 'error',
        message: 'Patient not found'
      });
    }

    // Prepare data for AI analysis
    const patientData = {
      name: `${patient.user.firstName} ${patient.user.lastName}`,
      age: patient.age,
      bloodType: patient.bloodType,
      medicalHistory: patient.medicalHistory,
      allergies: patient.allergies,
      medications: patient.medications,
      vitalsHistory: patient.vitalsHistory.slice(-10), // Last 10 vitals
      visits: patient.visits.slice(-5) // Last 5 visits
    };

    // Generate AI summary
    const prompt = `Analyze the following patient data and provide a comprehensive health summary, risk factors, and recommendations:

Patient Data: ${JSON.stringify(patientData)}

Please provide:
1. A concise health summary
2. Key risk factors
3. Specific recommendations for care

Format the response as JSON with fields: summary, riskFactors (array), recommendations (array)`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content);

    // Update patient with AI summary
    patient.aiHealthSummary = {
      summary: aiResponse.summary,
      riskFactors: aiResponse.riskFactors,
      recommendations: aiResponse.recommendations,
      generatedAt: new Date()
    };

    await patient.save();

    res.json({
      status: 'success',
      message: 'AI health summary generated successfully',
      data: { aiHealthSummary: patient.aiHealthSummary }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error generating AI health summary',
      error: error.message
    });
  }
};

// @desc    Get health trends
// @route   GET /api/patients/:id/trends
// @access  Private (Doctor, Nurse, Patient)
const getHealthTrends = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const trends = await Patient.getHealthTrends(req.params.id, parseInt(days));

    if (!trends) {
      return res.status(404).json({
        status: 'error',
        message: 'Patient not found'
      });
    }

    res.json({
      status: 'success',
      data: { trends }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching health trends',
      error: error.message
    });
  }
};

// @desc    Get patients with active health alerts
// @route   GET /api/patients/alerts/active
// @access  Private (Doctor, Nurse, Admin)
const getPatientsWithActiveAlerts = async (req, res) => {
  try {
    const patients = await Patient.findWithActiveAlerts();

    res.json({
      status: 'success',
      data: { patients }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching patients with alerts',
      error: error.message
    });
  }
};

// @desc    Acknowledge health alert
// @route   PUT /api/patients/:id/alerts/:alertId/acknowledge
// @access  Private (Doctor, Nurse, Admin)
const acknowledgeHealthAlert = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({
        status: 'error',
        message: 'Patient not found'
      });
    }

    const alert = patient.healthAlerts.id(req.params.alertId);
    if (!alert) {
      return res.status(404).json({
        status: 'error',
        message: 'Health alert not found'
      });
    }

    alert.acknowledgedBy = req.user.id;
    alert.acknowledgedAt = new Date();
    alert.isActive = false;

    await patient.save();

    res.json({
      status: 'success',
      message: 'Health alert acknowledged successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error acknowledging health alert',
      error: error.message
    });
  }
};

// @desc    Delete patient
// @route   DELETE /api/patients/:id
// @access  Private (Admin)
const deletePatient = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({
        status: 'error',
        message: 'Patient not found'
      });
    }

    // Soft delete
    patient.isActive = false;
    await patient.save();

    res.json({
      status: 'success',
      message: 'Patient deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error deleting patient',
      error: error.message
    });
  }
};

// Helper function to send health alerts
const sendHealthAlerts = async (patient, alerts) => {
  try {
    // Get patient's doctor
    const doctor = await User.findOne({ role: 'doctor' }).limit(1);
    
    if (!doctor) return;

    const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
    
    if (criticalAlerts.length > 0) {
      // Send SMS alert
      if (process.env.TWILIO_ACCOUNT_SID) {
        await twilioClient.messages.create({
          body: `🚨 CRITICAL ALERT: Patient ${patient.user.firstName} ${patient.user.lastName} (${patient.patientId}) has critical vitals. Please check immediately.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: doctor.phone
        });
      }

      // Send email alert
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: doctor.email,
        subject: `🚨 Critical Health Alert - Patient ${patient.patientId}`,
        html: `
          <h2>Critical Health Alert</h2>
          <p><strong>Patient:</strong> ${patient.user.firstName} ${patient.user.lastName}</p>
          <p><strong>Patient ID:</strong> ${patient.patientId}</p>
          <p><strong>Critical Alerts:</strong></p>
          <ul>
            ${criticalAlerts.map(alert => `<li>${alert.type}: ${alert.value} (${alert.severity})</li>`).join('')}
          </ul>
          <p>Please check the patient immediately.</p>
        `
      });
    }
  } catch (error) {
    console.error('Error sending health alerts:', error);
  }
};

module.exports = {
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
};
