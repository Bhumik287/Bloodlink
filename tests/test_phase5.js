/**
 * Phase 5 Test Script: Authentication & Authorization Security Verification
 * Verifies bcrypt hashing, duplicate rejection, RBAC guards, ownership protection, and logout.
 */

const http = require('http');
const { connectDB, closeDB, getDB } = require('../src/config/db');
const app = require('../src/server');

async function runPhase5Tests() {
  console.log('--- Starting Phase 5: Authentication & Authorization Verification ---');
  let passed = 0;
  let failed = 0;

  await connectDB();
  const db = getDB();

  // Spin up test server on port 5096
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(5096, resolve));
  console.log('✔ Test server listening on http://localhost:5096');

  // Helper for HTTP requests
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
          port: 5096,
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

  // --- GATE 1 & 2: Registration & Bcrypt Hash Verification ---
  const uniqueTestEmail = `testuser_${Date.now()}@example.com`;
  const rawTestPassword = 'SecureSecretPassword123';
  let userCookie = '';

  try {
    const regRes = await request('POST', '/api/auth/register', {
      name: 'Security Test User',
      email: uniqueTestEmail,
      phone: '9876543299',
      city: 'Ahmedabad',
      locality: 'Navrangpura',
      role: 'donor',
      bloodGroup: 'B+',
      password: rawTestPassword
    });

    if (regRes.statusCode === 201 && regRes.data.success) {
      console.log('✔ Gate 1 Passed: User registered successfully.');
      passed++;
      if (regRes.setCookie) userCookie = regRes.setCookie[0].split(';')[0];
    } else {
      console.error('✘ Gate 1 Failed:', regRes.statusCode, regRes.data);
      failed++;
    }

    // Inspect actual MongoDB document
    const userDoc = await db.collection('users').findOne({ email: uniqueTestEmail });
    if (userDoc) {
      const isPlaintext = JSON.stringify(userDoc).includes(rawTestPassword);
      const isBcrypt = userDoc.passwordHash && userDoc.passwordHash.startsWith('$2a$');

      if (!isPlaintext && isBcrypt) {
        console.log('✔ Gate 2 Passed: Password is NEVER stored in plaintext. Valid bcrypt hash verified in database.');
        passed++;
      } else {
        console.error('✘ Gate 2 Failed: Plaintext password found or bcrypt hash invalid:', userDoc);
        failed++;
      }
    } else {
      console.error('✘ Gate 2 Failed: User document not found in MongoDB.');
      failed++;
    }
  } catch (err) {
    console.error('✘ Gate 1/2 Failed with error:', err.message);
    failed++;
  }

  // --- GATE 3: Duplicate Account Rejection ---
  try {
    const dupRes = await request('POST', '/api/auth/register', {
      name: 'Duplicate Pretender',
      email: uniqueTestEmail, // same email
      phone: '9876543299',
      city: 'Ahmedabad',
      role: 'requester',
      password: 'AnotherPassword123'
    });

    if (dupRes.statusCode === 400 && dupRes.data.success === false) {
      console.log('✔ Gate 3 Passed: Duplicate email registration correctly rejected with HTTP 400.');
      passed++;
    } else {
      console.error('✘ Gate 3 Failed: Server allowed duplicate registration:', dupRes.statusCode, dupRes.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Gate 3 Failed with error:', err.message);
    failed++;
  }

  // --- GATE 4: Invalid Login Credentials Rejection ---
  try {
    // 4A: Wrong password
    const wrongPassRes = await request('POST', '/api/auth/login', {
      email: uniqueTestEmail,
      password: 'CompletelyWrongPassword'
    });
    if (wrongPassRes.statusCode === 401 && wrongPassRes.data.success === false) {
      console.log('✔ Gate 4A Passed: Wrong password rejected with HTTP 401 Unauthorized.');
      passed++;
    } else {
      console.error('✘ Gate 4A Failed:', wrongPassRes.statusCode, wrongPassRes.data);
      failed++;
    }

    // 4B: Non-existent email
    const nonExistRes = await request('POST', '/api/auth/login', {
      email: 'nobody_exists_here_9999@example.com',
      password: 'SomePassword'
    });
    if (nonExistRes.statusCode === 401 && nonExistRes.data.success === false) {
      console.log('✔ Gate 4B Passed: Non-existent email rejected with HTTP 401 Unauthorized.');
      passed++;
    } else {
      console.error('✘ Gate 4B Failed:', nonExistRes.statusCode, nonExistRes.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Gate 4 Failed with error:', err.message);
    failed++;
  }

  // --- GATE 5: Protected Endpoints Reject Unauthenticated Requests ---
  try {
    const unauthRes = await request('GET', '/api/auth/me'); // No cookie
    if (unauthRes.statusCode === 401 && unauthRes.data.success === false) {
      console.log('✔ Gate 5 Passed: Protected endpoint rejected unauthenticated request with HTTP 401.');
      passed++;
    } else {
      console.error('✘ Gate 5 Failed:', unauthRes.statusCode, unauthRes.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Gate 5 Failed with error:', err.message);
    failed++;
  }

  // --- GATE 6: Role-Based Access Control (RBAC) ---
  let donorCookie = '';
  let adminCookie = '';

  try {
    // Login as Demo Donor
    const donorLogin = await request('POST', '/api/auth/login', {
      email: 'donor@example.com',
      password: 'Donor@123'
    });
    donorCookie = donorLogin.setCookie[0].split(';')[0];

    // Login as Admin
    const adminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@bloodlink.org',
      password: 'Admin@BloodLink2026'
    });
    adminCookie = adminLogin.setCookie[0].split(';')[0];

    // 6A: Donor attempts to access Admin endpoint
    const donorAccessAdmin = await request('GET', '/api/admin/overview', null, donorCookie);
    if (donorAccessAdmin.statusCode === 403 && donorAccessAdmin.data.success === false) {
      console.log('✔ Gate 6A Passed: Donor restricted from admin routes with HTTP 403 Forbidden.');
      passed++;
    } else {
      console.error('✘ Gate 6A Failed: Donor accessed admin route!', donorAccessAdmin.statusCode, donorAccessAdmin.data);
      failed++;
    }

    // 6B: Admin accesses Admin endpoint
    const adminAccessAdmin = await request('GET', '/api/admin/overview', null, adminCookie);
    if (adminAccessAdmin.statusCode === 200 && adminAccessAdmin.data.success) {
      console.log('✔ Gate 6B Passed: Admin successfully accessed admin overview with HTTP 200 OK.');
      passed++;
    } else {
      console.error('✘ Gate 6B Failed:', adminAccessAdmin.statusCode, adminAccessAdmin.data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Gate 6 Failed with error:', err.message);
    failed++;
  }

  // --- GATE 7: Ownership Boundary Protection ---
  try {
    // Login as Demo Requester (User A)
    const reqLoginA = await request('POST', '/api/auth/login', {
      email: 'requester@example.com',
      password: 'Requester@123'
    });
    const cookieA = reqLoginA.setCookie[0].split(';')[0];

    // User A creates a request
    const createRes = await request('POST', '/api/requests', {
      patientName: 'Ownership Test Patient',
      bloodGroup: 'AB-',
      componentType: 'whole_blood',
      unitsRequired: 1,
      urgency: 'immediate',
      hospitalName: 'Test Hospital',
      city: 'Ahmedabad',
      requesterName: 'Ramesh Sharma',
      contactPhone: '9825012345'
    }, cookieA);
    const targetRequestId = createRes.data.requestId;

    // Register User B (a different requester)
    const userBEmail = `other_requester_${Date.now()}@example.com`;
    const regResB = await request('POST', '/api/auth/register', {
      name: 'Unrelated User B',
      email: userBEmail,
      phone: '9876543288',
      city: 'Ahmedabad',
      role: 'requester',
      password: 'PasswordB123'
    });
    const cookieB = regResB.setCookie[0].split(';')[0];

    // User B attempts to cancel or modify User A's request
    const unauthorizedMod = await request('PUT', `/api/requests/${targetRequestId}/status`, {
      status: 'cancelled'
    }, cookieB);

    if (unauthorizedMod.statusCode === 403 && unauthorizedMod.data.success === false) {
      console.log('✔ Gate 7 Passed: User B rejected from modifying User A\'s request with HTTP 403 Forbidden.');
      passed++;
    } else {
      console.error('✘ Gate 7 Failed: User B was allowed to modify User A\'s request!', unauthorizedMod.statusCode, unauthorizedMod.data);
      failed++;
    }

    // Clean up test request and User B
    await db.collection('bloodRequests').deleteOne({ patientName: 'Ownership Test Patient' });
    await db.collection('users').deleteOne({ email: userBEmail });
  } catch (err) {
    console.error('✘ Gate 7 Failed with error:', err.message);
    failed++;
  }

  // --- GATE 8: Logout Invalidation ---
  try {
    // Logout the session
    const logoutRes = await request('POST', '/api/auth/logout', {}, userCookie);
    if (logoutRes.statusCode === 200 && logoutRes.data.success) {
      console.log('✔ Gate 8A Passed: POST /api/auth/logout returned 200 OK.');
      passed++;
    } else {
      console.error('✘ Gate 8A Failed:', logoutRes.statusCode, logoutRes.data);
      failed++;
    }

    // Subsequent access with the logged-out cookie must be rejected
    const checkLoggedOut = await request('GET', '/api/auth/me', null, userCookie);
    if (checkLoggedOut.statusCode === 401) {
      console.log('✔ Gate 8B Passed: Session invalidation confirmed. Subsequent request rejected with HTTP 401.');
      passed++;
    } else {
      console.error('✘ Gate 8B Failed: Session still active after logout:', checkLoggedOut.statusCode, checkLoggedOut.data);
      failed++;
    }

    // Clean up test user
    await db.collection('users').deleteOne({ email: uniqueTestEmail });
    await db.collection('donorProfiles').deleteOne({ city: 'Ahmedabad', bloodGroup: 'B+' });
  } catch (err) {
    console.error('✘ Gate 8 Failed with error:', err.message);
    failed++;
  }

  await new Promise((resolve) => server.close(resolve));
  await closeDB();

  console.log(`\n========================================`);
  console.log(`Phase 5 Security Verification: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================`);

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runPhase5Tests();
