// cleanup.js
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const UPLOAD_DIR = path.join(__dirname, 'uploads');

function cleanupExpiredFiles() {
  const now = Date.now();
  try {
    const expired = db.prepare('SELECT * FROM files WHERE expires_at < ?').all(now);

    for (const file of expired) {
      const filePath = path.join(UPLOAD_DIR, file.stored_name);
      
      // Delete from disk
      fs.unlink(filePath, (err) => {
        if (err && err.code !== 'ENOENT') {
          console.error(`[Cleanup] Error deleting file ${file.stored_name} from disk:`, err);
        }
      });

      // Delete from database
      db.prepare('DELETE FROM files WHERE code = ?').run(file.code);
    }

    if (expired.length) {
      console.log(`[Cleanup] Cleaned up ${expired.length} expired file(s)`);
    }
  } catch (error) {
    console.error('[Cleanup] Error during file cleanup job:', error);
  }
}

// Run every 15 minutes
cron.schedule('*/15 * * * *', cleanupExpiredFiles);

module.exports = cleanupExpiredFiles;
