/**
 * BloodLink - Master End-to-End (E2E) Integration Test Suite
 * Tests complete user journeys: Registration -> Login -> Request Creation -> Discovery -> Donor Response -> Coordination -> Fulfillment -> Admin Oversight
 */

const http = require('http');
const { connectDB, closeDB, getDB } = require('../src/config/db');
const app = require('../src/server');

async function runMasterE2ETests() {
  console.log('============================================================');
  console.log('   BloodLink — Master End-to-End (E2E) Integration Suite    ');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  await connectDB();
  const db = getDB();

  // Spin up test server on port 5092
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(5092, resolve));
  console.log('✔ Test server listening on http://localhost:5092\n');

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
          port: 5092,
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

  const timestamp = Date.now();
  const reqEmail = `requester_${timestamp}@test.com`;
  const donorEmail = `donor_${timestamp}@test.com`;
  let reqCookie = '';
  let donorCookie = '';
  let adminCookie = '';
  let e2eRequestId = '';
  let e2eResponseId = '';

  // -------------------------------------------------------------
  // Step 1: Register Requester (Vikram Shah)
  // -------------------------------------------------------------
  try {
    const res = await request('POST', '/api/auth/register', {
      name: 'Vikram Shah',
      email: reqEmail,
      phone: '9825099991',
      city: 'Ahmedabad',
      locality: 'Thaltej',
      role: 'requester',
      password: 'RequesterPassword123'
    });

    if (res.statusCode === 201 && res.data.success && res.data.user.role === 'requester') {
      console.log('✔ Step 1 Passed: Requester Vikram Shah registered successfully.');
      passed++;
      if (res.setCookie) reqCookie = res.setCookie[0].split(';')[0];
    } else {
      console.error('✘ Step 1 Failed:', res.statusCode, res.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Step 1 Failed with error:', err.message);
    failed++;
  }

  // -------------------------------------------------------------
  // Step 2: Login as Requester & Post Emergency Blood Request
  // -------------------------------------------------------------
  try {
    const postReqRes = await request('POST', '/api/requests', {
      patientName: 'Meena Shah',
      bloodGroup: 'AB-',
      componentType: 'whole_blood',
      unitsRequired: 2,
      urgency: 'immediate',
      requiredDate: '2026-10-23',
      hospitalName: 'Zydus Hospital Ahmedabad',
      city: 'Ahmedabad',
      locality: 'Thaltej',
      hospitalAddress: 'Zydus Hospitals Road, SG Highway, Thaltej',
      requesterName: 'Vikram Shah',
      contactPhone: '9825099991',
      notes: '[E2E Master Test] Emergency surgery requirement.'
    }, reqCookie);

    if (postReqRes.statusCode === 201 && postReqRes.data.success && postReqRes.data.requestId) {
      e2eRequestId = postReqRes.data.requestId;
      console.log(`✔ Step 2 Passed: Emergency request for AB- blood posted. (Request ID: ${e2eRequestId})`);
      passed++;
    } else {
      console.error('✘ Step 2 Failed:', postReqRes.statusCode, postReqRes.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Step 2 Failed with error:', err.message);
    failed++;
  }

  // -------------------------------------------------------------
  // Step 3: Verify Request in MongoDB & Public Discovery
  // -------------------------------------------------------------
  try {
    const discoverRes = await request('GET', '/api/requests?bloodGroup=AB-');
    if (discoverRes.statusCode === 200 && discoverRes.data.requests.some(r => r._id === e2eRequestId)) {
      console.log('✔ Step 3 Passed: Request is discoverable in public feed filtered by bloodGroup=AB-.');
      passed++;
    } else {
      console.error('✘ Step 3 Failed: Request not found in discovery feed:', discoverRes.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Step 3 Failed with error:', err.message);
    failed++;
  }

  // -------------------------------------------------------------
  // Step 4: Register Separate Donor (Anjali Dave)
  // -------------------------------------------------------------
  try {
    const donorRegRes = await request('POST', '/api/auth/register', {
      name: 'Anjali Dave',
      email: donorEmail,
      phone: '9876543290',
      city: 'Ahmedabad',
      locality: 'Bodakdev',
      role: 'donor',
      bloodGroup: 'AB-',
      isAvailable: true,
      password: 'DonorPassword123'
    });

    if (donorRegRes.statusCode === 201 && donorRegRes.data.success) {
      console.log('✔ Step 4 Passed: Donor Anjali Dave registered successfully.');
      passed++;
      if (donorRegRes.setCookie) donorCookie = donorRegRes.setCookie[0].split(';')[0];
    } else {
      console.error('✘ Step 4 Failed:', donorRegRes.statusCode, donorRegRes.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Step 4 Failed with error:', err.message);
    failed++;
  }

  // -------------------------------------------------------------
  // Step 5: Donor Pledges Help ("I'm Available to Help")
  // -------------------------------------------------------------
  try {
    const pledgeRes = await request('POST', `/api/requests/${e2eRequestId}/respond`, {
      message: 'I am nearby in Bodakdev and can reach Zydus Hospital blood bank in 30 minutes.'
    }, donorCookie);

    if (pledgeRes.statusCode === 201 && pledgeRes.data.success) {
      console.log('✔ Step 5 Passed: Donor Anjali Dave pledged help successfully.');
      passed++;
    } else {
      console.error('✘ Step 5 Failed:', pledgeRes.statusCode, pledgeRes.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Step 5 Failed with error:', err.message);
    failed++;
  }

  // -------------------------------------------------------------
  // Step 6: Verify Duplicate Pledge Prevention
  // -------------------------------------------------------------
  try {
    const dupPledgeRes = await request('POST', `/api/requests/${e2eRequestId}/respond`, {
      message: 'Duplicate pledge attempt'
    }, donorCookie);

    if (dupPledgeRes.statusCode === 400 && dupPledgeRes.data.success === false) {
      console.log('✔ Step 6 Passed: Duplicate pledge rejected with HTTP 400.');
      passed++;
    } else {
      console.error('✘ Step 6 Failed: Duplicate pledge was allowed:', dupPledgeRes.statusCode, dupPledgeRes.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Step 6 Failed with error:', err.message);
    failed++;
  }

  // -------------------------------------------------------------
  // Step 7: Requester Views Donor Contact Information & Notification
  // -------------------------------------------------------------
  try {
    const viewResponsesRes = await request('GET', `/api/requests/${e2eRequestId}/responses`, null, reqCookie);
    if (viewResponsesRes.statusCode === 200 && viewResponsesRes.data.responses.length > 0) {
      const resp = viewResponsesRes.data.responses[0];
      e2eResponseId = resp._id;
      if (resp.donorName === 'Anjali Dave' && resp.donorPhone === '9876543290') {
        console.log(`✔ Step 7 Passed: Requester retrieved donor details: ${resp.donorName} (${resp.donorPhone})`);
        passed++;
      } else {
        console.error('✘ Step 7 Failed: Details mismatch:', resp);
        failed++;
      }
    } else {
      console.error('✘ Step 7 Failed:', viewResponsesRes.statusCode, viewResponsesRes.data);
      failed++;
    }

    // Verify in-app notification for requester
    const notifRes = await request('GET', '/api/requests/notifications', null, reqCookie);
    if (notifRes.statusCode === 200 && notifRes.data.notifications.some(n => n.message.includes('Anjali Dave'))) {
      console.log('✔ Step 7 Notification Passed: In-app notification confirmed for requester.');
      passed++;
    } else {
      console.error('✘ Step 7 Notification Failed:', notifRes.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Step 7 Failed with error:', err.message);
    failed++;
  }

  // -------------------------------------------------------------
  // Step 8: Requester Marks Request as Fulfilled
  // -------------------------------------------------------------
  try {
    const fulfillRes = await request('PUT', `/api/requests/${e2eRequestId}/status`, {
      status: 'fulfilled'
    }, reqCookie);

    if (fulfillRes.statusCode === 200 && fulfillRes.data.success) {
      console.log('✔ Step 8 Passed: Requester marked request as fulfilled.');
      passed++;
    } else {
      console.error('✘ Step 8 Failed:', fulfillRes.statusCode, fulfillRes.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Step 8 Failed with error:', err.message);
    failed++;
  }

  // -------------------------------------------------------------
  // Step 9: Verify Request is Removed from Active Discovery
  // -------------------------------------------------------------
  try {
    const checkOpenRes = await request('GET', '/api/requests?bloodGroup=AB-');
    const isStillActive = checkOpenRes.data.requests.some(r => r._id === e2eRequestId);
    if (!isStillActive) {
      console.log('✔ Step 9 Passed: Fulfilled request is no longer listed in active discovery.');
      passed++;
    } else {
      console.error('✘ Step 9 Failed: Fulfilled request is still visible in active discovery!');
      failed++;
    }
  } catch (err) {
    console.error('✘ Step 9 Failed with error:', err.message);
    failed++;
  }

  // -------------------------------------------------------------
  // Step 10: Admin Oversight & System Health Verification
  // -------------------------------------------------------------
  try {
    const adminLoginRes = await request('POST', '/api/auth/login', {
      email: 'admin@bloodlink.org',
      password: 'Admin@BloodLink2026'
    });
    adminCookie = adminLoginRes.setCookie[0].split(';')[0];

    const adminOverviewRes = await request('GET', '/api/admin/overview', null, adminCookie);
    if (adminOverviewRes.statusCode === 200 && adminOverviewRes.data.success) {
      const stats = adminOverviewRes.data.stats;
      const foundInAdmin = adminOverviewRes.data.requests.some(r => r._id === e2eRequestId && r.status === 'fulfilled');
      if (foundInAdmin && stats.totalUsers >= 2) {
        console.log(`✔ Step 10 Passed: Admin verified fulfilled request and system metrics (Total Users: ${stats.totalUsers}, Total Requests: ${stats.totalRequests}).`);
        passed++;
      } else {
        console.error('✘ Step 10 Failed: Request missing or incorrect status in admin view.');
        failed++;
      }
    } else {
      console.error('✘ Step 10 Failed:', adminOverviewRes.statusCode, adminOverviewRes.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Step 10 Failed with error:', err.message);
    failed++;
  }

  // -------------------------------------------------------------
  // Step 11: Security & Ownership Boundary Checks
  // -------------------------------------------------------------
  try {
    // A: Donor cannot access admin panel
    const donorOnAdmin = await request('GET', '/api/admin/overview', null, donorCookie);
    if (donorOnAdmin.statusCode === 403) {
      console.log('✔ Step 11A Passed: Donor forbidden from admin panel (HTTP 403).');
      passed++;
    } else {
      console.error('✘ Step 11A Failed:', donorOnAdmin.statusCode);
      failed++;
    }

    // B: Donor cannot modify requester's request status
    const donorModify = await request('PUT', `/api/requests/${e2eRequestId}/status`, { status: 'cancelled' }, donorCookie);
    if (donorModify.statusCode === 403) {
      console.log('✔ Step 11B Passed: Donor forbidden from altering requester\'s request (HTTP 403).');
      passed++;
    } else {
      console.error('✘ Step 11B Failed:', donorModify.statusCode);
      failed++;
    }

    // C: Malformed ObjectId rejected
    const malformed = await request('GET', '/api/requests/invalid-mongo-id-12345');
    if (malformed.statusCode === 400) {
      console.log('✔ Step 11C Passed: Malformed ObjectId query rejected with HTTP 400.');
      passed++;
    } else {
      console.error('✘ Step 11C Failed:', malformed.statusCode);
      failed++;
    }
  } catch (err) {
    console.error('✘ Step 11 Failed with error:', err.message);
    failed++;
  }

  // -------------------------------------------------------------
  // Teardown & Clean Up E2E records
  // -------------------------------------------------------------
  await db.collection('bloodRequests').deleteOne({ patientName: 'Meena Shah' });
  await db.collection('users').deleteMany({ email: { $in: [reqEmail, donorEmail] } });
  await db.collection('donorProfiles').deleteMany({ locality: 'Bodakdev' });
  await db.collection('donorResponses').deleteMany({ donorPhone: '9876543290' });
  await db.collection('notifications').deleteMany({ message: { $regex: /Anjali Dave/ } });

  await new Promise((resolve) => server.close(resolve));
  await closeDB();

  console.log('\n============================================================');
  console.log(` Master E2E Results: ${passed} Passed, ${failed} Failed `);
  console.log('============================================================\n');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runMasterE2ETests();
