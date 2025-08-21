const express = require('express');
const router = express.Router();
const db = require('../models/db');

// GET /opd - Tampilkan semua OPD
router.get('/', (req, res) => {
    const query = 'SELECT * FROM opd WHERE is_deleted = 0 ORDER BY nama_opd ASC';

    db.query(query, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error');
        }

        const messages = req.flash('message');
        res.render('Opd/index', {
            title: 'Organisasi Perangkat Daerah',
            opds: results,
            message: messages.length > 0 ? messages[0] : null,
            currentPage: 'Organisasi Perangkat Daerah',
        });
    });
});

// GET /opd/create - Tampilkan form tambah OPD
router.get('/create', (req, res) => {
    res.render('Opd/create', {
        title: 'Tambah OPD',
        errors: null,
        currentPage: 'Organisasi Perangkat Daerah',
    });
});

// POST /opd - Simpan OPD baru
router.post('/', (req, res) => {
    const { nama_opd } = req.body;

    // Validasi input
    if (!nama_opd || nama_opd.trim() === '') {
        return res.render('Opd/create', {
            title: 'Tambah OPD',
            errors: 'Nama OPD tidak boleh kosong',
            currentPage: 'Organisasi Perangkat Daerah',
        });
    }

    // Validasi session user
    if (!req.session || !req.session.user || !req.session.user.id) {
        return res.render('Opd/create', {
            title: 'Tambah OPD',
            errors: 'Sesi pengguna tidak valid',
            currentPage: 'Organisasi Perangkat Daerah',
        });
    }

    const userId = req.session.user.id;
    const query = `INSERT INTO opd (nama_opd, is_deleted, created_by, created_at, updated_by, updated_at) 
                   VALUES (?, 0, ?, NOW(), ?, NOW())`;

    db.query(query, [nama_opd.trim(), userId, userId], (err, result) => {
        if (err) {
            console.error(err);
            return res.render('Opd/create', {
                title: 'Tambah OPD',
                errors: 'Gagal menyimpan data',
                currentPage: 'Organisasi Perangkat Daerah',
            });
        }

        req.flash('message', 'OPD berhasil ditambahkan');
        res.redirect('/opd');
    });
});

// GET /opd/edit/:id - Tampilkan form edit OPD
router.get('/edit/:id', (req, res) => {
    const { id } = req.params;
    const query = 'SELECT * FROM opd WHERE id = ? AND is_deleted = 0';

    db.query(query, [id], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error');
        }

        if (results.length === 0) {
            req.flash('message', 'OPD tidak ditemukan');
            return res.redirect('/opd');
        }

        res.render('Opd/edit', {
            title: 'Edit OPD',
            opd: results[0],
            errors: null,
            currentPage: 'Organisasi Perangkat Daerah',
        });
    });
});

// PUT /opd/:id - Update OPD
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { nama_opd } = req.body;

    // Validasi input
    if (!nama_opd || nama_opd.trim() === '') {
        const query = 'SELECT * FROM opd WHERE id = ? AND is_deleted = 0';
        db.query(query, [id], (err, results) => {
            if (err || results.length === 0) {
                req.flash('message', 'OPD tidak ditemukan');
                return res.redirect('/opd');
            }

            return res.render('Opd/edit', {
                title: 'Edit OPD',
                opd: results[0],
                errors: 'Nama OPD tidak boleh kosong',
                currentPage: 'Organisasi Perangkat Daerah',
            });
        });
        return;
    }

    // Validasi session user
    if (!req.session || !req.session.user || !req.session.user.id) {
        req.flash('message', 'Sesi pengguna tidak valid');
        return res.redirect('/opd');
    }

    const userId = req.session.user.id;
    const query = `UPDATE opd SET nama_opd = ?, updated_by = ?, updated_at = NOW() 
                   WHERE id = ? AND is_deleted = 0`;

    db.query(query, [nama_opd.trim(), userId, id], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            req.flash('message', 'Gagal mengupdate data: ' + err.message);
            return res.redirect(`/Opd/edit/${id}`);
        }

        if (result.affectedRows === 0) {
            req.flash('message', 'OPD tidak ditemukan atau sudah dihapus');
            return res.redirect('/opd');
        }

        req.flash('message', 'OPD berhasil diupdate');
        res.redirect('/opd');
    });
});

// DELETE /opd/:id - Soft delete OPD
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    
    // Validasi session user
    if (!req.session || !req.session.user || !req.session.user.id) {
        return res.status(401).json({ success: false, message: 'Sesi pengguna tidak valid' });
    }

    const userId = req.session.user.id;
    const query = `UPDATE opd SET is_deleted = 1, updated_by = ?, updated_at = NOW() 
                   WHERE id = ? AND is_deleted = 0`;

    db.query(query, [userId, id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'OPD tidak ditemukan' });
        }

        res.json({ success: true, message: 'OPD berhasil dihapus' });
    });
});

module.exports = router;