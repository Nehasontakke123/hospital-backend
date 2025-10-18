const mongoose = require('mongoose');

const billingSchema = new mongoose.Schema({
  billId: {
    type: String,
    unique: true,
    required: true
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  type: {
    type: String,
    enum: ['opd', 'ipd', 'emergency', 'pharmacy', 'lab', 'package'],
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'paid', 'partial', 'cancelled', 'refunded'],
    default: 'draft'
  },
  // Bill details
  items: [{
    name: String,
    description: String,
    category: {
      type: String,
      enum: ['consultation', 'medicine', 'test', 'procedure', 'room', 'other']
    },
    quantity: {
      type: Number,
      default: 1
    },
    unitPrice: Number,
    totalPrice: Number,
    discount: {
      type: Number,
      default: 0
    },
    tax: {
      type: Number,
      default: 0
    }
  }],
  // Pricing breakdown
  subtotal: {
    type: Number,
    required: true
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  taxAmount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  balanceAmount: {
    type: Number,
    default: 0
  },
  // Payment details
  payments: [{
    paymentId: String,
    amount: Number,
    method: {
      type: String,
      enum: ['cash', 'card', 'upi', 'netbanking', 'wallet', 'cheque', 'insurance']
    },
    reference: String,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    paidAt: Date,
    gatewayResponse: mongoose.Schema.Types.Mixed
  }],
  // Insurance details
  insurance: {
    claimed: {
      type: Boolean,
      default: false
    },
    provider: String,
    policyNumber: String,
    claimAmount: Number,
    approvedAmount: Number,
    claimStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'partial'],
      default: 'pending'
    },
    claimReference: String,
    processedAt: Date
  },
  // Due date and terms
  dueDate: Date,
  paymentTerms: String,
  // Additional charges
  lateFee: {
    type: Number,
    default: 0
  },
  interest: {
    type: Number,
    default: 0
  },
  // Refund details
  refunds: [{
    refundId: String,
    amount: Number,
    reason: String,
    processedAt: Date,
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String,
  internalNotes: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for payment status
billingSchema.virtual('isFullyPaid').get(function() {
  return this.paidAmount >= this.totalAmount;
});

// Virtual for is overdue
billingSchema.virtual('isOverdue').get(function() {
  if (this.isFullyPaid) return false;
  return this.dueDate && new Date() > this.dueDate;
});

// Method to add payment
billingSchema.methods.addPayment = function(paymentData) {
  const payment = {
    paymentId: `PAY${Date.now()}`,
    ...paymentData,
    paidAt: new Date()
  };
  
  this.payments.push(payment);
  this.paidAmount += payment.amount;
  this.balanceAmount = this.totalAmount - this.paidAmount;
  
  // Update status based on payment
  if (this.balanceAmount <= 0) {
    this.status = 'paid';
  } else if (this.paidAmount > 0) {
    this.status = 'partial';
  }
  
  return this.save();
};

// Method to process refund
billingSchema.methods.processRefund = function(refundData, processedBy) {
  const refund = {
    refundId: `REF${Date.now()}`,
    ...refundData,
    processedAt: new Date(),
    processedBy
  };
  
  this.refunds.push(refund);
  this.paidAmount -= refund.amount;
  this.balanceAmount = this.totalAmount - this.paidAmount;
  
  return this.save();
};

// Method to calculate late fees
billingSchema.methods.calculateLateFees = function() {
  if (this.isFullyPaid || !this.dueDate) return 0;
  
  const daysOverdue = Math.floor((new Date() - this.dueDate) / (1000 * 60 * 60 * 24));
  if (daysOverdue <= 0) return 0;
  
  // 2% per month or 0.067% per day
  const dailyRate = 0.00067;
  return this.balanceAmount * dailyRate * daysOverdue;
};

// Static method to generate bill ID
billingSchema.statics.generateBillId = async function() {
  const count = await this.countDocuments();
  return `BILL${String(count + 1).padStart(6, '0')}`;
};

// Static method to get revenue analytics
billingSchema.statics.getRevenueAnalytics = async function(startDate, endDate) {
  const pipeline = [
    {
      $match: {
        createdAt: {
          $gte: startDate,
          $lte: endDate
        },
        status: { $in: ['paid', 'partial'] }
      }
    },
    {
      $group: {
        _id: {
          type: '$type',
          month: { $month: '$createdAt' },
          year: { $year: '$createdAt' }
        },
        totalRevenue: { $sum: '$paidAmount' },
        totalBills: { $sum: 1 },
        averageBill: { $avg: '$totalAmount' }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 }
    }
  ];
  
  return this.aggregate(pipeline);
};

// Pre-save middleware
billingSchema.pre('save', async function(next) {
  if (this.isNew && !this.billId) {
    this.billId = await mongoose.model('Billing').generateBillId();
  }
  
  // Calculate totals
  this.subtotal = this.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  this.discountAmount = this.items.reduce((sum, item) => sum + (item.discount || 0), 0);
  this.taxAmount = this.items.reduce((sum, item) => sum + (item.tax || 0), 0);
  this.totalAmount = this.subtotal - this.discountAmount + this.taxAmount;
  this.balanceAmount = this.totalAmount - this.paidAmount;
  
  // Set due date if not provided (30 days from creation)
  if (!this.dueDate) {
    this.dueDate = new Date();
    this.dueDate.setDate(this.dueDate.getDate() + 30);
  }
  
  next();
});

// Indexes
billingSchema.index({ patient: 1, createdAt: -1 });
billingSchema.index({ billId: 1 });
billingSchema.index({ status: 1 });
billingSchema.index({ type: 1 });
billingSchema.index({ dueDate: 1 });

module.exports = mongoose.model('Billing', billingSchema);
