const express = require('express');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const flash = require('connect-flash');
const methodOverride = require('method-override');

const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const db = require('./models/db');
const isAuthenticated = require('./middlewares/authMiddleware');

// Routes
const laporanRoutes = require('./routes/laporan');
const authRoutes = require('./routes/auth');
const viralitasRouter = require('./routes/viralitas');
const prioritasRouter = require('./routes/prioritas');
const khususRouter = require('./routes/khusus');
const opdRouter = require('./routes/opd')
const highlightRouter = require('./routes/highlight');
const pimpinanRouter = require('./routes/pimpinan')

// Load environment variables
dotenv.config();
const app = express();

// Suppress specific deprecation warnings
const originalEmit = process.emit;
process.emit = function(name, data, ...args) {
    if(name === 'warning' && data && data.message && data.message.includes('util.isArray')) {
        return false; // Suppress util.isArray warnings
    }
    return originalEmit.apply(process, arguments);
};


// ==================== SETUP & MIDDLEWARE ====================

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Express-EJS-Layouts setup
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Body parser & static files
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Method override for PUT/DELETE requests
app.use(methodOverride('_method'));

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // set true untuk HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 jam
  }
}));

// Flash messages
app.use(flash());

// ==================== PUBLIC ROUTES ====================

// Root redirect
app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/beranda');
  }
  res.redirect('/login');
});

// Halaman login
app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/beranda');
  res.render('login', {
    layout: false,
    error: null
  });
});

// Proses login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.query('SELECT * FROM users WHERE username = ? LIMIT 1', [username], (err, results) => {
    if (err) {
      console.error('Query error:', err);
      return res.status(500).render('login', {
        layout: false,
        error: 'Terjadi kesalahan server.'
      });
    }

    if (results.length === 0) {
      return res.render('login', {
        layout: false,
        error: 'Username tidak ditemukan.'
      });
    }

    const user = results[0];

    bcrypt.compare(password, user.password, (cmpErr, match) => {
      if (cmpErr) {
        console.error('Compare error:', cmpErr);
        return res.render('login', {
          layout: false,
          error: 'Terjadi kesalahan.'
        });
      }

      if (!match) {
        return res.render('login', {
          layout: false,
          error: 'Password salah.'
        });
      }
      req.session.user = {
        id: user.id,
        username: user.username
      };

      return res.redirect('/beranda');
    });
  });
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.redirect('/beranda');
    }
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

// ==================== PROTECTED ROUTES (Perlu Login) ====================

// Middleware: Semua route di bawah ini perlu login
app.use(isAuthenticated);

// Beranda
app.get('/beranda', (req, res) => {
  res.render('beranda', {
    title: 'Beranda',
    currentPage: 'beranda',
    user: req.session.user
  });
});

// Routes dari modules lain
app.use('/', laporanRoutes);
app.use('/', authRoutes);
app.use('/viralitas', viralitasRouter);
app.use('/isu-prioritas', prioritasRouter);
app.use('/isu-khusus', khususRouter);
app.use('/opd', opdRouter);
app.use('/highlight', highlightRouter);
app.use('/pimpinan', pimpinanRouter);

// ==================== ERROR HANDLERS ====================

// 404 Handler
app.use((req, res) => {
  res.status(404).render('beranda', {
    title: '404 - Halaman Tidak Ditemukan',
    currentPage: '',
    user: req.session.user || null
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Terjadi kesalahan server!');
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});

