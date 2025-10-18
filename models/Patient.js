const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  patientId: {
    type: String,
    unique: true,
    required: true
  },
  // Basic Patient Information
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  age: {
    type: Number,
    required: true,
    min: 0,
    max: 150
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  bloodGroup: {
    type: String,
    required: true,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  },
  contactNumber: {
    type: String,
    required: true,
    trim: true
  },
  disease: {
    type: String,
    required: true,
    trim: true
  },
  emergencyContactName: {
    type: String,
    required: true,
    trim: true
  },
  emergencyContactNumber: {
    type: String,
    required: true,
    trim: true
  },
  compounderContactNumber: {
    type: String,
    required: true,
    trim: true
  },
  medicalHistory: [{
    condition: String,
    diagnosis: String,
    treatment: String,
    date: Date,
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  allergies: [{
    allergen: String,
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe']
    },
    notes: String
  }],
  medications: [{
    name: String,
    dosage: String,
    frequency: String,
    startDate: Date,
    endDate: Date,
    prescribedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  vitalsHistory: [{
    bloodPressure: {
      systolic: Number,
      diastolic: Number
    },
    heartRate: Number,
    temperature: Number,
    weight: Number,
    height: Number,
    oxygenSaturation: Number,
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    recordedAt: {
      type: Date,
      default: Date.now
    }
  }],
  emergencyContacts: [{
    name: String,
    relationship: String,
    phone: String,
    email: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  insurance: {
    provider: String,
    policyNumber: String,
    groupNumber: String,
    expiryDate: Date,
    coverageType: {
      type: String,
      enum: ['primary', 'secondary', 'tertiary']
    }
  },
  visits: [{
    visitId: String,
    date: Date,
    type: {
      type: String,
      enum: ['consultation', 'follow-up', 'emergency', 'routine']
    },
    department: String,
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    diagnosis: String,
    treatment: String,
    notes: String,
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active'
    }
  }],
  documents: [{
    name: String,
    type: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  qrCode: String,
  isActive: {
    type: Boolean,
    default: true
  },
  // AI Health Summary
  aiHealthSummary: {
    summary: String,
    riskFactors: [String],
    recommendations: [String],
    lastUpdated: Date
  },
  // Health Alerts
  healthAlerts: [{
    type: {
      type: String,
      enum: ['critical', 'warning', 'info']
    },
    message: String,
    isAcknowledged: {
      type: Boolean,
      default: false
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    acknowledgedAt: Date,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for current vitals
patientSchema.virtual('currentVitals').get(function() {
  if (this.vitalsHistory && this.vitalsHistory.length > 0) {
    return this.vitalsHistory[this.vitalsHistory.length - 1];
  }
  return null;
});

// Virtual for active medications
patientSchema.virtual('activeMedications').get(function() {
  const now = new Date();
  return this.medications.filter(med => 
    (!med.endDate || med.endDate > now) && med.startDate <= now
  );
});

// Method to add vitals
patientSchema.methods.addVitals = function(vitalsData, recordedBy) {
  this.vitalsHistory.push({
    ...vitalsData,
    recordedBy,
    recordedAt: new Date()
  });
  
  // Check for health alerts based on vitals
  this.checkHealthAlerts(vitalsData);
  
  return this.save();
};

// Method to check health alerts
patientSchema.methods.checkHealthAlerts = function(vitals) {
  const alerts = [];
  
  // Blood pressure alerts
  if (vitals.bloodPressure) {
    const { systolic, diastolic } = vitals.bloodPressure;
    if (systolic > 140 || diastolic > 90) {
      alerts.push({
        type: 'warning',
        message: `High blood pressure detected: ${systolic}/${diastolic} mmHg`
      });
    }
    if (systolic > 180 || diastolic > 110) {
      alerts.push({
        type: 'critical',
        message: `Critical blood pressure: ${systolic}/${diastolic} mmHg - Immediate attention required`
      });
    }
  }
  
  // Heart rate alerts
  if (vitals.heartRate) {
    if (vitals.heartRate > 100) {
      alerts.push({
        type: 'warning',
        message: `Elevated heart rate: ${vitals.heartRate} BPM`
      });
    }
    if (vitals.heartRate > 120) {
      alerts.push({
        type: 'critical',
        message: `Critical heart rate: ${vitals.heartRate} BPM`
      });
    }
  }
  
  // Temperature alerts
  if (vitals.temperature) {
    if (vitals.temperature > 100.4) {
      alerts.push({
        type: 'warning',
        message: `Fever detected: ${vitals.temperature}°F`
      });
    }
    if (vitals.temperature > 103) {
      alerts.push({
        type: 'critical',
        message: `High fever: ${vitals.temperature}°F - Immediate attention required`
      });
    }
  }
  
  // Oxygen saturation alerts
  if (vitals.oxygenSaturation) {
    if (vitals.oxygenSaturation < 95) {
      alerts.push({
        type: 'warning',
        message: `Low oxygen saturation: ${vitals.oxygenSaturation}%`
      });
    }
    if (vitals.oxygenSaturation < 90) {
      alerts.push({
        type: 'critical',
        message: `Critical oxygen saturation: ${vitals.oxygenSaturation}%`
      });
    }
  }
  
  // Add alerts to patient
  alerts.forEach(alert => {
    this.healthAlerts.push(alert);
  });
};

// Method to generate QR code data
patientSchema.methods.generateQRData = function() {
  return {
    patientId: this.patientId,
    name: this.user.fullName,
    bloodGroup: this.user.bloodGroup,
    allergies: this.allergies.map(a => a.allergen),
    emergencyContact: this.emergencyContacts.find(ec => ec.isPrimary)
  };
};

// Static method to find patients with active alerts
patientSchema.statics.findWithActiveAlerts = function() {
  return this.find({
    'healthAlerts.isAcknowledged': false,
    'healthAlerts.type': { $in: ['critical', 'warning'] }
  }).populate('user', 'firstName lastName email phone');
};

// Static method to get health trends
patientSchema.statics.getHealthTrends = function(patientId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.findById(patientId)
    .select('vitalsHistory')
    .then(patient => {
      if (!patient) return null;
      
      return patient.vitalsHistory
        .filter(vital => vital.recordedAt >= startDate)
        .sort((a, b) => a.recordedAt - b.recordedAt);
    });
};

// Pre-save middleware to generate patient ID
patientSchema.pre('save', async function(next) {
  if (this.isNew && !this.patientId) {
    const count = await mongoose.model('Patient').countDocuments();
    this.patientId = `PAT${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Patient', patientSchema);