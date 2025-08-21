var express = require('express');
var router = express.Router();
var connection = require('../models/db')
var bcrypt = require('bcrypt');

// Halaman login
router.get('/login', function (req, res) {
    if (req.session.user) {
        return res.redirect('/beranda');
    }
    res.render('login', { layout: false, error: null });
});

// Proses login
router.post('/login', function (req, res) {
    let username = req.body.username;
    let password = req.body.password;

    if (!username || !password) {
        return res.render('login', { layout: false, error: 'Username dan password wajib diisi.' });
    }

    connection.query('SELECT * FROM users WHERE username = ? LIMIT 1', [username], function (err, results) {
        if (err) {
            console.error(err);
            return res.render('login', { layout: false, error: 'Terjadi kesalahan server.' });
        }

        if (results.length === 0) {
            return res.render('login', { layout: false, error: 'Username tidak ditemukan.' });
        }

        let user = results[0];
        bcrypt.compare(password, user.password, function (cmpErr, match) {
            if (cmpErr) {
                console.error(cmpErr);
                return res.render('login', { layout: false, error: 'Terjadi kesalahan.' });
            }
            if (!match) {
                return res.render('login', { layout: false, error: 'Password salah.' });
            }

            // Simpan ke session
            req.session.user = {
                id_user: user.id_user,
                username: user.username,
                role: user.role || null
            };
            res.redirect('/beranda');
        });
    });
});

// Logout
router.get('/logout', function (req, res) {
    req.session.destroy(function (err) {
        if (err) console.error(err);
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

module.exports = router;
