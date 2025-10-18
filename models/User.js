const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['admin', 'doctor', 'nurse', 'receptionist', 'lab_technician', 'pharmacist', 'patient'],
    required: [true, 'Role is required']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^[\+]?[0-9\s\-\(\)]{10,15}$/, 'Please enter a valid phone number']
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required']
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: [true, 'Gender is required']
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  profilePicture: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false
  },
  // Doctor-specific fields
  specialization: {
    type: String,
    required: function() { return this.role === 'doctor'; }
  },
  licenseNumber: {
    type: String,
    required: function() { return this.role === 'doctor'; }
  },
  experience: {
    type: Number,
    min: 0
  },
  consultationFee: {
    type: Number,
    min: 0
  },
  // Staff-specific fields
  employeeId: {
    type: String,
    unique: true,
    sparse: true
  },
  department: {
    type: String
  },
  shift: {
    type: String,
    enum: ['morning', 'afternoon', 'night', 'flexible']
  },
  // Patient-specific fields
  patientId: {
    type: String,
    unique: true,
    sparse: true
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String
  },
  insurance: {
    provider: String,
    policyNumber: String,
    expiryDate: Date
  },
  // Account security fields
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    select: false
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to generate IDs
userSchema.pre('save', async function(next) {
  if (this.isNew) {
    if (this.role === 'doctor' && !this.employeeId) {
      this.employeeId = await generateEmployeeId('DOC');
    }
    if (this.role === 'patient' && !this.patientId) {
      this.patientId = await generatePatientId();
    }
  }
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to match password (alias for comparePassword)
userSchema.methods.matchPassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to increment login attempts
userSchema.methods.incLoginAttempts = async function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000, isLocked: true };
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = async function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 },
    $set: { isLocked: false }
  });
};

// Method to generate JWT token
userSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { 
      id: this._id, 
      role: this.role,
      email: this.email 
    },
    process.env.JWT_SECRET || 'fallback_jwt_secret_for_development',
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Helper function to generate employee ID
async function generateEmployeeId(prefix) {
  const count = await mongoose.model('User').countDocuments({ employeeId: new RegExp(`^${prefix}`) });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

// Helper function to generate patient ID
async function generatePatientId() {
  const count = await mongoose.model('User').countDocuments({ role: 'patient' });
  return `PAT${String(count + 1).padStart(6, '0')}`;
}

module.exports = mongoose.model('User', userSchema);