# MANUAL BOOK SI PANDITA (Sistem Informasi Pemantauan Analisis)

**Versi:** 1.0.0  
**Tanggal:** Agustus 2025
**Seorang Pengembang:** Mohammad Iqbal Maulana

---

## DAFTAR ISI

1. [Pendahuluan](#pendahuluan)
2. [Spesifikasi Teknis](#spesifikasi-teknis)
3. [Instalasi dan Setup](#instalasi-dan-setup)
4. [Struktur Proyek](#struktur-proyek)
5. [Konfigurasi Database](#konfigurasi-database)
6. [Fitur dan Modul](#fitur-dan-modul)
7. [Penggunaan Sistem](#penggunaan-sistem)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance](#maintenance)
10. [Keamanan](#keamanan)

---

## 1. PENDAHULUAN

### 1.1 Deskripsi Proyek

**SI PANDITA** adalah sistem manajemen laporan dan monitoring yang dirancang untuk mengelola berbagai jenis laporan dengan fokus pada viralitas, prioritas, dan laporan khusus. Sistem ini dibangun menggunakan teknologi web modern dengan arsitektur MVC (Model-View-Controller)..

### 1.2 Tujuan Proyek

- Mengelola laporan harian, mingguan, bulanan, dan tahunan
- Monitoring viralitas, isu khusus, dan prioritas isu
- Sistem manajemen pimpinan dan OPD
- Highlight dan pelaporan khusus
- Dashboard yang informatif dan mudah digunakan

### 1.3 Target Pengguna

- Staff administrasi
- Pimpinan unit
- Administrator sistem
- Pengguna OPD (Organisasi Perangkat Daerah)

---

## 2. SPESIFIKASI TEKNIS

### 2.1 Teknologi yang Digunakan

- **Backend:** Node.js dengan Express.js
- **Database:** MySQL
- **Template Engine:** EJS (Embedded JavaScript)
- **Frontend:** HTML5, CSS3, JavaScript, Bootstrap 5
- **Authentication:** Session-based dengan bcrypt
- **File Upload:** Multer
- **Styling:** Bootstrap 5 dengan custom CSS

### 2.2 Dependencies Utama

```json
{
  "express": "^5.1.0",
  "mysql2": "^3.14.3",
  "ejs": "^3.1.10",
  "bcrypt": "^6.0.0",
  "multer": "^2.0.2",
  "express-session": "^1.18.2",
  "archiver": "^7.0.1",
  "moment": "^2.30.1"
}
```

### 2.3 Persyaratan Sistem

- **Node.js:** Versi 16.0.0 atau lebih tinggi
- **MySQL:** Versi 8.0 atau lebih tinggi
- **RAM:** Minimal 2GB
- **Storage:** Minimal 10GB
- **OS:** Linux, Windows, atau macOS

---

## 3. INSTALASI DAN SETUP

### 3.1 Persiapan Awal

1. Pastikan Node.js dan npm sudah terinstall
2. Install MySQL Server
3. Clone repository proyek
4. Buat database MySQL

### 3.2 Langkah Instalasi

#### 3.2.1 Clone Repository

```bash
git clone [URL_REPOSITORY]
cd WebIsu
```

#### 3.2.2 Install Dependencies

```bash
npm install
```

#### 3.2.3 Setup Environment Variables

Buat file `.env` di root directory:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=webberita

# Session Configuration
SESSION_SECRET=your_secret_key_here

# Server Configuration
PORT=3000
NODE_ENV=development
```

#### 3.2.4 Setup Database

```sql
-- Buat database
CREATE DATABASE webberita;
USE webberita;

-- Import struktur database dari file SQL yang disediakan
```

#### 3.2.5 Jalankan Aplikasi

```bash
# Development mode
npm run dev

# Production mode
npm start
```

### 3.3 Verifikasi Instalasi

- Buka browser dan akses `http://localhost:3000`
- Halaman login seharusnya muncul
- Test koneksi database

---

## 4. STRUKTUR PROYEK

### 4.1 Struktur Direktori

```
WebIsu/
├── .git/                    # Git repository
├── .vscode/                 # VS Code configuration
├── middlewares/             # Middleware functions
│   └── authMiddleware.js    # Authentication middleware
├── models/                  # Database models
│   └── db.js               # Database connection
├── node_modules/            # Dependencies
├── public/                  # Static files
│   └── uploads/            # File uploads
├── routes/                  # Route handlers
│   ├── auth.js             # Authentication routes
│   ├── highlight.js        # Highlight management
│   ├── khusus.js           # Special reports
│   ├── laporan.js          # Main reports
│   ├── opd.js              # OPD management
│   ├── pimpinan.js         # Leadership management
│   ├── prioritas.js        # Priority management
│   └── viralitas.js        # Virality management
├── views/                   # EJS templates
│   ├── Highlight/          # Highlight views
│   ├── LaporanPimpinan/    # Leadership reports
│   ├── LaporanStaff/       # Staff reports
│   ├── Opd/                # OPD views
│   ├── Pimpinan/           # Leadership views
│   ├── beranda.ejs         # Dashboard
│   ├── layout.ejs          # Main layout
│   └── login.ejs           # Login page
├── hash.js                  # Hash utility
├── package.json             # Project configuration
├── package-lock.json        # Dependencies lock
└── server.js                # Main server file
```

### 4.2 Arsitektur MVC

- **Model:** `models/db.js` - Database connection dan queries
- **View:** `views/` - EJS templates untuk UI
- **Controller:** `routes/` - Business logic dan route handling

---

## 5. KONFIGURASI DATABASE

### 5.1 Struktur Database

Sistem menggunakan database MySQL dengan beberapa tabel utama:

#### 5.1.1 Tabel Users

```sql
CREATE TABLE users (
    id_user INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### 5.1.2 Tabel Kategori Pimpinan

```sql
CREATE TABLE kategori_pimpinan (
    id_pimpinan INT PRIMARY KEY AUTO_INCREMENT,
    jabatan_pimpinan VARCHAR(100) NOT NULL,
    is_deleted TINYINT DEFAULT '0',
    created_by INT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by INT DEFAULT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
);
```

### 5.2 Koneksi Database

File `models/db.js` mengatur koneksi ke database:

```javascript
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
```

---

## 6. FITUR DAN MODUL

### 6.1 Modul Authentication

**File:** `routes/auth.js`

#### 6.1.1 Login

- **Route:** `POST /login`
- **Fitur:** Verifikasi username dan password
- **Keamanan:** Password di-hash menggunakan bcrypt
- **Session:** Menyimpan data user dalam session

#### 6.1.2 Logout

- **Route:** `GET /logout`
- **Fitur:** Hapus session dan redirect ke login
- **Keamanan:** Clear cookies dan destroy session

### 6.2 Modul Laporan

**File:** `routes/laporan.js`

#### 6.2.1 Jenis Laporan

- Daily (Harian)
- Weekly (Mingguan)
- Rekap Statement
- Bulanan
- Tahunan

#### 6.2.2 Fitur Upload

- File upload dengan validasi
- Organisasi file berdasarkan jenis, pimpinan, dan tanggal
- Support berbagai format file
- Auto-create directory structure

#### 6.2.3 Calendar Interface

- Tampilan kalender untuk laporan
- Filter berdasarkan pimpinan
- Download laporan dalam format ZIP

### 6.3 Modul Viralitas

**File:** `routes/viralitas.js`

#### 6.3.1 Manajemen Viralitas

- Input data viralitas
- Monitoring trend viralitas
- Laporan dan analisis
- Export data

### 6.4 Modul Prioritas

**File:** `routes/prioritas.js`

#### 6.4.1 Manajemen Prioritas

- Setting level prioritas
- Monitoring isu prioritas
- Escalation system
- Laporan prioritas

### 6.5 Modul Khusus

**File:** `routes/khusus.js`

#### 6.5.1 Laporan Khusus

- Laporan insiden khusus
- Emergency response
- Special monitoring
- Alert system

### 6.6 Modul OPD

**File:** `routes/opd.js`

#### 6.6.1 Manajemen OPD

- Data organisasi perangkat daerah
- Struktur organisasi
- Contact information
- Performance monitoring

### 6.7 Modul Pimpinan

**File:** `routes/pimpinan.js`

#### 6.7.1 Manajemen Pimpinan

- Data pimpinan
- Jabatan dan struktur
- Delegasi tugas
- Performance tracking

### 6.8 Modul Highlight

**File:** `routes/highlight.js`

#### 6.8.1 Highlight System

- Highlight laporan penting
- Featured content
- Spotlight system
- Trending topics

---

## 7. PENGGUNAAN SISTEM

### 7.1 Login dan Autentikasi

#### 7.1.1 Akses Sistem

1. Buka browser dan akses URL sistem
2. Masukkan username dan password
3. Klik tombol "Masuk"
4. Sistem akan redirect ke dashboard

#### 7.1.2 Logout

1. Klik menu user di sidebar
2. Pilih "Logout"
3. Sistem akan clear session dan redirect ke login

### 7.2 Dashboard (Beranda)

#### 7.2.1 Fitur Dashboard

- Quick access menu

#### 7.2.2 Navigasi

- Sidebar menu dengan collapse/expand
- Breadcrumb navigation
- Responsive design untuk mobile

### 7.3 Manajemen Laporan Staff

#### 7.3.1 Upload Laporan Staff

1. Pilih menu "Laporan Staff" di sidebar
2. Klik "+ Tambah"
3. Isi form:
   - Jenis Laporan
   - Pimpinan
   - Jenis Media
   - Tanggal Laporan
   - Judul
   - Uraian / Isi Laporan
   - Upload File
4. Klik "Simpan"

#### 7.3.2 Daftar Laporan Staff

1. Akses menu "Laporan Staff" di sidebar
2. Gunakan filter untuk mencari laporan
3. Klik pada tombol "Detail" untuk melihat uraian / isi laporannya
4. Download, Delete atau Edit laporan

#### 7.3.3 Clastering View

1. Klik tombol "Clastering" di menu laporan
2. Isi Jenis Laporan, Pimpinan dan Periode
3. Klik Load Calendar untuk memunculkan daftar file yang ada di Calendar
4. Pilih Rentang Periode Tanggal Awal dan Akhir
5. Download multiple laporan dalam ZIP

### 7.4 Manajemen Laporan Pimpinan

#### 7.4.1 Input Data Isu Prioritas, Khusus, Viralitas

1. Buka menu "Laporan Pimpinan"
2. Pilih menu "Isu Prioritas" di sidebar
3. Pilih menu "Isu Khusus" di sidebar
4. Pilih menu "Isu Viralitas" di sidebar
5. Klik "Tambah Data Baru"
6. Isi form yang sudah disediakan
7. Submit data

#### 7.4.2 Monitoring Isu Prioritas, Khusus, Viralitas

1. Buka menu "Highlight Isu"
2. Pilih menu "Monitoring Prioritas" di sidebar
3. Pilih menu "Monitoring Khusus" di sidebar
4. Pilih menu "Monitoring Viralitas" di sidebar
5. Disana disediakan filter data jika ingin memfilter
6. Terdapat Card Isu Terbaru dan Card Isu yang sebelumnya
7. Klik "Lihat Uraian" untuk melihat uraian isunya

### 7.5 Manajemen OPD

#### 7.5.1 Data OPD

1. Akses menu "OPD"
2. View Organisasi Perangkat Daerah
3. klik "Tambah OPD" untuk Menambah data OPD
4. klik "Edit" untuk Mengedit data OPD
5. klik "Hapus" untuk Menghapus data OPD

---

## 8. TROUBLESHOOTING

### 8.1 Masalah Umum

#### 8.1.1 Koneksi Database Error

**Gejala:** Error "MySQL connection failed"
**Solusi:**

1. Check file `.env` configuration
2. Verify MySQL service running
3. Check firewall settings
4. Verify database credentials

#### 8.1.2 Session Error

**Gejala:** User selalu redirect ke login
**Solusi:**

1. Check SESSION_SECRET in `.env`
2. Verify session middleware configuration
3. Check cookie settings
4. Clear browser cookies

#### 8.1.3 File Upload Error

**Gejala:** File tidak bisa diupload
**Solusi:**

1. Check folder permissions
2. Verify disk space
3. Check file size limits
4. Verify file type restrictions

### 8.2 Error Logs

#### 8.2.1 Server Logs

```bash
# View server logs
tail -f server.log

# Check error logs
grep "ERROR" server.log
```

#### 8.2.2 Database Logs

```sql
-- Check MySQL error log
SHOW VARIABLES LIKE 'log_error';

-- View recent errors
SELECT * FROM mysql.general_log WHERE command_type = 'Query' ORDER BY event_time DESC LIMIT 10;
```

### 8.3 Performance Issues

#### 8.3.1 Slow Database Queries

**Solusi:**

1. Add database indexes
2. Optimize SQL queries
3. Use connection pooling
4. Monitor query performance

#### 8.3.2 Memory Issues

**Solusi:**

1. Increase Node.js memory limit
2. Optimize file uploads
3. Implement caching
4. Monitor memory usage

---

## 9. MAINTENANCE

### 9.1 Backup dan Restore

#### 9.1.1 Database Backup

```bash
# Backup database
mysqldump -u username -p WebIsu > backup_$(date +%Y%m%d).sql

# Backup dengan compression
mysqldump -u username -p WebIsu | gzip > backup_$(date +%Y%m%d).sql.gz
```

#### 9.1.2 File Backup

```bash
# Backup uploads folder
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz public/uploads/

# Backup entire project
tar -czf project_backup_$(date +%Y%m%d).tar.gz --exclude=node_modules --exclude=.git .
```

### 9.2 Update dan Upgrade

#### 9.2.1 Update Dependencies

```bash
# Check outdated packages
npm outdated

# Update packages
npm update

# Update specific package
npm install package@latest
```

#### 9.2.2 Code Update

```bash
# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Restart application
pm2 restart app_name
```

### 9.3 Monitoring

#### 9.3.1 System Monitoring

- CPU usage
- Memory usage
- Disk space
- Network traffic

#### 9.3.2 Application Monitoring

- Response time
- Error rates
- User activity
- Database performance

---

## 10. KEAMANAN

### 10.1 Authentication Security

#### 10.1.1 Password Security

- Password di-hash menggunakan bcrypt
- Minimum password length
- Password complexity requirements
- Regular password updates

#### 10.1.2 Session Security

- Secure session configuration
- Session timeout
- CSRF protection
- Secure cookie settings

### 10.2 Data Security

#### 10.2.1 Database Security

- Encrypted connections
- User access control
- Regular security updates
- Backup encryption

#### 10.2.2 File Security

- File type validation
- File size limits
- Secure file storage
- Access control

### 10.3 Network Security

#### 10.3.1 HTTPS Configuration

```javascript
// Enable HTTPS in production
const https = require("https");
const fs = require("fs");

const options = {
  key: fs.readFileSync("path/to/key.pem"),
  cert: fs.readFileSync("path/to/cert.pem"),
};

https.createServer(options, app).listen(443);
```

#### 10.3.2 Firewall Configuration

- Port restrictions
- IP whitelisting
- Rate limiting
- DDoS protection

---

## 11. DEPLOYMENT

### 11.1 Production Setup

#### 11.1.1 Environment Variables

```env
NODE_ENV=production
PORT=3000
DB_HOST=production_db_host
DB_USER=production_user
DB_PASSWORD=production_password
DB_NAME=production_db
SESSION_SECRET=very_secure_secret_key
```

#### 11.1.2 Process Management

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start server.js --name "isu-viral-web"

# Monitor application
pm2 monit

# View logs
pm2 logs isu-viral-web
```

### 11.2 Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 12. KONTAK DAN SUPPORT

### 12.1 Kontak

- **Email:** iqbalmaulana14042005@gmail.com
- **Phone:** [08816564510]

### 12.2 Dokumentasi Tambahan

- Database Schema
- User Guide
- Developer Guide

---

## 13. REVISI DAN UPDATE

| Versi | Tanggal  | Deskripsi Perubahan |         Author         |
| ----- | -------- | ------------------- | ---------------------- |
| 1.0.0 | Dec 2024 | Initial release     | Mohammad Iqbal Maulana |

---

**Dokumen ini dibuat untuk memudahkan pengguna dan administrator dalam menggunakan dan mengelola sistem SI PANDITA. Untuk pertanyaan lebih lanjut, silakan hubungi kontak yang tersedia.**

**© 2025 SI PANDITA. All rights reserved.**
