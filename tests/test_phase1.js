/**
 * Phase 1 Test Script
 * Verifies server startup, database connection, health endpoint, static file serving, and error handling.
 */

const http = require('http');
const { connectDB, closeDB, getDB } = require('../src/config/db');
const app = require('../src/server');

async function runTests() {
  console.log('--- Starting Phase 1 Verification ---');
  let passed = 0;
  let failed = 0;

  // Test 1: Database Connectivity
  try {
    const db = await connectDB();
    const adminCheck = await db.command({ ping: 1 });
    if (adminCheck.ok === 1) {
      console.log('✔ Test 1 Passed: MongoDB connected and replied to ping.');
      passed++;
    } else {
      console.error('✘ Test 1 Failed: Ping did not return ok: 1');
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 1 Failed with error:', err.message);
    failed++;
  }

  // Start test server on dynamic port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(5099, resolve));
  console.log('✔ Test Server started on port 5099');

  // Helper for HTTP GET
  function get(path) {
    return new Promise((resolve, reject) => {
      http.get(`http://localhost:5099${path}`, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      }).on('error', reject);
    });
  }

  // Test 2: Health Endpoint
  try {
    const res = await get('/api/health');
    const data = JSON.parse(res.body);
    if (res.statusCode === 200 && data.success === true && data.database.includes('connected')) {
      console.log('✔ Test 2 Passed: /api/health returned 200 OK with connected database status.');
      passed++;
    } else {
      console.error('✘ Test 2 Failed: Unexpected health response:', res.statusCode, data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 2 Failed with error:', err.message);
    failed++;
  }

  // Test 3: Static Frontend Loading
  try {
    const res = await get('/');
    if (res.statusCode === 200 && res.body.includes('BloodLink')) {
      console.log('✔ Test 3 Passed: Frontend index.html served successfully at root route.');
      passed++;
    } else {
      console.error('✘ Test 3 Failed: Index page failed to serve. Status:', res.statusCode);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 3 Failed with error:', err.message);
    failed++;
  }

  // Test 4: Static CSS Serving
  try {
    const res = await get('/css/styles.css');
    if (res.statusCode === 200 && res.body.includes('--bl-crimson')) {
      console.log('✔ Test 4 Passed: Static CSS file served correctly.');
      passed++;
    } else {
      console.error('✘ Test 4 Failed: styles.css failed to serve. Status:', res.statusCode);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 4 Failed with error:', err.message);
    failed++;
  }

  // Test 5: 404 Error Handling for non-existent API
  try {
    const res = await get('/api/non-existent-endpoint');
    const data = JSON.parse(res.body);
    if (res.statusCode === 404 && data.success === false) {
      console.log('✔ Test 5 Passed: 404 handler returned expected JSON response.');
      passed++;
    } else {
      console.error('✘ Test 5 Failed: 404 handler response unexpected:', res.statusCode, data);
      failed++;
    }
  } catch (err) {
    console.error('✘ Test 5 Failed with error:', err.message);
    failed++;
  }

  // Teardown
  await new Promise((resolve) => server.close(resolve));
  await closeDB();

  console.log(`\n--- Phase 1 Summary: ${passed} Passed, ${failed} Failed ---`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
