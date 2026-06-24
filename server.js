require('dotenv').config();
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const db = require('./db');
require('./cleanup');

const app = express();
const PORT = process.env.PORT || 3000;

// Security and utility middlewares
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(compression());
app.use(express.json());

// Ensure uploads directory exists
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Security: Sanitize filenames to prevent path traversal or header injection
function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9.\-_ ]/g, '_').slice(0, 255);
}

// 6-digit numeric code generation
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateUniqueCode() {
  let code;
  let exists = true;
  let attempts = 0;
  
  do {
    code = generateCode();
    const row = db.prepare('SELECT 1 FROM files WHERE code = ?').get(code);
    exists = !!row;
    attempts++;
    if (attempts > 100) {
      throw new Error('Could not generate a unique code. Database might be full.');
    }
  } while (exists);
  
  return code;
}

// Rate limiting configurations
const downloadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15, // 15 attempts per minute per IP
  message: { error: 'Too many download attempts, please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 uploads per hour per IP
  message: { error: 'Too many uploads from this IP, please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting
app.use('/api/download', downloadLimiter);
app.use('/api/upload', uploadLimiter);

// Multer storage and file validation
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const randomName = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, randomName + ext);
  }
});

const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.sh', '.cmd', '.msi'];
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return cb(new Error('File type not allowed (blocked extensions: .exe, .bat, .sh, .cmd, .msi)'), false);
  }
  cb(null, true);
};

const maxFileSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || '500', 10);
const upload = multer({
  storage,
  limits: { fileSize: maxFileSizeMB * 1024 * 1024 },
  fileFilter
});

// API endpoints
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const code = generateUniqueCode();
    const expiryHours = parseInt(process.env.CODE_EXPIRY_HOURS || '24', 10);
    const now = Date.now();
    const expiresAt = now + expiryHours * 60 * 60 * 1000;

    db.prepare(`
      INSERT INTO files (code, original_name, stored_name, size, mime_type, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(code, req.file.originalname, req.file.filename, req.file.size, req.file.mimetype, now, expiresAt);

    res.json({ code, expiresInHours: expiryHours });
  } catch (error) {
    console.error('Upload database insertion failed:', error);
    // Cleanup physical file if database insert failed
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Internal server error during upload registration' });
  }
});

app.get('/api/download/:code', (req, res) => {
  const { code } = req.params;

  if (!code || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Invalid code format. Code must be 6 digits.' });
  }

  try {
    const file = db.prepare('SELECT * FROM files WHERE code = ?').get(code);

    if (!file) {
      return res.status(404).json({ error: 'Invalid or expired code' });
    }

    if (Date.now() > file.expires_at) {
      db.prepare('DELETE FROM files WHERE code = ?').run(code);
      const filePath = path.join(UPLOAD_DIR, file.stored_name);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.status(410).json({ error: 'This code has expired' });
    }

    const filePath = path.join(UPLOAD_DIR, file.stored_name);
    if (!fs.existsSync(filePath)) {
      // Sync DB state if physical file got deleted somehow
      db.prepare('DELETE FROM files WHERE code = ?').run(code);
      return res.status(404).json({ error: 'File no longer available' });
    }

    res.download(filePath, sanitizeFilename(file.original_name), (err) => {
      if (!err) {
        try {
          db.prepare('DELETE FROM files WHERE code = ?').run(code);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (cleanupErr) {
          console.error('Failed to clean up file after download:', cleanupErr);
        }
      }
    });
  } catch (error) {
    console.error('Download processing failed:', error);
    res.status(500).json({ error: 'Internal server error during file retrieval' });
  }
});

// Serve static assets from public/ folder
app.use(express.static(path.join(__dirname, 'public')));

// Custom Error Handling Middleware (especially for Multer and size limit failures)
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `File is too large. Max allowed size is ${maxFileSizeMB}MB.` });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'An unexpected error occurred.' });
  }
  next();
});

// Start listening (only when run directly, to facilitate testing)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`V_Fileshare Server running on port ${PORT}`);
    console.log(`Upload limit: ${maxFileSizeMB}MB`);
    console.log(`Storage path: ${UPLOAD_DIR}`);
    console.log(`=========================================`);
  });
}

module.exports = app;
