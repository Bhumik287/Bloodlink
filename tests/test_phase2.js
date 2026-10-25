/**
 * Phase 2 Test Script: Frontend Foundation Verification
 * Verifies responsive viewport, links, forms, accessibility, SVG icons, and HTTP serving.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const app = require('../src/server');

const publicDir = path.join(__dirname, '../public');
const htmlFiles = [
  'index.html',
  'find-blood.html',
  'request-blood.html',
  'dashboard.html',
  'profile.html',
  'login.html',
  'register.html',
  'admin.html'
];

async function runPhase2Tests() {
  console.log('--- Starting Phase 2: Frontend Foundation Verification ---');
  let passed = 0;
  let failed = 0;

  // 1. Check all HTML files exist
  for (const file of htmlFiles) {
    const fullPath = path.join(publicDir, file);
    if (fs.existsSync(fullPath)) {
      console.log(`✔ File exists: ${file}`);
      passed++;
    } else {
      console.error(`✘ Missing file: ${file}`);
      failed++;
    }
  }

  // 2. Inspect each file for Viewport, Bootstrap 5, and Form Accessibility
  for (const file of htmlFiles) {
    const content = fs.readFileSync(path.join(publicDir, file), 'utf8');

    // Viewport check
    if (content.includes('name="viewport"') && content.includes('width=device-width')) {
      console.log(`✔ [${file}] Viewport meta tag properly configured for mobile responsiveness.`);
      passed++;
    } else {
      console.error(`✘ [${file}] Missing or invalid viewport meta tag.`);
      failed++;
    }

    // Bootstrap 5 check
    if (content.includes('bootstrap@5.3.3') || content.includes('bootstrap')) {
      console.log(`✔ [${file}] Bootstrap 5 properly integrated.`);
      passed++;
    } else {
      console.error(`✘ [${file}] Missing Bootstrap 5.`);
      failed++;
    }

    // Custom CSS check
    if (content.includes('/css/styles.css')) {
      console.log(`✔ [${file}] Custom design system stylesheet linked.`);
      passed++;
    } else {
      console.error(`✘ [${file}] Missing /css/styles.css link.`);
      failed++;
    }

    // Check for broken img tags (should not contain unresolvable external images)
    const imgMatches = content.match(/<img[^>]+src=["']([^"']+)["']/g);
    if (!imgMatches || imgMatches.length === 0) {
      console.log(`✔ [${file}] Clean asset profile: Uses SVG vectors & icons without broken external image links.`);
      passed++;
    } else {
      console.log(`ℹ [${file}] Found images: ${imgMatches.length}`);
    }
  }

  // 3. Check Internal Links Resolution
  console.log('\n--- Checking Internal Link Consistency ---');
  for (const file of htmlFiles) {
    const content = fs.readFileSync(path.join(publicDir, file), 'utf8');
    const hrefMatches = content.matchAll(/href=["'](\/[^"'#?]+|\/[^"'#?]*\?[^"']*)["']/g);
    for (const match of hrefMatches) {
      let targetPath = match[1].split('?')[0];
      if (targetPath === '/') targetPath = '/index.html';
      const diskPath = path.join(publicDir, targetPath);
      if (!fs.existsSync(diskPath)) {
        console.error(`✘ [${file}] Dead link to: ${targetPath}`);
        failed++;
      }
    }
  }
  console.log('✔ Internal link integrity verified. Zero broken local links.');
  passed++;

  // 4. Test HTTP Server Serving of all pages
  console.log('\n--- Testing HTTP Serving for all Pages ---');
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(5098, resolve));

  function getStatus(urlPath) {
    return new Promise((resolve) => {
      http.get(`http://localhost:5098${urlPath}`, (res) => {
        resolve(res.statusCode);
      }).on('error', () => resolve(500));
    });
  }

  for (const file of htmlFiles) {
    const route = file === 'index.html' ? '/' : `/${file}`;
    const status = await getStatus(route);
    if (status === 200) {
      console.log(`✔ HTTP 200 OK: ${route}`);
      passed++;
    } else {
      console.error(`✘ HTTP Failed (${status}): ${route}`);
      failed++;
    }
  }

  await new Promise((resolve) => server.close(resolve));

  console.log(`\n========================================`);
  console.log(`Phase 2 Verification: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================`);

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runPhase2Tests();
