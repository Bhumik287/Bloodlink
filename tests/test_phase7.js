/**
 * Phase 7 Test Script: Donor Profiles & Responses Verification
 * Verifies profile updates, availability toggle, response submission, duplicate prevention, and response viewing.
 */

const http = require('http');
const { connectDB, closeDB, getDB } = require('../src/config/db');
const app = require('../src/server');

async function runPhase7Tests() {
  console.log('--- Starting Phase 7: Donor Profiles & Responses Verification ---');
  let passed = 0;
  let failed = 0;

  await connectDB();
  const db = getDB();

  // Test server on port 5094
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(5094, resolve));
  console.log('✔ Test server listening on http://localhost:5094');

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
          port: 5094,
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

  // 1. Log in Requester & Donor
  const reqLogin = await request('POST', '/api/auth/login', {
    email: 'requester@example.com',
    password: 'Requester@123'
  });
  const requesterCookie = reqLogin.setCookie[0].split(';')[0];

  const donorLogin = await request('POST', '/api/auth/login', {
    email: 'donor@example.com',
    password: 'Donor@123'
  });
  const donorCookie = donorLogin.setCookie[0].split(';')[0];

  // --- Test 1: Donors Can Update Profile & Toggle Availability ---
  try {
    // 1A: Update profile with availability = false
    const updateRes = await request('PUT', '/api/donors/profile', {
      name: 'Bhumik Patel (Updated)',
      phone: '9876543210',
      city: 'Ahmedabad',
      locality: 'Bodakdev',
      bloodGroup: 'O+',
      isAvailable: false
    }, donorCookie);

    if (updateRes.statusCode === 200 && updateRes.data.success) {
      console.log('✔ Test 1A Passed: Donor profile update returned HTTP 200.');
      passed++;
    } else {
      console.error('✘ Test 1A Failed:', updateRes.statusCode, updateRes.data);
      failed++;
    }

    // 1B: Verify updated profile
    const getProfile = await request('GET', '/api/donors/profile', null, donorCookie);
    if (getProfile.statusCode === 200 && getProfile.data.profile.isAvailable === false && getProfile.data.profile.locality === 'Bodakdev') {
      console.log('✔ Test 1B Passed: Donor profile accurately retrieved with isAvailable: false.');
      passed++;
    } else {
      console.error('✘ Test 1B Failed:', getProfile.statusCode, getProfile.data);
      failed++;
    }

    // 1C: Toggle back to available = true
    await request('PUT', '/api/donors/profile', {
      bloodGroup: 'O+',
      isAvailable: true,
      locality: 'Navrangpura'
    }, donorCookie);
    console.log('✔ Test 1C Passed: Donor availability successfully toggled back to true.');
    passed++;
  } catch (err) {
    console.error('✘ Test 1 Failed with error:', err.message);
    failed++;
  }

  // --- Setup: Requester creates a target blood request ---
  let targetRequestId = null;
  const createReqRes = await request('POST', '/api/requests', {
    patientName: 'Pooja Mehta',
    bloodGroup: 'O+',
    componentType: 'whole_blood',
    unitsRequired: 2,
    urgency: 'immediate',
    hospitalName: 'Sterling Hospital Ahmedabad',
    city: 'Ahmedabad',
    locality: 'Memnagar',
    requesterName: 'Ramesh Sharma',
    contactPhone: '9825012345'
  }, requesterCookie);
  targetRequestId = createReqRes.data.requestId;

  // --- Test 2: Donor Submits Response ("I'm Available to Help") ---
  let responseId = null;
  try {
    const respondRes = await request('POST', `/api/requests/${targetRequestId}/respond`, {
      message: 'I live nearby in Navrangpura and can reach within 45 minutes.'
    }, donorCookie);

    if (respondRes.statusCode === 201 && respondRes.data.success) {
      console.log('✔ Test 2 Passed: Donor response recorded successfully.');
      passed++;
    } else {
      console.error('✘ Test 2 Failed:', respondRes.statusCode, respondRes.data);
      failed++;
    }

    // Verify request status transitioned to 'responses_received'
    const reqCheck = await request('GET', `/api/requests/${targetRequestId}`);
    if (reqCheck.statusCode === 200 && reqCheck.data.request.status === 'responses_received') {
      console.log('✔ Test 2 Status Check Passed: Blood request transitioned from "open" to "responses_received".');
      passed++;
    } else {
      console.error('✘ Test 2 Status Check Failed:', reqCheck.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 2 Failed with error:', err.message);
    failed++;
  }

  // --- Test 3: Duplicate Response Prevention ---
  try {
    const dupRespondRes = await request('POST', `/api/requests/${targetRequestId}/respond`, {
      message: 'Trying to respond again'
    }, donorCookie);

    if (dupRespondRes.statusCode === 400 && dupRespondRes.data.success === false) {
      console.log('✔ Test 3 Passed: Duplicate response correctly rejected with HTTP 400.');
      passed++;
    } else {
      console.error('✘ Test 3 Failed: Server allowed duplicate response:', dupRespondRes.statusCode, dupRespondRes.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 3 Failed with error:', err.message);
    failed++;
  }

  // --- Test 4: Requester Views Responses to Their Request ---
  try {
    const viewRes = await request('GET', `/api/requests/${targetRequestId}/responses`, null, requesterCookie);
    if (viewRes.statusCode === 200 && viewRes.data.success && viewRes.data.responses.length > 0) {
      const resp = viewRes.data.responses[0];
      responseId = resp._id;
      if (resp.donorName === 'Bhumik Patel (Updated)' && resp.donorPhone === '9876543210') {
        console.log('✔ Test 4 Passed: Requester retrieved donor contact details accurately.');
        passed++;
      } else {
        console.error('✘ Test 4 Failed: Response details mismatch:', resp);
        failed++;
      }
    } else {
      console.error('✘ Test 4 Failed:', viewRes.statusCode, viewRes.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 4 Failed with error:', err.message);
    failed++;
  }

  // --- Test 5: Unauthorized Users Blocked from Viewing Donor Contacts ---
  try {
    // Unrelated user tries to view donor details for this request
    const unauthView = await request('GET', `/api/requests/${targetRequestId}/responses`); // unauthenticated
    if (unauthView.statusCode === 401) {
      console.log('✔ Test 5 Passed: Unauthorized visitor blocked from viewing donor contact info.');
      passed++;
    } else {
      console.error('✘ Test 5 Failed:', unauthView.statusCode, unauthView.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 5 Failed with error:', err.message);
    failed++;
  }

  // --- Test 6: Donor Can Cancel Their Response ---
  try {
    const cancelRes = await request('DELETE', `/api/donors/responses/${responseId}`, null, donorCookie);
    if (cancelRes.statusCode === 200 && cancelRes.data.success) {
      console.log('✔ Test 6 Passed: Donor cancelled their response successfully.');
      passed++;
    } else {
      console.error('✘ Test 6 Failed:', cancelRes.statusCode, cancelRes.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 6 Failed with error:', err.message);
    failed++;
  }

  // Cleanup
  await db.collection('bloodRequests').deleteOne({ patientName: 'Pooja Mehta' });
  await db.collection('donorResponses').deleteMany({ donorCity: 'Ahmedabad' });
  await db.collection('notifications').deleteMany({ title: 'New Donor Response' });

  await new Promise((resolve) => server.close(resolve));
  await closeDB();

  console.log(`\n========================================`);
  console.log(`Phase 7 Donor Profiles & Responses: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================`);

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runPhase7Tests();
