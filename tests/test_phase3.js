/**
 * Phase 3 Test Script: Database Integration & CRUD Verification
 * Verifies collections, indexes, unique constraints, referential queries, and CRUD operations.
 */

const { connectDB, getDB, closeDB } = require('../src/config/db');
const { ObjectId } = require('mongodb');

async function runPhase3Tests() {
  console.log('--- Starting Phase 3: Database & Collections Verification ---');
  let passed = 0;
  let failed = 0;

  let db;
  try {
    db = await connectDB();
  } catch (err) {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  }

  // Test 1: Verify all 5 collections exist
  const collections = await db.listCollections().toArray();
  const colNames = collections.map((c) => c.name);
  const requiredCols = ['users', 'donorProfiles', 'bloodRequests', 'donorResponses', 'notifications'];

  for (const rc of requiredCols) {
    if (colNames.includes(rc)) {
      console.log(`✔ Test 1: Collection exists: "${rc}"`);
      passed++;
    } else {
      console.error(`✘ Test 1: Missing collection: "${rc}"`);
      failed++;
    }
  }

  // Test 2: Verify Unique Index on users (email)
  const usersCol = db.collection('users');
  try {
    // Attempt duplicate insert of demo email
    await usersCol.insertOne({
      email: 'requester@example.com',
      name: 'Duplicate Test',
      passwordHash: 'dummy',
      role: 'requester'
    });
    console.error('✘ Test 2 Failed: Duplicate email was permitted!');
    failed++;
  } catch (err) {
    if (err.code === 11000) {
      console.log('✔ Test 2 Passed: Duplicate email rejected by MongoDB unique index (Error 11000).');
      passed++;
    } else {
      console.error('✘ Test 2 Failed with unexpected error:', err);
      failed++;
    }
  }

  // Test 3: CRUD Operations on bloodRequests
  const requestsCol = db.collection('bloodRequests');
  let testReqId;
  try {
    // 3A: CREATE
    const insertRes = await requestsCol.insertOne({
      patientName: 'Test Patient',
      bloodGroup: 'AB+',
      componentType: 'whole_blood',
      unitsRequired: 1,
      hospitalName: 'Test Hospital',
      city: 'Ahmedabad',
      urgency: 'immediate',
      status: 'open',
      createdAt: new Date(),
      isTemporaryTest: true
    });
    testReqId = insertRes.insertedId;
    console.log('✔ Test 3A (Create): Inserted test blood request document.');
    passed++;

    // 3B: READ
    const foundDoc = await requestsCol.findOne({ _id: testReqId });
    if (foundDoc && foundDoc.patientName === 'Test Patient' && foundDoc.bloodGroup === 'AB+') {
      console.log('✔ Test 3B (Read): Successfully retrieved blood request by ObjectId.');
      passed++;
    } else {
      console.error('✘ Test 3B Failed: Document mismatch or not found.');
      failed++;
    }

    // 3C: UPDATE
    const updateRes = await requestsCol.updateOne(
      { _id: testReqId },
      { $set: { status: 'fulfilled', updatedAt: new Date() } }
    );
    if (updateRes.modifiedCount === 1) {
      const updatedDoc = await requestsCol.findOne({ _id: testReqId });
      if (updatedDoc.status === 'fulfilled') {
        console.log('✔ Test 3C (Update): Successfully updated request status to "fulfilled".');
        passed++;
      } else {
        console.error('✘ Test 3C Failed: Status was not updated.');
        failed++;
      }
    } else {
      console.error('✘ Test 3C Failed: modifiedCount !== 1');
      failed++;
    }

    // 3D: DELETE
    const deleteRes = await requestsCol.deleteOne({ _id: testReqId });
    if (deleteRes.deletedCount === 1) {
      const checkDeleted = await requestsCol.findOne({ _id: testReqId });
      if (!checkDeleted) {
        console.log('✔ Test 3D (Delete): Successfully deleted temporary test record.');
        passed++;
      } else {
        console.error('✘ Test 3D Failed: Record still exists.');
        failed++;
      }
    } else {
      console.error('✘ Test 3D Failed: deletedCount !== 1');
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 3 CRUD Failed with error:', err);
    failed++;
  }

  // Test 4: Compound Unique Constraint on donorResponses
  const responsesCol = db.collection('donorResponses');
  const dummyRequestId = new ObjectId();
  const dummyDonorId = new ObjectId();

  try {
    // First response
    await responsesCol.insertOne({
      requestId: dummyRequestId,
      donorId: dummyDonorId,
      status: 'pending',
      createdAt: new Date()
    });

    // Duplicate response from same donor on same request
    try {
      await responsesCol.insertOne({
        requestId: dummyRequestId,
        donorId: dummyDonorId,
        status: 'pending',
        createdAt: new Date()
      });
      console.error('✘ Test 4 Failed: Duplicate donor response was allowed!');
      failed++;
    } catch (dupErr) {
      if (dupErr.code === 11000) {
        console.log('✔ Test 4 Passed: Duplicate active response prevented by compound unique index.');
        passed++;
      } else {
        console.error('✘ Test 4 Failed with wrong error code:', dupErr);
        failed++;
      }
    }

    // Cleanup dummy response
    await responsesCol.deleteMany({ requestId: dummyRequestId });
  } catch (err) {
    console.error('✘ Test 4 Failed with error:', err);
    failed++;
  }

  // Test 5: Verify Seed Data Content
  try {
    const adminUser = await usersCol.findOne({ role: 'admin' });
    const reqUser = await usersCol.findOne({ email: 'requester@example.com' });
    const donorUser = await usersCol.findOne({ email: 'donor@example.com' });
    const requestsCount = await requestsCol.countDocuments();

    if (adminUser && reqUser && donorUser && requestsCount >= 3) {
      console.log(`✔ Test 5 Passed: Seed database verified: Admin (${adminUser.email}), Requester (${reqUser.email}), Donor (${donorUser.email}), ${requestsCount} Requests.`);
      passed++;
    } else {
      console.error('✘ Test 5 Failed: Seed records incomplete.');
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 5 Failed with error:', err);
    failed++;
  }

  await closeDB();

  console.log(`\n========================================`);
  console.log(`Phase 3 Database Verification: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================`);

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runPhase3Tests();
