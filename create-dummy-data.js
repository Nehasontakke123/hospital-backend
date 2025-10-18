const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Patient = require('./models/Patient');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hms')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Dummy data
const dummyUsers = [
  {
    firstName: 'Dr. Sarah',
    lastName: 'Johnson',
    email: 'sarah.johnson@hospital.com',
    password: 'password123',
    role: 'doctor',
    phone: '555-0101',
    dateOfBirth: '1985-03-15',
    gender: 'female',
    address: {
      street: '123 Medical Center Dr',
      city: 'Health City',
      state: 'HC',
      zipCode: '12345',
      country: 'USA'
    }
  },
  {
    firstName: 'Dr. Michael',
    lastName: 'Chen',
    email: 'michael.chen@hospital.com',
    password: 'password123',
    role: 'doctor',
    phone: '555-0102',
    dateOfBirth: '1980-07-22',
    gender: 'male',
    address: {
      street: '456 Cardiology Ave',
      city: 'Health City',
      state: 'HC',
      zipCode: '12345',
      country: 'USA'
    }
  },
  {
    firstName: 'Nurse',
    lastName: 'Emily Davis',
    email: 'emily.davis@hospital.com',
    password: 'password123',
    role: 'nurse',
    phone: '555-0103',
    dateOfBirth: '1990-11-08',
    gender: 'female',
    address: {
      street: '789 Nursing St',
      city: 'Health City',
      state: 'HC',
      zipCode: '12345',
      country: 'USA'
    }
  },
  {
    firstName: 'Nurse',
    lastName: 'James Wilson',
    email: 'james.wilson@hospital.com',
    password: 'password123',
    role: 'nurse',
    phone: '555-0104',
    dateOfBirth: '1988-05-12',
    gender: 'male',
    address: {
      street: '321 Care Blvd',
      city: 'Health City',
      state: 'HC',
      zipCode: '12345',
      country: 'USA'
    }
  },
  {
    firstName: 'Lab',
    lastName: 'Technician Lisa',
    email: 'lisa.tech@hospital.com',
    password: 'password123',
    role: 'lab_technician',
    phone: '555-0105',
    dateOfBirth: '1992-09-30',
    gender: 'female',
    address: {
      street: '654 Lab Lane',
      city: 'Health City',
      state: 'HC',
      zipCode: '12345',
      country: 'USA'
    }
  },
  {
    firstName: 'Receptionist',
    lastName: 'Maria Garcia',
    email: 'maria.garcia@hospital.com',
    password: 'password123',
    role: 'receptionist',
    phone: '555-0106',
    dateOfBirth: '1987-12-03',
    gender: 'female',
    address: {
      street: '987 Front Desk Dr',
      city: 'Health City',
      state: 'HC',
      zipCode: '12345',
      country: 'USA'
    }
  },
  {
    firstName: 'Admin',
    lastName: 'Robert Smith',
    email: 'admin@hospital.com',
    password: 'admin123',
    role: 'admin',
    phone: '555-0107',
    dateOfBirth: '1982-01-20',
    gender: 'male',
    address: {
      street: '147 Admin Ave',
      city: 'Health City',
      state: 'HC',
      zipCode: '12345',
      country: 'USA'
    }
  },
  {
    firstName: 'John',
    lastName: 'Patient',
    email: 'john.patient@email.com',
    password: 'password123',
    role: 'patient',
    phone: '555-0201',
    dateOfBirth: '1975-06-15',
    gender: 'male',
    address: {
      street: '111 Patient St',
      city: 'Health City',
      state: 'HC',
      zipCode: '12345',
      country: 'USA'
    }
  },
  {
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@email.com',
    password: 'password123',
    role: 'patient',
    phone: '555-0202',
    dateOfBirth: '1980-08-25',
    gender: 'female',
    address: {
      street: '222 Health Ave',
      city: 'Health City',
      state: 'HC',
      zipCode: '12345',
      country: 'USA'
    }
  },
  {
    firstName: 'David',
    lastName: 'Brown',
    email: 'david.brown@email.com',
    password: 'password123',
    role: 'patient',
    phone: '555-0203',
    dateOfBirth: '1990-04-10',
    gender: 'male',
    address: {
      street: '333 Wellness Blvd',
      city: 'Health City',
      state: 'HC',
      zipCode: '12345',
      country: 'USA'
    }
  },
  {
    firstName: 'Alice',
    lastName: 'Johnson',
    email: 'alice.johnson@email.com',
    password: 'password123',
    role: 'patient',
    phone: '555-0204',
    dateOfBirth: '1985-11-18',
    gender: 'female',
    address: {
      street: '444 Care St',
      city: 'Health City',
      state: 'HC',
      zipCode: '12345',
      country: 'USA'
    }
  },
  {
    firstName: 'Bob',
    lastName: 'Wilson',
    email: 'bob.wilson@email.com',
    password: 'password123',
    role: 'patient',
    phone: '555-0205',
    dateOfBirth: '1978-02-28',
    gender: 'male',
    address: {
      street: '555 Medical Dr',
      city: 'Health City',
      state: 'HC',
      zipCode: '12345',
      country: 'USA'
    }
  }
];

async function createDummyData() {
  try {
    console.log('🚀 Starting to create dummy data...\n');

    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await User.deleteMany({});
    await Patient.deleteMany({});
    console.log('✅ Existing data cleared\n');

    // Create users
    console.log('👥 Creating users...');
    const createdUsers = [];
    
    for (const userData of dummyUsers) {
      try {
        const user = await User.create(userData);
        createdUsers.push(user);
        console.log(`✅ Created ${user.role}: ${user.firstName} ${user.lastName} (${user.email})`);
      } catch (error) {
        console.log(`❌ Failed to create user ${userData.email}: ${error.message}`);
      }
    }

    console.log(`\n📊 Created ${createdUsers.length} users\n`);

    // Create patient records for patient users
    console.log('🏥 Creating patient records...');
    const patientUsers = createdUsers.filter(user => user.role === 'patient');
    
    for (const patientUser of patientUsers) {
      try {
        const patient = await Patient.create({
          user: patientUser._id,
          emergencyContact: {
            name: `${patientUser.firstName} ${patientUser.lastName}`,
            relationship: 'Self',
            phone: patientUser.phone
          },
          medicalHistory: [
            {
              condition: 'Hypertension',
              diagnosisDate: new Date('2023-01-15'),
              status: 'active',
              notes: 'Controlled with medication'
            }
          ],
          allergies: [
            {
              allergen: 'Penicillin',
              severity: 'moderate',
              reaction: 'Skin rash'
            }
          ],
          bloodType: ['A+', 'B+', 'AB+', 'O+', 'A-', 'B-', 'AB-', 'O-'][Math.floor(Math.random() * 8)],
          height: Math.floor(Math.random() * 30) + 150, // 150-180 cm
          weight: Math.floor(Math.random() * 40) + 50,  // 50-90 kg
          insurance: {
            provider: 'Health Insurance Co.',
            policyNumber: `POL${Math.floor(Math.random() * 1000000)}`,
            groupNumber: `GRP${Math.floor(Math.random() * 10000)}`,
            effectiveDate: new Date('2023-01-01'),
            expiryDate: new Date('2024-12-31'),
            coverageType: 'primary'
          }
        });
        
        console.log(`✅ Created patient record for ${patientUser.firstName} ${patientUser.lastName} (ID: ${patient.patientId})`);
      } catch (error) {
        console.log(`❌ Failed to create patient record for ${patientUser.firstName} ${patientUser.lastName}: ${error.message}`);
      }
    }

    console.log(`\n📊 Created ${patientUsers.length} patient records\n`);

    // Display summary
    console.log('📋 Summary:');
    console.log('==========');
    
    const roleCounts = {};
    createdUsers.forEach(user => {
      roleCounts[user.role] = (roleCounts[user.role] || 0) + 1;
    });

    Object.entries(roleCounts).forEach(([role, count]) => {
      console.log(`${role}: ${count} users`);
    });

    console.log(`\nTotal Users: ${createdUsers.length}`);
    console.log(`Total Patients: ${patientUsers.length}`);

    console.log('\n🔑 Login Credentials:');
    console.log('===================');
    console.log('Admin: admin@hospital.com / admin123');
    console.log('Doctor: sarah.johnson@hospital.com / password123');
    console.log('Nurse: emily.davis@hospital.com / password123');
    console.log('Patient: john.patient@email.com / password123');
    console.log('Receptionist: maria.garcia@hospital.com / password123');
    console.log('Lab Tech: lisa.tech@hospital.com / password123');

    console.log('\n🎉 Dummy data creation completed successfully!');
    
  } catch (error) {
    console.error('❌ Error creating dummy data:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
createDummyData();






