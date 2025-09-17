const express = require('express');
const router = express.Router();
const db = require('../models/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/mediaonline/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Ensure upload directory exists
const uploadDir = 'public/uploads/mediaonline/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// GET / - Index page
router.get('/', (req, res) => {
    const query = `
        SELECT id, nama_media, file_name, file_path, created_at
        FROM Databasemedia
        WHERE kategori = 'Media Online' AND is_deleted = 0
        ORDER BY created_at DESC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Database error:', err);
            req.flash('error', 'Terjadi kesalahan saat mengambil data');
            return res.redirect('/beranda');
        }

        res.render('DatabaseMedia/MediaOnline/index', {
            title: 'Media Online',
            media: results,
            currentPage: 'mediaonline'
        });
    });
});

// GET /create - Create form
router.get('/create', (req, res) => {
    res.render('DatabaseMedia/MediaOnline/create', {
        title: 'Tambah Media Online',
        currentPage: 'mediaonline'
    });
});

// POST /create - Handle create
router.post('/create', upload.single('file'), (req, res) => {
    const { nama_media } = req.body;
    const file = req.file;

    if (!nama_media) {
        return res.send(`
            <script>
                alert('Nama media harus diisi');
                window.history.back();
            </script>
        `);
    }

    let file_name = null;
    let file_path = null;
    let file_size = null;

    if (file) {
        file_name = file.originalname;
        file_path = '/uploads/mediaonline/' + file.filename;
        file_size = file.size;
    }

    const query = `
        INSERT INTO Databasemedia (nama_media, kategori, file_name, file_path, file_size, created_by)
        VALUES (?, 'Media Online', ?, ?, ?, ?)
    `;

    db.query(query, [nama_media, file_name, file_path, file_size, req.session.user.username], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.send(`
                <script>
                    alert('Terjadi kesalahan saat menyimpan data: ${err.message}');
                    window.history.back();
                </script>
            `);
        }

        res.redirect('/media');
    });
});

// GET /edit/:id - Edit form
router.get('/edit/:id', (req, res) => {
    const { id } = req.params;

    db.query('SELECT * FROM Databasemedia WHERE id = ? AND is_deleted = 0', [id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            req.flash('error', 'Terjadi kesalahan saat mengambil data');
            return res.redirect('/media');
        }

        if (results.length === 0) {
            req.flash('error', 'Data tidak ditemukan');
            return res.redirect('/media');
        }

        res.render('DatabaseMedia/MediaOnline/edit', {
            title: 'Edit Media Online',
            media: results[0],
            currentPage: 'mediaonline'
        });
    });
});

// POST /edit/:id - Handle update
router.post('/edit/:id', upload.single('file'), (req, res) => {
    const { id } = req.params;
    const { nama_media } = req.body;
    const file = req.file;

    if (!nama_media) {
        return res.send(`
            <script>
                alert('Nama media harus diisi');
                window.history.back();
            </script>
        `);
    }

    // First get current data
    db.query('SELECT * FROM Databasemedia WHERE id = ? AND is_deleted = 0', [id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.send(`
                <script>
                    alert('Terjadi kesalahan saat mengambil data: ${err.message}');
                    window.location.href = '/media';
                </script>
            `);
        }

        if (results.length === 0) {
            return res.send(`
                <script>
                    alert('Data tidak ditemukan');
                    window.location.href = '/media';
                </script>
            `);
        }

        const current = results[0];
        let file_name = current.file_name;
        let file_path = current.file_path;
        let file_size = current.file_size;

        if (file) {
            // Delete old file if exists
            if (current.file_path) {
                const oldFilePath = path.join('public', current.file_path);
                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                }
            }

            file_name = file.originalname;
            file_path = '/uploads/mediaonline/' + file.filename;
            file_size = file.size;
        }

        const query = `
            UPDATE Databasemedia
            SET nama_media = ?, file_name = ?, file_path = ?, file_size = ?, updated_by = ?
            WHERE id = ? AND is_deleted = 0
        `;

        db.query(query, [nama_media, file_name, file_path, file_size, req.session.user.username, id], (err, result) => {
            if (err) {
                console.error('Database error:', err);
                return res.send(`
                    <script>
                        alert('Terjadi kesalahan saat mengupdate data: ${err.message}');
                        window.history.back();
                    </script>
                `);
            }

            res.redirect('/media');
        });
    });
});

// GET /delete/:id - Soft delete
router.get('/delete/:id', (req, res) => {
    const { id } = req.params;

    const query = `
        UPDATE Databasemedia
        SET is_deleted = 1, updated_by = ?
        WHERE id = ? AND is_deleted = 0
    `;

    db.query(query, [req.session.user.username, id], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.send(`
                <script>
                    alert('Terjadi kesalahan saat menghapus data: ${err.message}');
                    window.location.href = '/media';
                </script>
            `);
        }

        if (result.affectedRows === 0) {
            return res.send(`
                <script>
                    alert('Data tidak ditemukan');
                    window.location.href = '/media';
                </script>
            `);
        }

        res.redirect('/media');
    });
});

module.exports = router;
