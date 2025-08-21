const express = require('express');
const router = express.Router();
const db = require('../models/db');

// GET /pimpinan - Tampilkan semua Pimpinan
router.get('/', (req, res) => {
    const query = 'SELECT * FROM kategori_pimpinan WHERE is_deleted = 0 ORDER BY jabatan_pimpinan ASC';

    db.query(query, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error');
        }

        const messages = req.flash('message');
        res.render('Pimpinan/index', {
            title: 'Pimpinan',
            pimpinans: results,
            message: messages.length > 0 ? messages[0] : null,
            currentPage: 'Pimpinan',
        });
    });
});

// GET /pimpinan/create - Tampilkan form tambah Pimpinan
router.get('/create', (req, res) => {
    res.render('Pimpinan/create', {
        title: 'Tambah Pimpinan',
        errors: null,
        currentPage: 'Pimpinan',
    });
});

// POST /pimpinan - Simpan Pimpinan baru
router.post('/', (req, res) => {
    const { jabatan_pimpinan } = req.body;

    // Validasi input
    if (!jabatan_pimpinan || jabatan_pimpinan.trim() === '') {
        return res.render('Pimpinan/create', {
            title: 'Tambah Pimpinan',
            errors: 'Nama Pimpinan tidak boleh kosong',
            currentPage: 'Pimpinan',
        });
    }

    // Validasi session user
    if (!req.session || !req.session.user || !req.session.user.id) {
        return res.render('Pimpinan/create', {
            title: 'Tambah Pimpinan',
            errors: 'Sesi pengguna tidak valid',
            currentPage: 'Pimpinan',
        });
    }

    const userId = req.session.user.id;
    const query = `INSERT INTO kategori_pimpinan (jabatan_pimpinan, is_deleted, created_by, created_at, updated_by, updated_at) 
                   VALUES (?, 0, ?, NOW(), ?, NOW())`;

    db.query(query, [jabatan_pimpinan.trim(), userId, userId], (err, result) => {
        if (err) {
            console.error(err);
            return res.render('Pimpinan/create', {
                title: 'Tambah Pimpinan',
                errors: 'Gagal menyimpan data',
                currentPage: 'Pimpinan',
            });
        }

        req.flash('message', 'Pimpinan berhasil ditambahkan');
        res.redirect('/pimpinan');
    });
});

// GET /pimpinan/edit/:id - Tampilkan form edit Pimpinan
router.get('/edit/:id', (req, res) => {
    const { id } = req.params;
    console.log('Accessing edit route for ID:', id);
    
    // Validasi ID adalah angka
    if (!id || isNaN(id)) {
        console.log('Invalid ID format:', id);
        req.flash('message', 'ID Pimpinan tidak valid');
        return res.redirect('/pimpinan');
    }

    // Bypass auth middleware untuk testing
    const query = 'SELECT * FROM kategori_pimpinan WHERE id_pimpinan = ? AND is_deleted = 0';

    db.query(query, [parseInt(id)], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            req.flash('message', 'Terjadi kesalahan saat mengambil data');
            return res.redirect('/pimpinan');
        }

        if (results.length === 0) {
            console.log('No pimpinan found for ID:', id);
            req.flash('message', 'Pimpinan tidak ditemukan atau sudah dihapus');
            return res.redirect('/pimpinan');
        }

        console.log('Rendering edit page for pimpinan:', results[0]);
        res.render('Pimpinan/edit', {
            title: 'Edit Pimpinan',
            pimpinan: results[0],
            errors: null,
            currentPage: 'Pimpinan',
        });
    });
});

// PUT /pimpinan/:id - Update Pimpinan
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { jabatan_pimpinan } = req.body;

    // Validasi ID adalah angka
    if (!id || isNaN(id)) {
        req.flash('message', 'ID Pimpinan tidak valid');
        return res.redirect('/pimpinan');
    }

    // Validasi input
    if (!jabatan_pimpinan || jabatan_pimpinan.trim() === '') {
        const query = 'SELECT * FROM kategori_pimpinan WHERE id_pimpinan = ? AND is_deleted = 0';
        db.query(query, [parseInt(id)], (err, results) => {
            if (err || results.length === 0) {
                req.flash('message', 'Pimpinan tidak ditemukan');
                return res.redirect('/pimpinan');
            }

            return res.render('Pimpinan/edit', {
                title: 'Edit Pimpinan',
                pimpinan: results[0],
                errors: 'Nama Pimpinan tidak boleh kosong',
                currentPage: 'Pimpinan',
            });
        });
        return;
    }

    // Validasi session user
    if (!req.session || !req.session.user || !req.session.user.id) {
        req.flash('message', 'Sesi pengguna tidak valid');
        return res.redirect('/pimpinan');
    }

    const userId = req.session.user.id;
    const query = `UPDATE kategori_pimpinan SET jabatan_pimpinan = ?, updated_by = ?, updated_at = NOW() 
                   WHERE id_pimpinan = ? AND is_deleted = 0`;

    db.query(query, [jabatan_pimpinan.trim(), userId, parseInt(id)], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            req.flash('message', 'Gagal mengupdate data: ' + err.message);
            return res.redirect(`/pimpinan/edit/${id}`);
        }

        if (result.affectedRows === 0) {
            req.flash('message', 'Pimpinan tidak ditemukan atau sudah dihapus');
            return res.redirect('/pimpinan');
        }

        req.flash('message', 'Pimpinan berhasil diupdate');
        res.redirect('/pimpinan');
    });
});

// DELETE /pimpinan/:id - Soft delete Pimpinan
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    
    // Validasi ID adalah angka
    if (!id || isNaN(id)) {
        return res.status(400).json({ success: false, message: 'ID Pimpinan tidak valid' });
    }

    // Validasi session user
    if (!req.session || !req.session.user || !req.session.user.id) {
        return res.status(401).json({ success: false, message: 'Sesi pengguna tidak valid' });
    }

    const userId = req.session.user.id;
    const query = `UPDATE kategori_pimpinan SET is_deleted = 1, updated_by = ?, updated_at = NOW() 
                   WHERE id_pimpinan = ? AND is_deleted = 0`;

    db.query(query, [userId, parseInt(id)], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Pimpinan tidak ditemukan' });
        }

        res.json({ success: true, message: 'Pimpinan berhasil dihapus' });
    });
});

module.exports = router;
