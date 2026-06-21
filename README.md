# 📤 CodeShare

A **modern, privacy-focused file sharing web application** that uses simple 6-digit numeric codes for quick and secure file transfers. Share files instantly without creating accounts or worrying about your data.

![License](https://img.shields.io/badge/license-ISC-blue)
![Node Version](https://img.shields.io/badge/node-%3E%3D18.0-brightgreen)
![Status](https://img.shields.io/badge/status-active-success)

---

## ✨ Features

- 🔐 **Privacy-First**: No user accounts or tracking required
- 📨 **Simple Sharing**: Generate 6-digit codes for easy file transfer
- ⚡ **Fast & Instant**: Upload and share in seconds
- 🌐 **No Installation**: Works directly in any modern browser
- 📊 **Real-time Progress**: Live upload progress tracking
- 🛡️ **Secure**: HTTPS support, rate limiting, and file validation
- ⏱️ **Auto-Cleanup**: Files automatically deleted after 24 hours
- 📱 **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- 🎨 **Modern UI**: Beautiful dark theme with smooth animations

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18.x or higher
- npm or yarn

### Local Installation

1. **Clone the repository**
```bash
git clone https://github.com/YOUR_USERNAME/codeshare.git
cd codeshare
```

2. **Install dependencies**
```bash
npm install
```

3. **Start the development server**
```bash
npm run dev
```

4. **Open in browser**
```
http://localhost:3000
```

---

## 📖 How It Works

### **Sender**
1. Visit the app and drag-drop a file (up to 500MB)
2. Get an instant 6-digit code (e.g., `123456`)
3. Share the code with anyone

### **Receiver**
1. Visit the same app
2. Enter the 6-digit code
3. Download the file instantly
4. File auto-deletes after 24 hours

---

## 🛠️ Available Scripts

```bash
# Development mode with auto-reload
npm run dev

# Production start
npm start

# Run tests
npm test
```

---

## ⚙️ Configuration

Create a `.env` file in the root directory:

```env
# Server
PORT=3000
NODE_ENV=production

# File Settings
MAX_FILE_SIZE_MB=500
CODE_EXPIRY_HOURS=24

# Optional: Database path (auto-created)
DB_PATH=./filesharing.db
```

---

## 📁 Project Structure

```
codeshare/
├── public/
│   ├── index.html          # Main HTML template
│   ├── app.js              # Frontend JavaScript
│   └── style.css           # Styling
├── uploads/                # Temporary file storage
├── server.js               # Express server
├── db.js                   # SQLite database setup
├── cleanup.js              # Auto-cleanup scheduler
├── package.json            # Dependencies
├── .env.example            # Example environment variables
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

---

## 🔌 API Endpoints

### **Upload File**
```http
POST /api/upload
Content-Type: multipart/form-data

Body: file (binary)

Response:
{
  "code": "123456",
  "expiresInHours": 24
}
```

### **Download File**
```http
GET /api/download/:code

Response: File blob (auto-downloads)
```

---

## 🔒 Security Features

- **File Validation**: Blocks executable files (.exe, .bat, .sh, etc.)
- **Rate Limiting**: 
  - 30 uploads per hour per IP
  - 15 download attempts per minute per IP
- **HTTPS/SSL**: Full encryption in transit
- **Input Sanitization**: Prevents path traversal attacks
- **Auto-Cleanup**: Files deleted after 24 hours
- **No Data Retention**: No user data stored
- **Helmet.js**: Secure HTTP headers

---

## 🌍 Deployment

### **Render (Recommended)**
The easiest way to deploy. Push to GitHub and connect to Render for auto-deployment.

```bash
# Push to GitHub
git push origin main

# Then deploy on render.com
```

### **Other Options**
- Railway.app
- Heroku
- HidenCloud VPS
- Self-hosted (Docker)

---

## 🐳 Docker Deployment

**Build image:**
```bash
docker build -t codeshare .
```

**Run container:**
```bash
docker run -p 3000:3000 -v codeshare-data:/app/uploads codeshare
```

---

## 📊 Database

Uses **SQLite** (better-sqlite3) for lightweight, file-based storage. 

### **Schema**
```sql
CREATE TABLE files (
  code TEXT PRIMARY KEY,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime_type TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  downloads INTEGER DEFAULT 0
)
```

---

## 🧹 Cleanup Process

The app automatically:
- Checks for expired files every hour
- Deletes expired database records
- Removes associated file from storage
- Runs silently in the background

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 🐛 Known Limitations

- Files expire after 24 hours (configurable)
- Maximum file size: 500MB (configurable)
- Single-use codes (one download per code)
- No file encryption at rest (use Render's secure storage)

---

## 📝 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `MAX_FILE_SIZE_MB` | `500` | Max uploadable file size |
| `CODE_EXPIRY_HOURS` | `24` | Code expiration time |

---

## 📄 License

This project is licensed under the **ISC License** - see the LICENSE file for details.

---

## 👨‍💻 Author

Created for quick, secure, and hassle-free file sharing.

---

## 🙋 Support

For issues, questions, or suggestions:
- Open an [Issue](https://github.com/YOUR_USERNAME/codeshare/issues)
- Check existing documentation
- Email: your-email@example.com

---

## 🚀 Getting Live

### **Quick Deployment to Render**

1. Push this repo to GitHub
2. Go to [render.com](https://render.com)
3. Connect your GitHub account
4. Create a new Web Service
5. Select this repository
6. Set Build Command: `npm install`
7. Set Start Command: `npm start`
8. Deploy! 🎉

Your app will be live in 2-3 minutes at `https://codeshare.onrender.com`

---

## 🎯 Roadmap

- [ ] Custom expiration times per file
- [ ] File encryption at rest
- [ ] Download notifications
- [ ] QR code generation for codes
- [ ] Multiple file support
- [ ] Analytics dashboard
- [ ] Custom branding options

---

## 💡 Tips

- **For Organizations**: Deploy on your own server for full control
- **For Teams**: Use custom domains to brand as your own service
- **For Privacy**: Run locally for maximum security
- **For Sharing**: Use Render's free tier for instant global access

---

**Made with ❤️ for simple file sharing**
