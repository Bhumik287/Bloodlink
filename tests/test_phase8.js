/**
 * Phase 8 Test Script: Full Frontend-to-Backend Integration Verification
 * Verifies live database metrics, query pipeline, notifications lifecycle, and admin privacy guards.
 */

const http = require('http');
const { connectDB, closeDB, getDB } = require('../src/config/db');
const app = require('../src/server');

async function runPhase8Tests() {
  console.log('--- Starting Phase 8: Integration & Refinement Verification ---');
  let passed = 0;
  let failed = 0;

  await connectDB();
  const db = getDB();

  // Test server on port 5093
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(5093, resolve));
  console.log('✔ Test server listening on http://localhost:5093');

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
          port: 5093,
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

  // --- Test 1: Live Home Page Metrics Integrity ---
  try {
    const apiStatsRes = await request('GET', '/api/requests/stats');
    const [actualOpen, actualDonors, actualFulfilled] = await Promise.all([
      db.collection('bloodRequests').countDocuments({ status: { $in: ['open', 'responses_received'] } }),
      db.collection('users').countDocuments({ role: 'donor', status: 'active' }),
      db.collection('bloodRequests').countDocuments({ status: 'fulfilled' })
    ]);

    const apiStats = apiStatsRes.data.stats;
    if (
      apiStats.openRequests === actualOpen &&
      apiStats.totalDonors === actualDonors &&
      apiStats.fulfilledRequests === actualFulfilled
    ) {
      console.log(`✔ Test 1 Passed: Live stats match MongoDB records exactly (Open: ${actualOpen}, Donors: ${actualDonors}, Fulfilled: ${actualFulfilled}).`);
      passed++;
    } else {
      console.error('✘ Test 1 Failed: Discrepancy between API stats and MongoDB:', apiStats, { actualOpen, actualDonors, actualFulfilled });
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 1 Failed with error:', err.message);
    failed++;
  }

  // --- Test 2: Requester Dashboard Aggregation & Response Counts ---
  let requesterCookie = '';
  try {
    const loginRes = await request('POST', '/api/auth/login', {
      email: 'requester@example.com',
      password: 'Requester@123'
    });
    requesterCookie = loginRes.setCookie[0].split(';')[0];

    const myReqRes = await request('GET', '/api/requests/my', null, requesterCookie);
    if (myReqRes.statusCode === 200 && Array.isArray(myReqRes.data.requests)) {
      const hasResponseCount = myReqRes.data.requests.every(r => typeof r.responseCount === 'number');
      if (hasResponseCount) {
        console.log(`✔ Test 2 Passed: GET /api/requests/my returned ${myReqRes.data.requests.length} requests with computed response counts.`);
        passed++;
      } else {
        console.error('✘ Test 2 Failed: responseCount missing from request objects.');
        failed++;
      }
    } else {
      console.error('✘ Test 2 Failed:', myReqRes.statusCode, myReqRes.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 2 Failed with error:', err.message);
    failed++;
  }

  // --- Test 3: Notifications Lifecycle ---
  try {
    // 3A: Requester gets notifications
    const notifRes = await request('GET', '/api/requests/notifications', null, requesterCookie);
    if (notifRes.statusCode === 200 && Array.isArray(notifRes.data.notifications)) {
      console.log(`✔ Test 3A Passed: In-app notifications retrieved successfully (${notifRes.data.notifications.length} notifications).`);
      passed++;
    } else {
      console.error('✘ Test 3A Failed:', notifRes.statusCode, notifRes.data);
      failed++;
    }

    // 3B: Mark notifications as read
    const markReadRes = await request('PUT', '/api/requests/notifications/read', {}, requesterCookie);
    if (markReadRes.statusCode === 200 && markReadRes.data.success) {
      console.log('✔ Test 3B Passed: Notifications marked as read cleanly.');
      passed++;
    } else {
      console.error('✘ Test 3B Failed:', markReadRes.statusCode, markReadRes.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 3 Failed with error:', err.message);
    failed++;
  }

  // --- Test 4: Admin Overview & Privacy Protection ---
  try {
    const adminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@bloodlink.org',
      password: 'Admin@BloodLink2026'
    });
    const adminCookie = adminLogin.setCookie[0].split(';')[0];

    const adminOverview = await request('GET', '/api/admin/overview', null, adminCookie);
    if (adminOverview.statusCode === 200 && adminOverview.data.success) {
      // Check that NO user record contains passwordHash
      const hasLeakedHash = adminOverview.data.users.some(u => u.passwordHash !== undefined);
      if (!hasLeakedHash) {
        console.log(`✔ Test 4 Passed: Admin overview retrieved ${adminOverview.data.users.length} users with zero password hashes exposed.`);
        passed++;
      } else {
        console.error('✘ Test 4 Failed: Sensitive passwordHash exposed in admin users list!');
        failed++;
      }
    } else {
      console.error('✘ Test 4 Failed:', adminOverview.statusCode, adminOverview.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 4 Failed with error:', err.message);
    failed++;
  }

  // --- Test 5: Error Handling for Non-existent Endpoint ---
  try {
    const errRes = await request('GET', '/api/invalid-route-xyz');
    if (errRes.statusCode === 404 && errRes.data.success === false) {
      console.log('✔ Test 5 Passed: Centralized 404 handler returned standardized JSON error response.');
      passed++;
    } else {
      console.error('✘ Test 5 Failed:', errRes.statusCode, errRes.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 5 Failed with error:', err.message);
    failed++;
  }

  await new Promise((resolve) => server.close(resolve));
  await closeDB();

  console.log(`\n========================================`);
  console.log(`Phase 8 Integration Verification: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================`);

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runPhase8Tests();
