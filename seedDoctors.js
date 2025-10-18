const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import User model
const User = require('./models/User');

// Sample doctors data
const sampleDoctors = [
  {
    firstName: 'Dr. Sarah',
    lastName: 'Johnson',
    email: 'sarah.johnson@hospital.com',
    password: 'Doctor123!',
    phone: '1234567890',
    role: 'doctor',
    dateOfBirth: new Date('1980-05-15'),
    gender: 'female',
    address: {
      street: '123 Medical St',
      city: 'Health City',
      state: 'Medical State',
      zipCode: '12345',
      country: 'USA'
    },
    specialization: 'Cardiology',
    qualification: 'MD, Cardiology',
    experience: 15,
    consultationFee: 500,
    isActive: true
  },
  {
    firstName: 'Dr. Michael',
    lastName: 'Chen',
    email: 'michael.chen@hospital.com',
    password: 'Doctor123!',
    phone: '1234567891',
    role: 'doctor',
    dateOfBirth: new Date('1975-08-22'),
    gender: 'male',
    address: {
      street: '456 Health Ave',
      city: 'Health City',
      state: 'Medical State',
      zipCode: '12345',
      country: 'USA'
    },
    specialization: 'Neurology',
    qualification: 'MD, Neurology',
    experience: 20,
    consultationFee: 600,
    isActive: true
  },
  {
    firstName: 'Dr. Emily',
    lastName: 'Davis',
    email: 'emily.davis@hospital.com',
    password: 'Doctor123!',
    phone: '1234567892',
    role: 'doctor',
    dateOfBirth: new Date('1985-03-10'),
    gender: 'female',
    address: {
      street: '789 Care Blvd',
      city: 'Health City',
      state: 'Medical State',
      zipCode: '12345',
      country: 'USA'
    },
    specialization: 'Pediatrics',
    qualification: 'MD, Pediatrics',
    experience: 10,
    consultationFee: 400,
    isActive: true
  },
  {
    firstName: 'Dr. Robert',
    lastName: 'Wilson',
    email: 'robert.wilson@hospital.com',
    password: 'Doctor123!',
    phone: '1234567893',
    role: 'doctor',
    dateOfBirth: new Date('1978-12-05'),
    gender: 'male',
    address: {
      street: '321 Wellness Dr',
      city: 'Health City',
      state: 'Medical State',
      zipCode: '12345',
      country: 'USA'
    },
    specialization: 'Orthopedics',
    qualification: 'MD, Orthopedics',
    experience: 18,
    consultationFee: 550,
    isActive: true
  },
  {
    firstName: 'Dr. Lisa',
    lastName: 'Brown',
    email: 'lisa.brown@hospital.com',
    password: 'Doctor123!',
    phone: '1234567894',
    role: 'doctor',
    dateOfBirth: new Date('1982-07-18'),
    gender: 'female',
    address: {
      street: '654 Medical Way',
      city: 'Health City',
      state: 'Medical State',
      zipCode: '12345',
      country: 'USA'
    },
    specialization: 'Dermatology',
    qualification: 'MD, Dermatology',
    experience: 12,
    consultationFee: 450,
    isActive: true
  }
];

async function seedDoctors() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hms');
    console.log('✅ Connected to MongoDB');

    // Check if doctors already exist
    const existingDoctors = await User.find({ role: 'doctor' });
    if (existingDoctors.length > 0) {
      console.log(`✅ Found ${existingDoctors.length} existing doctors`);
      console.log('Doctors already exist. Skipping seed.');
      process.exit(0);
    }

    // Hash passwords and create doctors
    console.log('🌱 Creating sample doctors...');
    for (const doctorData of sampleDoctors) {
      // Hash password
      const salt = await bcrypt.genSalt(10);
      doctorData.password = await bcrypt.hash(doctorData.password, salt);
      
      // Create doctor
      const doctor = new User(doctorData);
      await doctor.save();
      console.log(`✅ Created doctor: Dr. ${doctorData.firstName} ${doctorData.lastName} - ${doctorData.specialization}`);
    }

    console.log('🎉 Successfully created sample doctors!');
    console.log('📋 Doctor credentials:');
    console.log('   Email: [doctor-email]');
    console.log('   Password: Doctor123!');
    
  } catch (error) {
    console.error('❌ Error seeding doctors:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

seedDoctors();
