/**
 * Phase 4 Test Script: Express Backend & REST API Verification
 * Verifies HTTP methods, JSON request/response formats, validation errors, and endpoint behavior.
 */

const http = require('http');
const { connectDB, closeDB } = require('../src/config/db');
const app = require('../src/server');

async function runPhase4Tests() {
  console.log('--- Starting Phase 4: Backend REST APIs Verification ---');
  let passed = 0;
  let failed = 0;

  await connectDB();

  // Spin up test server on port 5097
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(5097, resolve));
  console.log('✔ Test server listening on http://localhost:5097');

  let sessionCookie = '';

  // Helper for requests
  function request(method, path, body = null, cookie = '') {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : null;
      const headers = {
        'Accept': 'application/json'
      };
      if (payload) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(payload);
      }
      if (cookie) {
        headers['Cookie'] = cookie;
      }

      const req = http.request(
        {
          hostname: 'localhost',
          port: 5097,
          path: path,
          method: method,
          headers: headers
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

  // 1. Test GET /api/requests/stats
  try {
    const res = await request('GET', '/api/requests/stats');
    if (res.statusCode === 200 && res.data.success && typeof res.data.stats.openRequests === 'number') {
      console.log('✔ Test 1 Passed: GET /api/requests/stats returns 200 OK with database metrics.');
      passed++;
    } else {
      console.error('✘ Test 1 Failed:', res.statusCode, res.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 1 Failed with error:', err.message);
    failed++;
  }

  // 2. Test GET /api/requests (discovery with filters)
  try {
    const res = await request('GET', '/api/requests?bloodGroup=O+');
    if (res.statusCode === 200 && res.data.success && Array.isArray(res.data.requests)) {
      console.log(`✔ Test 2 Passed: GET /api/requests?bloodGroup=O+ returns 200 OK (${res.data.count} found).`);
      passed++;
    } else {
      console.error('✘ Test 2 Failed:', res.statusCode, res.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 2 Failed with error:', err.message);
    failed++;
  }

  // 3. Test POST /api/requests with invalid data (validation check)
  try {
    const res = await request('POST', '/api/requests', {
      patientName: 'Missing Info Patient'
      // missing bloodGroup, hospitalName, etc.
    });
    if (res.statusCode === 400 && res.data.success === false) {
      console.log('✔ Test 3 Passed: POST /api/requests correctly rejected incomplete payload with 400 Bad Request.');
      passed++;
    } else {
      console.error('✘ Test 3 Failed: Server did not reject invalid payload:', res.statusCode, res.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 3 Failed with error:', err.message);
    failed++;
  }

  // 4. Test POST /api/requests with valid data
  let createdRequestId = null;
  try {
    const res = await request('POST', '/api/requests', {
      patientName: 'Kunal Verma',
      bloodGroup: 'B+',
      componentType: 'whole_blood',
      unitsRequired: 2,
      urgency: 'within_24h',
      hospitalName: 'Sal Hospital',
      city: 'Ahmedabad',
      locality: 'Thaltej',
      hospitalAddress: 'Drive-in Road, Thaltej',
      requesterName: 'Deepak Verma',
      contactPhone: '9876543211',
      notes: 'Testing request creation API.'
    });

    if (res.statusCode === 201 && res.data.success && res.data.requestId) {
      createdRequestId = res.data.requestId;
      console.log(`✔ Test 4 Passed: POST /api/requests created new record with ID: ${createdRequestId}`);
      passed++;
    } else {
      console.error('✘ Test 4 Failed:', res.statusCode, res.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 4 Failed with error:', err.message);
    failed++;
  }

  // 5. Test GET /api/requests/:id
  try {
    const res = await request('GET', `/api/requests/${createdRequestId}`);
    if (res.statusCode === 200 && res.data.success && res.data.request.patientName === 'Kunal Verma') {
      console.log('✔ Test 5 Passed: GET /api/requests/:id retrieved newly created request successfully.');
      passed++;
    } else {
      console.error('✘ Test 5 Failed:', res.statusCode, res.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 5 Failed with error:', err.message);
    failed++;
  }

  // 6. Test GET /api/requests/invalid-object-id (ID validation check)
  try {
    const res = await request('GET', '/api/requests/not-a-valid-id');
    if (res.statusCode === 400 && res.data.success === false) {
      console.log('✔ Test 6 Passed: Malformed ObjectId rejected with 400 Bad Request.');
      passed++;
    } else {
      console.error('✘ Test 6 Failed:', res.statusCode, res.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 6 Failed with error:', err.message);
    failed++;
  }

  // 7. Test POST /api/auth/login with valid demo donor
  try {
    const res = await request('POST', '/api/auth/login', {
      email: 'donor@example.com',
      password: 'Donor@123'
    });

    if (res.statusCode === 200 && res.data.success && res.data.user.role === 'donor') {
      console.log('✔ Test 7 Passed: POST /api/auth/login authenticated demo donor with session.');
      if (res.setCookie && res.setCookie.length > 0) {
        sessionCookie = res.setCookie[0].split(';')[0];
      }
      passed++;
    } else {
      console.error('✘ Test 7 Failed:', res.statusCode, res.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 7 Failed with error:', err.message);
    failed++;
  }

  // 8. Test GET /api/auth/me using authenticated session cookie
  try {
    const res = await request('GET', '/api/auth/me', null, sessionCookie);
    if (res.statusCode === 200 && res.data.success && res.data.user.email === 'donor@example.com') {
      console.log('✔ Test 8 Passed: GET /api/auth/me verified session persistence across requests.');
      passed++;
    } else {
      console.error('✘ Test 8 Failed:', res.statusCode, res.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 8 Failed with error:', err.message);
    failed++;
  }

  // 9. Test POST /api/requests/:id/respond (Donor expresses availability)
  try {
    const res = await request('POST', `/api/requests/${createdRequestId}/respond`, {
      message: 'Available to donate whole blood tomorrow morning.'
    }, sessionCookie);

    if (res.statusCode === 201 && res.data.success) {
      console.log('✔ Test 9 Passed: POST /api/requests/:id/respond recorded donor response.');
      passed++;
    } else {
      console.error('✘ Test 9 Failed:', res.statusCode, res.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 9 Failed with error:', err.message);
    failed++;
  }

  // 10. Test duplicate response rejection
  try {
    const res = await request('POST', `/api/requests/${createdRequestId}/respond`, {
      message: 'Trying again'
    }, sessionCookie);

    if (res.statusCode === 400 && res.data.success === false) {
      console.log('✔ Test 10 Passed: Duplicate donor response rejected with 400 Bad Request.');
      passed++;
    } else {
      console.error('✘ Test 10 Failed: Duplicate response was allowed:', res.statusCode, res.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 10 Failed with error:', err.message);
    failed++;
  }

  // Clean up test request
  const db = require('../src/config/db').getDB();
  await db.collection('bloodRequests').deleteOne({ patientName: 'Kunal Verma' });
  await db.collection('donorResponses').deleteMany({ donorCity: 'Ahmedabad', message: { $regex: /tomorrow morning/ } });

  await new Promise((resolve) => server.close(resolve));
  await closeDB();

  console.log(`\n========================================`);
  console.log(`Phase 4 REST API Verification: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================`);

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runPhase4Tests();
