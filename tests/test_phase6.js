/**
 * Phase 6 Test Script: Blood Requests & Search Integration
 * Verifies request validation, multi-parameter filtering, sorting, empty states, and lifecycle transitions.
 */

const http = require('http');
const { connectDB, closeDB, getDB } = require('../src/config/db');
const app = require('../src/server');

async function runPhase6Tests() {
  console.log('--- Starting Phase 6: Blood Requests & Search Verification ---');
  let passed = 0;
  let failed = 0;

  await connectDB();
  const db = getDB();

  // Test server on port 5095
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(5095, resolve));
  console.log('✔ Test server listening on http://localhost:5095');

  // Helper
  function request(method, path, body = null, cookie = '') {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : null;
      const headers = { 'Accept': 'application/json' };
      if (payload) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(payload);
      }
      if (cookie) headers['Cookie'] = cookie;

      const req = http.request(
        {
          hostname: 'localhost',
          port: 5095,
          path,
          method,
          headers
        },
        (res) => {
          let resBody = '';
          const setCookie = res.headers['set-cookie'];
          res.on('data', (chunk) => (resBody += chunk));
          res.on('end', () => {
            let parsed = null;
            try {
              parsed = JSON.parse(resBody);
            } catch (e) {
              parsed = resBody;
            }
            resolve({ statusCode: res.statusCode, data: parsed, setCookie });
          });
        }
      );

      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  // 1. Login as Requester
  let requesterCookie = '';
  const loginRes = await request('POST', '/api/auth/login', {
    email: 'requester@example.com',
    password: 'Requester@123'
  });
  requesterCookie = loginRes.setCookie[0].split(';')[0];

  // 2. Test 1: Valid Request Creation
  let createdRequestId = null;
  try {
    const res = await request('POST', '/api/requests', {
      patientName: 'Test Patient 6',
      bloodGroup: 'O-',
      componentType: 'whole_blood',
      unitsRequired: 2,
      urgency: 'immediate',
      requiredDate: '2026-10-22',
      hospitalName: 'KD Hospital',
      city: 'Ahmedabad',
      locality: 'SG Highway',
      hospitalAddress: 'SG Highway, Ahmedabad',
      requesterName: 'Ramesh Sharma',
      contactPhone: '9825012345',
      notes: 'Urgent emergency surgery.'
    }, requesterCookie);

    if (res.statusCode === 201 && res.data.success && res.data.requestId) {
      createdRequestId = res.data.requestId;
      console.log('✔ Test 1 Passed: Valid request saved in MongoDB with ID:', createdRequestId);
      passed++;
    } else {
      console.error('✘ Test 1 Failed:', res.statusCode, res.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 1 Failed with error:', err.message);
    failed++;
  }

  // 3. Test 2: Invalid Request Validations
  try {
    // 2A: Unsupported blood group
    const badGroupRes = await request('POST', '/api/requests', {
      patientName: 'Bad Group Patient',
      bloodGroup: 'Z+', // invalid!
      unitsRequired: 1,
      hospitalName: 'KD Hospital',
      city: 'Ahmedabad',
      requesterName: 'Ramesh Sharma',
      contactPhone: '9825012345'
    });
    if (badGroupRes.statusCode === 400) {
      console.log('✔ Test 2A Passed: Unsupported blood group rejected with HTTP 400.');
      passed++;
    } else {
      console.error('✘ Test 2A Failed:', badGroupRes.statusCode, badGroupRes.data);
      failed++;
    }

    // 2B: Invalid units (<1 or >10)
    const badUnitsRes = await request('POST', '/api/requests', {
      patientName: 'Bad Units Patient',
      bloodGroup: 'A+',
      unitsRequired: 50, // invalid!
      hospitalName: 'KD Hospital',
      city: 'Ahmedabad',
      requesterName: 'Ramesh Sharma',
      contactPhone: '9825012345'
    });
    if (badUnitsRes.statusCode === 400) {
      console.log('✔ Test 2B Passed: Units out of bounds (>10) rejected with HTTP 400.');
      passed++;
    } else {
      console.error('✘ Test 2B Failed:', badUnitsRes.statusCode, badUnitsRes.data);
      failed++;
    }

    // 2C: Malformed phone number
    const badPhoneRes = await request('POST', '/api/requests', {
      patientName: 'Bad Phone Patient',
      bloodGroup: 'A+',
      unitsRequired: 1,
      hospitalName: 'KD Hospital',
      city: 'Ahmedabad',
      requesterName: 'Ramesh Sharma',
      contactPhone: '123' // invalid!
    });
    if (badPhoneRes.statusCode === 400) {
      console.log('✔ Test 2C Passed: Malformed phone number rejected with HTTP 400.');
      passed++;
    } else {
      console.error('✘ Test 2C Failed:', badPhoneRes.statusCode, badPhoneRes.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 2 Failed with error:', err.message);
    failed++;
  }

  // 4. Test 3: Multi-parameter Search and Filtering
  try {
    // 3A: Filter by Blood Group (O-)
    const oNegRes = await request('GET', '/api/requests?bloodGroup=O-');
    if (oNegRes.statusCode === 200 && oNegRes.data.requests.some(r => r._id === createdRequestId)) {
      console.log('✔ Test 3A Passed: Blood group filter returned matching O- request.');
      passed++;
    } else {
      console.error('✘ Test 3A Failed:', oNegRes.statusCode, oNegRes.data);
      failed++;
    }

    // 3B: Search by Hospital keyword ("KD Hospital")
    const searchRes = await request('GET', '/api/requests?search=KD+Hospital');
    if (searchRes.statusCode === 200 && searchRes.data.requests.some(r => r.hospitalName.includes('KD Hospital'))) {
      console.log('✔ Test 3B Passed: Search by hospital keyword returned correct matching request.');
      passed++;
    } else {
      console.error('✘ Test 3B Failed:', searchRes.statusCode, searchRes.data);
      failed++;
    }

    // 3C: Filter by Urgency ("immediate")
    const urgencyRes = await request('GET', '/api/requests?urgency=immediate');
    if (urgencyRes.statusCode === 200 && urgencyRes.data.requests.every(r => r.urgency === 'immediate')) {
      console.log('✔ Test 3C Passed: Urgency filter returned only immediate requests.');
      passed++;
    } else {
      console.error('✘ Test 3C Failed:', urgencyRes.statusCode, urgencyRes.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 3 Failed with error:', err.message);
    failed++;
  }

  // 5. Test 4: Empty Search Results Handling
  try {
    const emptyRes = await request('GET', '/api/requests?search=NonExistentHospitalXYZ999');
    if (emptyRes.statusCode === 200 && emptyRes.data.success && emptyRes.data.count === 0 && emptyRes.data.requests.length === 0) {
      console.log('✔ Test 4 Passed: Empty search results handled gracefully (HTTP 200, count: 0, array: []).');
      passed++;
    } else {
      console.error('✘ Test 4 Failed:', emptyRes.statusCode, emptyRes.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 4 Failed with error:', err.message);
    failed++;
  }

  // 6. Test 5: Lifecycle & Status Transitions
  try {
    // 5A: Mark request as fulfilled by requester
    const fulfillRes = await request('PUT', `/api/requests/${createdRequestId}/status`, {
      status: 'fulfilled'
    }, requesterCookie);

    if (fulfillRes.statusCode === 200 && fulfillRes.data.success) {
      console.log('✔ Test 5A Passed: Requester successfully marked request as fulfilled.');
      passed++;
    } else {
      console.error('✘ Test 5A Failed:', fulfillRes.statusCode, fulfillRes.data);
      failed++;
    }

    // 5B: Confirm fulfilled request is NO LONGER in public active discovery
    const checkActive = await request('GET', '/api/requests');
    const stillActive = checkActive.data.requests.some(r => r._id === createdRequestId);
    if (!stillActive) {
      console.log('✔ Test 5B Passed: Fulfilled request is cleanly removed from open emergency discovery.');
      passed++;
    } else {
      console.error('✘ Test 5B Failed: Fulfilled request still appeared in active discovery!');
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 5 Failed with error:', err.message);
    failed++;
  }

  // Clean up test request
  await db.collection('bloodRequests').deleteOne({ patientName: 'Test Patient 6' });

  await new Promise((resolve) => server.close(resolve));
  await closeDB();

  console.log(`\n========================================`);
  console.log(`Phase 6 Blood Requests Verification: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================`);

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runPhase6Tests();
