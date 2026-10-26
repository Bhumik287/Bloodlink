/**
 * MongoDB Database Setup & Indexes Initialization
 * Course Reference: Unit-4 Database Integration (MongoDB via MongoClient)
 * Configures collections, indexes, and referential integrity guards.
 */

const bcrypt = require('bcryptjs');
const { connectDB, getDB, closeDB } = require('./db');
require('dotenv').config();

async function initDatabase(seedDemoData = false) {
  console.log('[Database Setup] Initializing database collections and indexes...');
  const db = await connectDB();

  // 1. Initialize Collections & Indexes
  // Collection: users
  const usersCol = db.collection('users');
  await usersCol.createIndex({ email: 1 }, { unique: true });
  await usersCol.createIndex({ role: 1 });
  console.log('✔ [users] Indexes created: { email: 1 } (unique)');

  // Collection: donorProfiles
  const donorProfilesCol = db.collection('donorProfiles');
  await donorProfilesCol.createIndex({ userId: 1 }, { unique: true });
  await donorProfilesCol.createIndex({ bloodGroup: 1, city: 1, isAvailable: 1 });
  console.log('✔ [donorProfiles] Indexes created: { userId: 1 } (unique), { bloodGroup, city, isAvailable }');

  // Collection: bloodRequests
  const requestsCol = db.collection('bloodRequests');
  await requestsCol.createIndex({ status: 1, bloodGroup: 1, city: 1 });
  await requestsCol.createIndex({ requesterId: 1 });
  await requestsCol.createIndex({ urgency: 1, createdAt: -1 });
  console.log('✔ [bloodRequests] Indexes created: { status, bloodGroup, city }, { requesterId }');

  // Collection: donorResponses
  const responsesCol = db.collection('donorResponses');
  // Unique compound index: a donor can only have one response per blood request
  await responsesCol.createIndex({ requestId: 1, donorId: 1 }, { unique: true });
  await responsesCol.createIndex({ donorId: 1 });
  console.log('✔ [donorResponses] Indexes created: { requestId: 1, donorId: 1 } (unique compound)');

  // Collection: notifications
  const notificationsCol = db.collection('notifications');
  await notificationsCol.createIndex({ userId: 1, createdAt: -1 });
  console.log('✔ [notifications] Indexes created: { userId: 1, createdAt: -1 }');

  // 2. Controlled Demonstration Seeding (if requested)
  if (seedDemoData) {
    console.log('\n[Demo Seed] Seeding demo accounts and initial requests...');
    const saltRounds = 10;

    // A. Seed Admin Account
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@bloodlink.org';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@BloodLink2026';
    const adminHash = await bcrypt.hash(adminPassword, saltRounds);

    await usersCol.updateOne(
      { email: adminEmail },
      {
        $setOnInsert: {
          name: process.env.ADMIN_NAME || 'BloodLink Administrator',
          email: adminEmail,
          passwordHash: adminHash,
          phone: process.env.ADMIN_PHONE || '9876543210',
          city: process.env.ADMIN_CITY || 'Ahmedabad',
          locality: process.env.ADMIN_LOCALITY || 'Navrangpura',
          role: 'admin',
          status: 'active',
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
    console.log(`✔ Admin account verified: ${adminEmail}`);

    // B. Seed Demo Requester Account
    const reqEmail = 'requester@example.com';
    const reqPassword = 'Requester@123';
    const reqHash = await bcrypt.hash(reqPassword, saltRounds);

    const requesterRes = await usersCol.findOneAndUpdate(
      { email: reqEmail },
      {
        $set: {
          name: 'shivam bhalgama',
          email: reqEmail,
          passwordHash: reqHash,
          phone: '9825012345',
          city: 'Ahmedabad',
          locality: 'Satellite',
          role: 'requester',
          status: 'active',
          createdAt: new Date()
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
    const requesterId = requesterRes._id || requesterRes.value?._id;
    console.log(`✔ Demo requester account ready: ${reqEmail}`);

    // C. Seed Demo Donor Account
    const donorEmail = 'donor@example.com';
    const donorPassword = 'Donor@123';
    const donorHash = await bcrypt.hash(donorPassword, saltRounds);

    const donorRes = await usersCol.findOneAndUpdate(
      { email: donorEmail },
      {
        $set: {
          name: 'Bhumik Patel',
          email: donorEmail,
          passwordHash: donorHash,
          phone: '9876543210',
          city: 'Ahmedabad',
          locality: 'Navrangpura',
          role: 'donor',
          status: 'active',
          createdAt: new Date()
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
    const donorId = donorRes._id || donorRes.value?._id;

    // Seed donor profile
    await donorProfilesCol.updateOne(
      { userId: donorId },
      {
        $set: {
          userId: donorId,
          bloodGroup: 'O+',
          city: 'Ahmedabad',
          locality: 'Navrangpura',
          isAvailable: true,
          contactPreference: 'phone',
          lastUpdated: new Date()
        }
      },
      { upsert: true }
    );
    console.log(`✔ Demo donor account ready: ${donorEmail} (Blood Group: O+)`);

    // D. Seed Demo Blood Requests (clearly labelled as demo entries)
    const existingRequestsCount = await requestsCol.countDocuments();
    if (existingRequestsCount === 0 && requesterId) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const demoRequests = [
        {
          requesterId: requesterId,
          requesterName: 'Ramesh Sharma',
          contactPhone: '9825012345',
          patientName: 'Sunita Sharma',
          bloodGroup: 'O+',
          componentType: 'whole_blood',
          unitsRequired: 2,
          hospitalName: 'Civil Hospital Ahmedabad',
          hospitalAddress: 'Asarwa, Near BJ Medical College, Ahmedabad',
          city: 'Ahmedabad',
          locality: 'Asarwa',
          urgency: 'immediate',
          requiredDate: tomorrow.toISOString().split('T')[0],
          notes: '[Demo Data] Emergency orthopedic surgical procedure scheduled.',
          status: 'open',
          createdAt: new Date(Date.now() - 3600000), // 1 hour ago
          updatedAt: new Date()
        },
        {
          requesterId: requesterId,
          requesterName: 'Ramesh Sharma',
          contactPhone: '9825012345',
          patientName: 'Amit Trivedi',
          bloodGroup: 'B+',
          componentType: 'platelets',
          unitsRequired: 1,
          hospitalName: 'Apollo Hospital Gandhinagar',
          hospitalAddress: 'Bhat, Gandhinagar - Ahmedabad Highway',
          city: 'Ahmedabad',
          locality: 'Bhat',
          urgency: 'within_24h',
          requiredDate: tomorrow.toISOString().split('T')[0],
          notes: '[Demo Data] Dengue patient, platelet count critically low.',
          status: 'open',
          createdAt: new Date(Date.now() - 7200000), // 2 hours ago
          updatedAt: new Date()
        },
        {
          requesterId: requesterId,
          requesterName: 'Ramesh Sharma',
          contactPhone: '9825012345',
          patientName: 'Kavita Joshi',
          bloodGroup: 'A-',
          componentType: 'whole_blood',
          unitsRequired: 3,
          hospitalName: 'Sterling Hospital',
          hospitalAddress: 'Sterling Hospital Road, Memnagar, Ahmedabad',
          city: 'Ahmedabad',
          locality: 'Memnagar',
          urgency: 'within_48h',
          requiredDate: tomorrow.toISOString().split('T')[0],
          notes: '[Demo Data] Planned cardiac surgery requirement.',
          status: 'open',
          createdAt: new Date(Date.now() - 14400000),
          updatedAt: new Date()
        }
      ];

      await requestsCol.insertMany(demoRequests);
      console.log(`✔ Inserted ${demoRequests.length} demo blood requests.`);
    }
  }

  console.log('[Database Setup] Setup completed successfully.\n');
}

// Standalone execution if run via `npm run db:init`
if (require.main === module) {
  initDatabase(true)
    .then(() => closeDB())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Database Setup Error]', err);
      process.exit(1);
    });
}

module.exports = { initDatabase };
