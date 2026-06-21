const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const cleanupExpiredFiles = require('./cleanup');
const app = require('./server');

// A helper to start the server on a dynamic port and return details
function startTestServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        server,
        port: address.port,
        baseUrl: `http://127.0.0.1:${address.port}`
      });
    });
  });
}

test('CodeShare Integration and Unit Tests', async (t) => {
  let serverInstance;
  let baseUrl;
  
  // Set up the server before running API tests
  t.before(async () => {
    const { server, baseUrl: url } = await startTestServer();
    serverInstance = server;
    baseUrl = url;
  });

  // Tear down the server after tests
  t.after(() => {
    if (serverInstance) {
      serverInstance.close();
    }
    // Clean up test DB records to avoid pollution
    db.prepare("DELETE FROM files WHERE original_name LIKE 'test-%' OR original_name IN ('hello.txt', 'blocked.exe')").run();
  });

  // 1. Test Database Structure and Setup
  await t.test('Database should have files table created', () => {
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='files'").get();
    assert.ok(tableCheck, 'Table "files" should exist');
  });

  // 2. Test File Upload (Valid)
  let activeCode = null;
  await t.test('POST /api/upload - should upload file successfully and return 6-digit code', async () => {
    const formData = new FormData();
    const fileContent = 'Hello CodeShare World!';
    const fileBlob = new Blob([fileContent], { type: 'text/plain' });
    formData.append('file', fileBlob, 'test-hello.txt');

    const res = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      body: formData
    });

    assert.strictEqual(res.status, 200, 'Upload request should return 200 status');
    const data = await res.json();
    
    assert.ok(data.code, 'Response should contain an access code');
    assert.match(data.code, /^\d{6}$/, 'Access code must be exactly 6 digits');
    assert.strictEqual(data.expiresInHours, 24, 'Expiry hours should default to 24');
    
    activeCode = data.code;

    // Verify DB entry is created
    const fileRecord = db.prepare('SELECT * FROM files WHERE code = ?').get(activeCode);
    assert.ok(fileRecord, 'Database should contain record for the uploaded file');
    assert.strictEqual(fileRecord.original_name, 'test-hello.txt', 'Original filename should match');
    assert.strictEqual(fileRecord.size, fileContent.length, 'Size in DB should match uploaded content length');
  });

  // 3. Test File Download (Valid Code)
  await t.test('GET /api/download/:code - should download uploaded file successfully', async () => {
    assert.ok(activeCode, 'Should have an active code from upload test');
    
    const res = await fetch(`${baseUrl}/api/download/${activeCode}`);
    assert.strictEqual(res.status, 200, 'Download should succeed with 200');
    
    const content = await res.text();
    assert.strictEqual(content, 'Hello CodeShare World!', 'Downloaded content should match uploaded content');

    // Verify download count incremented
    const fileRecord = db.prepare('SELECT downloads FROM files WHERE code = ?').get(activeCode);
    assert.strictEqual(fileRecord.downloads, 1, 'Download count in DB should increment to 1');
  });

  // 4. Test File Upload (Blocked Extension)
  await t.test('POST /api/upload - should block dangerous file extensions', async () => {
    const formData = new FormData();
    const fileBlob = new Blob(['malware-payload'], { type: 'application/octet-stream' });
    formData.append('file', fileBlob, 'test-malware.exe');

    const res = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      body: formData
    });

    assert.strictEqual(res.status, 400, 'Dangerous file extensions should be rejected with 400');
    const data = await res.json();
    assert.match(data.error, /File type not allowed/, 'Error response should indicate blocked extension');
  });

  // 5. Test Download (Invalid Code Format)
  await t.test('GET /api/download/:code - should reject invalid code formats', async () => {
    const res = await fetch(`${baseUrl}/api/download/123`);
    assert.strictEqual(res.status, 400, 'Invalid code format should return 400');
    
    const data = await res.json();
    assert.match(data.error, /Invalid code format/, 'Error message should complain about code format');
  });

  // 6. Test Download (Non-Existent Code)
  await t.test('GET /api/download/:code - should return 404 for non-existent code', async () => {
    const res = await fetch(`${baseUrl}/api/download/999999`);
    assert.strictEqual(res.status, 404, 'Non-existent code should return 404');
    
    const data = await res.json();
    assert.match(data.error, /Invalid or expired code/, 'Error message should indicate invalid code');
  });

  // 7. Test Cron Cleanup Job Behavior
  await t.test('cleanupExpiredFiles - should delete expired files from database and disk', () => {
    // Write a dummy physical file
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const testFileStoredName = 'test-expired-file-' + Date.now() + '.txt';
    const testFilePath = path.join(uploadDir, testFileStoredName);
    fs.writeFileSync(testFilePath, 'dummy expired content');

    const expiredCode = '888888';
    const now = Date.now();
    const expiredTime = now - 10000; // 10 seconds ago

    // Manually insert an expired file record
    db.prepare(`
      INSERT INTO files (code, original_name, stored_name, size, mime_type, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(expiredCode, 'test-expired.txt', testFileStoredName, 21, 'text/plain', now - 20000, expiredTime);

    // Ensure it exists in the DB and disk before cleanup
    const recordBefore = db.prepare('SELECT 1 FROM files WHERE code = ?').get(expiredCode);
    assert.ok(recordBefore, 'Expired record should exist in DB before cleanup');
    assert.ok(fs.existsSync(testFilePath), 'Expired file should exist on disk before cleanup');

    // Trigger cleanup job manually
    cleanupExpiredFiles();

    // Verify it was deleted from DB
    const recordAfter = db.prepare('SELECT 1 FROM files WHERE code = ?').get(expiredCode);
    assert.strictEqual(recordAfter, undefined, 'Expired record should be deleted from DB by cleanup');

    // Note: fs.unlink is async, so we'll wait a brief moment to check physical disk deletion
    setTimeout(() => {
      assert.strictEqual(fs.existsSync(testFilePath), false, 'Expired file should be unlinked from disk by cleanup');
    }, 100);
  });
});
