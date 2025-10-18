const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Billing = require('../models/Billing');

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private
const getDashboardStats = async (req, res) => {
  try {
    const [
      totalPatients,
      activeDoctors,
      todaysAppointments,
      pendingLabTests,
      totalRevenue,
      monthlyRevenue
    ] = await Promise.all([
      Patient.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'doctor', isActive: true }),
      Appointment.countDocuments({ 
        date: { 
          $gte: new Date(new Date().setHours(0,0,0,0)),
          $lt: new Date(new Date().setHours(23,59,59,999))
        },
        status: { $in: ['scheduled', 'in-progress'] }
      }),
      Appointment.countDocuments({ 
        status: 'lab-pending',
        labTests: { $exists: true, $ne: [] }
      }),
      Billing.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      Billing.aggregate([
        { 
          $match: { 
            status: 'paid',
            createdAt: { 
              $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            }
          } 
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ])
    ]);

    const stats = {
      totalPatients,
      activeDoctors,
      todaysAppointments,
      pendingLabTests,
      totalRevenue: totalRevenue[0]?.total || 0,
      monthlyRevenue: monthlyRevenue[0]?.total || 0,
      patientGrowth: '+23%', // Mock data
      appointmentGrowth: '+13%', // Mock data
      revenueGrowth: '+18%' // Mock data
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics',
      error: error.message
    });
  }
};

// @desc    Get recent activities
// @route   GET /api/dashboard/activities
// @access  Private
const getRecentActivities = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const recentActivities = await Appointment.find()
      .populate('patient', 'firstName lastName')
      .populate('doctor', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('patient doctor status createdAt notes');

    const activities = recentActivities.map(activity => ({
      id: activity._id,
      type: 'appointment',
      message: `${activity.patient.firstName} ${activity.patient.lastName} - ${activity.doctor.firstName} ${activity.doctor.lastName}`,
      status: activity.status,
      timestamp: activity.createdAt,
      details: activity.notes
    }));

    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Recent activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recent activities',
      error: error.message
    });
  }
};

// @desc    Get patient trends
// @route   GET /api/dashboard/patient-trends
// @access  Private
const getPatientTrends = async (req, res) => {
  try {
    const timeframe = req.query.timeframe || '30d';
    let startDate;
    
    switch (timeframe) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const trends = await Patient.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    const formattedTrends = trends.map(trend => ({
      date: `${trend._id.year}-${String(trend._id.month).padStart(2, '0')}-${String(trend._id.day).padStart(2, '0')}`,
      patients: trend.count,
      appointments: Math.floor(trend.count * 0.8) // Mock appointment data
    }));

    res.json({
      success: true,
      data: formattedTrends
    });
  } catch (error) {
    console.error('Patient trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching patient trends',
      error: error.message
    });
  }
};

// @desc    Get appointment trends
// @route   GET /api/dashboard/appointment-trends
// @access  Private
const getAppointmentTrends = async (req, res) => {
  try {
    const timeframe = req.query.timeframe || '30d';
    let startDate;
    
    switch (timeframe) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const trends = await Appointment.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    const formattedTrends = trends.map(trend => ({
      date: `${trend._id.year}-${String(trend._id.month).padStart(2, '0')}-${String(trend._id.day).padStart(2, '0')}`,
      appointments: trend.count
    }));

    res.json({
      success: true,
      data: formattedTrends
    });
  } catch (error) {
    console.error('Appointment trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appointment trends',
      error: error.message
    });
  }
};

// @desc    Get revenue analytics
// @route   GET /api/dashboard/revenue
// @access  Private
const getRevenueAnalytics = async (req, res) => {
  try {
    const timeframe = req.query.timeframe || '30d';
    let startDate;
    
    switch (timeframe) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const revenue = await Billing.aggregate([
      {
        $match: {
          status: 'paid',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          total: { $sum: '$totalAmount' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    const formattedRevenue = revenue.map(item => ({
      date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
      revenue: item.total
    }));

    res.json({
      success: true,
      data: formattedRevenue
    });
  } catch (error) {
    console.error('Revenue analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching revenue analytics',
      error: error.message
    });
  }
};

// @desc    Get department distribution
// @route   GET /api/dashboard/departments
// @access  Private
const getDepartmentDistribution = async (req, res) => {
  try {
    const departments = await User.aggregate([
      {
        $match: { 
          role: 'doctor',
          isActive: true,
          specialization: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$specialization',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const totalDoctors = departments.reduce((sum, dept) => sum + dept.count, 0);
    
    const distribution = departments.map(dept => ({
      name: dept._id,
      value: Math.round((dept.count / totalDoctors) * 100),
      count: dept.count,
      color: getDepartmentColor(dept._id)
    }));

    res.json({
      success: true,
      data: distribution
    });
  } catch (error) {
    console.error('Department distribution error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching department distribution',
      error: error.message
    });
  }
};

// Helper function to get department colors
const getDepartmentColor = (department) => {
  const colors = {
    'Cardiology': '#3B82F6',
    'Neurology': '#10B981',
    'Orthopedics': '#F59E0B',
    'Pediatrics': '#EF4444',
    'Dermatology': '#8B5CF6',
    'Gastroenterology': '#06B6D4',
    'Oncology': '#F97316',
    'Psychiatry': '#84CC16'
  };
  return colors[department] || '#6B7280';
};

// @desc    Get emergency alerts
// @route   GET /api/dashboard/emergency-alerts
// @access  Private
const getEmergencyAlerts = async (req, res) => {
  try {
    // Mock emergency alerts data
    const alerts = [
      {
        id: 1,
        type: 'critical',
        message: 'Patient John Doe - Critical vitals detected',
        timestamp: new Date(),
        patientId: 'patient123',
        severity: 'high'
      },
      {
        id: 2,
        type: 'warning',
        message: 'Low inventory alert - Bandages running low',
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        severity: 'medium'
      }
    ];

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('Emergency alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching emergency alerts',
      error: error.message
    });
  }
};

// @desc    Get live vitals
// @route   GET /api/dashboard/live-vitals
// @access  Private
const getLiveVitals = async (req, res) => {
  try {
    // Mock live vitals data
    const vitals = [
      {
        patientId: 'patient123',
        patientName: 'John Doe',
        heartRate: 72,
        bloodPressure: { systolic: 120, diastolic: 80 },
        temperature: 36.5,
        oxygenSaturation: 98,
        timestamp: new Date()
      },
      {
        patientId: 'patient456',
        patientName: 'Jane Smith',
        heartRate: 85,
        bloodPressure: { systolic: 130, diastolic: 85 },
        temperature: 37.2,
        oxygenSaturation: 96,
        timestamp: new Date()
      }
    ];

    res.json({
      success: true,
      data: vitals
    });
  } catch (error) {
    console.error('Live vitals error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching live vitals',
      error: error.message
    });
  }
};

// Routes
router.get('/stats', getDashboardStats);
router.get('/activities', getRecentActivities);
router.get('/patient-trends', getPatientTrends);
router.get('/appointment-trends', getAppointmentTrends);
router.get('/revenue', getRevenueAnalytics);
router.get('/departments', getDepartmentDistribution);
router.get('/emergency-alerts', getEmergencyAlerts);
router.get('/live-vitals', getLiveVitals);

module.exports = router;
