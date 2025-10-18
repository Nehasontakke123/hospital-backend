const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  appointmentId: {
    type: String,
    unique: true,
    required: true
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  department: {
    type: String,
    required: true
  },
  appointmentDate: {
    type: Date,
    required: true
  },
  appointmentTime: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    default: 30 // minutes
  },
  type: {
    type: String,
    enum: ['consultation', 'follow-up', 'emergency', 'routine', 'telemedicine'],
    default: 'consultation'
  },
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show'],
    default: 'scheduled'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  reason: {
    type: String,
    required: true
  },
  symptoms: [String],
  notes: String,
  diagnosis: String,
  treatment: String,
  prescription: [{
    medicine: String,
    dosage: String,
    frequency: String,
    duration: String,
    instructions: String
  }],
  followUpRequired: {
    type: Boolean,
    default: false
  },
  followUpDate: Date,
  followUpNotes: String,
  // Queue management
  queueNumber: Number,
  estimatedWaitTime: Number, // minutes
  actualWaitTime: Number, // minutes
  // Reminders
  reminders: [{
    type: {
      type: String,
      enum: ['sms', 'email', 'call']
    },
    sentAt: Date,
    status: {
      type: String,
      enum: ['sent', 'delivered', 'failed']
    }
  }],
  // Telemedicine specific
  telemedicineLink: String,
  meetingId: String,
  meetingPassword: String,
  // Payment
  consultationFee: Number,
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'partial', 'refunded'],
    default: 'pending'
  },
  paymentMethod: String,
  paymentReference: String,
  // Insurance
  insuranceClaimed: {
    type: Boolean,
    default: false
  },
  insuranceReference: String,
  // Feedback
  patientFeedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comments: String,
    submittedAt: Date
  },
  doctorNotes: String,
  internalNotes: String,
  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancellationReason: String,
  cancelledAt: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for appointment status
appointmentSchema.virtual('isActive').get(function() {
  return ['scheduled', 'confirmed', 'in-progress'].includes(this.status);
});

// Virtual for is overdue
appointmentSchema.virtual('isOverdue').get(function() {
  const now = new Date();
  const appointmentDateTime = new Date(`${this.appointmentDate.toDateString()} ${this.appointmentTime}`);
  return appointmentDateTime < now && this.status === 'scheduled';
});

// Method to generate appointment ID
appointmentSchema.statics.generateAppointmentId = async function() {
  const count = await this.countDocuments();
  return `APT${String(count + 1).padStart(6, '0')}`;
};

// Method to check doctor availability
appointmentSchema.statics.checkDoctorAvailability = async function(doctorId, date, time, duration = 30) {
  const appointmentDate = new Date(`${date} ${time}`);
  const endTime = new Date(appointmentDate.getTime() + duration * 60000);
  
  const conflictingAppointments = await this.find({
    doctor: doctorId,
    status: { $in: ['scheduled', 'confirmed', 'in-progress'] },
    $or: [
      {
        appointmentDate: {
          $gte: appointmentDate,
          $lt: endTime
        }
      },
      {
        $expr: {
          $and: [
            { $gte: [{ $add: ['$appointmentDate', { $multiply: ['$duration', 60000] }] }, appointmentDate] },
            { $lt: ['$appointmentDate', endTime] }
          ]
        }
      }
    ]
  });
  
  return conflictingAppointments.length === 0;
};

// Method to get doctor's schedule
appointmentSchema.statics.getDoctorSchedule = async function(doctorId, date) {
  return this.find({
    doctor: doctorId,
    appointmentDate: {
      $gte: new Date(date.setHours(0, 0, 0, 0)),
      $lt: new Date(date.setHours(23, 59, 59, 999))
    },
    status: { $in: ['scheduled', 'confirmed', 'in-progress'] }
  }).populate('patient', 'firstName lastName phone email');
};

// Method to send reminders
appointmentSchema.methods.sendReminder = async function(type = 'email') {
  // This would integrate with email/SMS service
  const reminder = {
    type,
    sentAt: new Date(),
    status: 'sent'
  };
  
  this.reminders.push(reminder);
  await this.save();
  
  return reminder;
};

// Pre-save middleware
appointmentSchema.pre('save', async function(next) {
  if (this.isNew && !this.appointmentId) {
    this.appointmentId = await mongoose.model('Appointment').generateAppointmentId();
  }
  
  // Generate queue number if not provided
  if (this.isNew && !this.queueNumber) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const count = await mongoose.model('Appointment').countDocuments({
      appointmentDate: {
        $gte: today,
        $lt: tomorrow
      },
      doctor: this.doctor
    });
    
    this.queueNumber = count + 1;
  }
  
  next();
});

// Indexes for better performance
appointmentSchema.index({ patient: 1, appointmentDate: 1 });
appointmentSchema.index({ doctor: 1, appointmentDate: 1 });
appointmentSchema.index({ appointmentDate: 1, appointmentTime: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ department: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
