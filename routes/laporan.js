const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middlewares/authMiddleware');
const db = require('../models/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const moment = require('moment');
const archiver = require('archiver');
moment.locale('id');

// ========== CONSTANTS ==========
const JENIS_MAP = {
    1: 'Daily',
    2: 'Weekly',
    3: 'Rekap Statement',
    4: 'Bulanan',
    5: 'Tahunan',
};

const ALLOWED_LIMITS = [5, 10, 20, 50, 100, 1000, 10000];

// ========== HELPER FUNCTIONS ==========
function sanitizeFileName(name) {
    return name.replace(/[^a-zA-Z0-9\-_]/g, '_');
}

function getUploadPath(jenisLaporan, pimpinanName, tanggalLaporan) {
    const jenisFolder = JENIS_MAP[jenisLaporan] || 'Unknown';
    const pimpinanFolder = sanitizeFileName(pimpinanName);
    const date = new Date(tanggalLaporan);
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const fullDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    return {
        relativePath: `uploads/laporan/${jenisFolder}/${pimpinanFolder}/${yearMonth}/${fullDate}`,
        fullPath: path.join(__dirname, `../public/uploads/laporan/${jenisFolder}/${pimpinanFolder}/${yearMonth}/${fullDate}`)
    };
}

function formatDateForInput(dateValue) {
    if (!dateValue) return '';
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ========== MULTER CONFIGURATION ==========
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Get form data to determine path
        const { jenis_laporan, id_pimpinan, tanggal_laporan } = req.body;

        // UBAH BAGIAN INI - Handle ketika pimpinan kosong
        if (!id_pimpinan) {
            // Gunakan folder default ketika pimpinan tidak dipilih
            const jenisFolder = JENIS_MAP[jenis_laporan] || 'Unknown';
            const date = tanggal_laporan ? new Date(tanggal_laporan) : new Date();
            const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const fullDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

            const fullPath = path.join(__dirname, `../public/uploads/laporan/${jenisFolder}/No-Pimpinan/${yearMonth}/${fullDate}`);

            // Create directory if not exists
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }

            return cb(null, fullPath);
        }

        // Get pimpinan name (hanya jika id_pimpinan ada)
        const qPimpinan = `SELECT jabatan_pimpinan FROM kategori_pimpinan WHERE id_pimpinan = ? AND is_deleted = 0`;

        db.query(qPimpinan, [id_pimpinan], (err, rows) => {
            if (err || !rows.length) {
                return cb(new Error('Pimpinan tidak ditemukan'));
            }

            const pimpinanName = rows[0].jabatan_pimpinan;
            const { fullPath } = getUploadPath(jenis_laporan, pimpinanName, tanggal_laporan);

            // Create directory if not exists
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }

            cb(null, fullPath);
        });
    },
    filename: function (req, file, cb) {
        const timestamp = Date.now();
        const filename = `${timestamp}_${file.originalname}`;
        cb(null, filename);
    }
});

const upload = multer({ storage: storage });

// ========== NEW ROUTES FOR CALENDAR & ZIP DOWNLOAD ==========

// GET /laporan/calendar - Calendar interface
router.get('/laporan/calendar', isAuthenticated, (req, res) => {
    const qPimpinan = `
        SELECT id_pimpinan, jabatan_pimpinan
        FROM kategori_pimpinan
        WHERE is_deleted = 0
        ORDER BY jabatan_pimpinan
    `;

    db.query(qPimpinan, (err, pimpinanList) => {
        if (err) {
            return res.status(500).send('Terjadi kesalahan server.');
        }

        res.render('LaporanStaff/laporan_calendar', {
            title: 'Calendar Download Laporan',
            currentPage: 'laporan',
            pimpinanList,
            JENIS_MAP
        });
    });
});

// POST /laporan/download-zip - Download ZIP (per-hari, per-bulan, atau rentang)
router.post('/laporan/download-zip', isAuthenticated, (req, res) => {
    const { jenis_laporan, id_pimpinan, year, month, day, startDate, endDate } = req.body;


    const jenisFolder = JENIS_MAP[jenis_laporan] || 'Unknown';

    if (!id_pimpinan || id_pimpinan === '') {
        // Path untuk laporan tanpa pimpinan
        const pimpinanFolder = 'No-Pimpinan';
        const baseMonthPath = path.join(
            __dirname,
            `../public/uploads/laporan/${jenisFolder}/${pimpinanFolder}/${year}-${month}`
        );

        const archive = archiver('zip', { zlib: { level: 9 } });
        let zipFileName = '';

        res.setHeader('Content-Type', 'application/zip');

        // MODE: rentang tanggal
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);

            if (isNaN(start) || isNaN(end)) {
                return res.status(400).send('Format tanggal tidak valid.');
            }
            if (end < start) {
                return res.status(400).send('Tanggal akhir tidak boleh lebih kecil dari tanggal awal.');
            }

            zipFileName = `${jenisFolder}_${pimpinanFolder}_${start.toISOString().slice(0, 10)}_sampai_${end.toISOString().slice(0, 10)}.zip`;
            res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
            archive.pipe(res);

            let anyAdded = false;
            let cur = new Date(start);

            while (cur <= end) {
                const y = cur.getFullYear();
                const m = String(cur.getMonth() + 1).padStart(2, '0');
                const d = String(cur.getDate()).padStart(2, '0');
                const fullDate = `${y}-${m}-${d}`;

                const monthPath = path.join(
                    __dirname,
                    `../public/uploads/laporan/${jenisFolder}/${pimpinanFolder}/${y}-${m}`
                );
                const dayDir = path.join(monthPath, fullDate);

                if (fs.existsSync(dayDir)) {
                    archive.directory(dayDir, fullDate);
                    anyAdded = true;
                }

                cur.setDate(cur.getDate() + 1); // next day
            }

            if (!anyAdded) return res.status(404).send('Tidak ada file pada periode tersebut.');
            archive.finalize();
            archive.on('error', err => {
                console.error('Archive error:', err);
                res.status(500).send('Gagal membuat ZIP file.');
            });
            return;
        }

        // MODE: per-hari
        if (day) {
            const fullDate = `${year}-${month}-${day}`;
            const targetPath = path.join(baseMonthPath, fullDate);
            if (!fs.existsSync(targetPath)) return res.status(404).send('Tidak ada file untuk tanggal tersebut.');
            zipFileName = `${jenisFolder}_${pimpinanFolder}_${fullDate}.zip`;
            res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
            archive.pipe(res);
            archive.directory(targetPath, false);
            archive.finalize();
            return;
        }

        // MODE: per-bulan
        if (!fs.existsSync(baseMonthPath)) return res.status(404).send('Tidak ada file untuk bulan tersebut.');
        zipFileName = `${jenisFolder}_${pimpinanFolder}_${year}-${month}.zip`;
        res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
        archive.pipe(res);
        archive.directory(baseMonthPath, false);
        archive.finalize();
        return;
    }

    const qPimpinan = `SELECT jabatan_pimpinan FROM kategori_pimpinan WHERE id_pimpinan = ? AND is_deleted = 0`;
    db.query(qPimpinan, [id_pimpinan], (err, rows) => {
        if (err || !rows.length) return res.status(500).send('Pimpinan tidak ditemukan.');

    });
});


// GET /laporan/api/calendar-data - API untuk calendar data
router.get('/laporan/api/calendar-data', isAuthenticated, (req, res) => {
    const { jenis_laporan, id_pimpinan, year, month } = req.query;

    if (!jenis_laporan || !year || !month) {
        return res.json({ dates: [] });
    }

    // UBAH BAGIAN INI - Handle ketika pimpinan kosong
    if (!id_pimpinan || id_pimpinan === '') {
        // Path untuk laporan tanpa pimpinan
        const jenisFolder = JENIS_MAP[jenis_laporan] || 'Unknown';
        const monthPath = path.join(__dirname, `../public/uploads/laporan/${jenisFolder}/No-Pimpinan/${year}-${month}`);

        if (!fs.existsSync(monthPath)) {
            return res.json({ dates: [] });
        }

        // Read dates in month
        const dates = [];
        const items = fs.readdirSync(monthPath);

        items.forEach(item => {
            const itemPath = path.join(monthPath, item);
            if (fs.statSync(itemPath).isDirectory()) {
                // Check if it's a valid date format (YYYY-MM-DD)
                const dateMatch = item.match(/^\d{4}-\d{2}-(\d{2})$/);
                if (dateMatch) {
                    const day = parseInt(dateMatch[1]);

                    // Count files in this date
                    const files = fs.readdirSync(itemPath).filter(f =>
                        fs.statSync(path.join(itemPath, f)).isFile()
                    );

                    if (files.length > 0) {
                        dates.push({
                            day: day,
                            fileCount: files.length,
                            files: files.map(f => ({
                                name: f,
                                path: `uploads/laporan/${jenisFolder}/No-Pimpinan/${year}-${month}/${item}/${f}`
                            }))
                        });
                    }
                }
            }
        });

        dates.sort((a, b) => a.day - b.day);
        return res.json({ dates });
    }

    // Existing code untuk ketika ada pimpinan (TIDAK BERUBAH)
    const qPimpinan = `SELECT jabatan_pimpinan FROM kategori_pimpinan WHERE id_pimpinan = ? AND is_deleted = 0`;

    db.query(qPimpinan, [id_pimpinan], (err, rows) => {
        if (err || !rows.length) {
            return res.json({ dates: [] });
        }

        const pimpinanName = rows[0].jabatan_pimpinan;
        const jenisFolder = JENIS_MAP[jenis_laporan] || 'Unknown';
        const pimpinanFolder = sanitizeFileName(pimpinanName);
        const monthPath = path.join(__dirname, `../public/uploads/laporan/${jenisFolder}/${pimpinanFolder}/${year}-${month}`);

        if (!fs.existsSync(monthPath)) {
            return res.json({ dates: [] });
        }

        // Read dates in month
        const dates = [];
        const items = fs.readdirSync(monthPath);

        items.forEach(item => {
            const itemPath = path.join(monthPath, item);
            if (fs.statSync(itemPath).isDirectory()) {
                // Check if it's a valid date format (YYYY-MM-DD)
                const dateMatch = item.match(/^\d{4}-\d{2}-(\d{2})$/);
                if (dateMatch) {
                    const day = parseInt(dateMatch[1]);

                    // Count files in this date
                    const files = fs.readdirSync(itemPath).filter(f =>
                        fs.statSync(path.join(itemPath, f)).isFile()
                    );

                    if (files.length > 0) {
                        dates.push({
                            day: day,
                            fileCount: files.length,
                            files: files.map(f => ({
                                name: f,
                                path: `uploads/laporan/${jenisFolder}/${pimpinanFolder}/${year}-${month}/${item}/${f}`
                            }))
                        });
                    }
                }
            }
        });

        dates.sort((a, b) => a.day - b.day);
        res.json({ dates });
    });
});

// ========== EXISTING ROUTES (UPDATED) ==========

// GET /laporan - List laporan with pagination and filters
router.get('/laporan', isAuthenticated, (req, res) => {
    const searchJudul = req.query.search_judul ? req.query.search_judul.trim() : '';
    const searchIsi = req.query.search_isi ? req.query.search_isi.trim() : '';
    const filterPimpinan = req.query.pimpinan ? Number(req.query.pimpinan) : null;
    const filterJenisLaporan = req.query.jenis ? Number(req.query.jenis) : null;
    const tanggalDari = req.query.tanggal_dari || '';
    const tanggalSampai = req.query.tanggal_sampai || '';

    let limit = req.query.limit ? Number(req.query.limit) : 5;
    if (!ALLOWED_LIMITS.includes(limit)) {
        limit = 5;
    }

    const page = req.query.page ? Number(req.query.page) : 1;
    const offset = (page - 1) * limit;

    // Validasi format tanggal
    function isValidDate(dateString) {
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        return regex.test(dateString);
    }
    if (tanggalDari && !isValidDate(tanggalDari)) {
        return res.status(400).send('Format tanggal mulai tidak valid.');
    }
    if (tanggalSampai && !isValidDate(tanggalSampai)) {
        return res.status(400).send('Format tanggal akhir tidak valid.');
    }

    // Query dropdown pimpinan
    const qPimpinan = `
        SELECT id_pimpinan, jabatan_pimpinan
        FROM kategori_pimpinan
        WHERE is_deleted = 0
        ORDER BY jabatan_pimpinan
    `;

    db.query(qPimpinan, (errPimpinan, pimpinanList) => {
        if (errPimpinan) {
            return res.status(500).send('Terjadi kesalahan server.');
        }

        const jenisList = Object.keys(JENIS_MAP).map(k => ({
            id_jenis: Number(k),
            nama_jenis: JENIS_MAP[k]
        }));

        // Base query count
        let countSql = `SELECT COUNT(*) as total FROM laporan_staff a WHERE a.is_deleted = 0`;
        const countParams = [];

        // Base query data
        let sql = `
            SELECT a.id, a.jenis_laporan, a.id_pimpinan, a.id_jenis, a.judul, a.isi_laporan, a.tanggal_laporan,
                   a.created_at, a.updated_at, a.is_deleted, a.file_name, a.file_path, a.file_size,
                   kp.jabatan_pimpinan AS nama_pimpinan,
                   j.nama_jenis
            FROM laporan_staff a
            LEFT JOIN kategori_pimpinan kp ON a.id_pimpinan = kp.id_pimpinan
            LEFT JOIN jenis j ON a.id_jenis = j.id_jenis
            WHERE a.is_deleted = 0
        `;
        const params = [];

        // Search conditions
        let searchConditions = [];
        if (searchJudul) {
            searchConditions.push('LOWER(a.judul) LIKE LOWER(?)');
            countParams.push(`%${searchJudul}%`);
            params.push(`%${searchJudul}%`);
        }
        if (searchIsi) {
            searchConditions.push('LOWER(a.isi_laporan) LIKE LOWER(?)');
            countParams.push(`%${searchIsi}%`);
            params.push(`%${searchIsi}%`);
        }
        if (searchConditions.length > 0) {
            const whereSearch = ` AND (${searchConditions.join(' OR ')})`;
            countSql += whereSearch;
            sql += whereSearch;
        }

        // Filter pimpinan
        if (filterPimpinan) {
            countSql += ' AND a.id_pimpinan = ?';
            sql += ' AND a.id_pimpinan = ?';
            countParams.push(filterPimpinan);
            params.push(filterPimpinan);
        }

        // Filter jenis laporan
        if (filterJenisLaporan) {
            countSql += ' AND a.jenis_laporan = ?';
            sql += ' AND a.jenis_laporan = ?';
            countParams.push(filterJenisLaporan);
            params.push(filterJenisLaporan);
        }

        // Filter tanggal
        if (tanggalDari && tanggalSampai) {
            countSql += ' AND a.tanggal_laporan BETWEEN ? AND ?';
            sql += ' AND a.tanggal_laporan BETWEEN ? AND ?';
            countParams.push(tanggalDari, tanggalSampai);
            params.push(tanggalDari, tanggalSampai);
        } else if (tanggalDari) {
            countSql += ' AND a.tanggal_laporan = ?';
            sql += ' AND a.tanggal_laporan = ?';
            countParams.push(tanggalDari);
            params.push(tanggalDari);
        } else if (tanggalSampai) {
            countSql += ' AND a.tanggal_laporan = ?';
            sql += ' AND a.tanggal_laporan = ?';
            countParams.push(tanggalSampai);
            params.push(tanggalSampai);
        }

        // Pagination
        sql += ' ORDER BY a.tanggal_laporan DESC, a.id DESC LIMIT ?, ?';
        params.push(offset, limit);

        db.query(countSql, countParams, (countErr, countRows) => {
            if (countErr) {
                return res.status(500).send('Terjadi kesalahan server.');
            }

            const totalData = countRows[0].total;
            const totalPages = Math.ceil(totalData / limit);

            if (page > totalPages && totalPages > 0) {
                return res.redirect('/laporan');
            }

            db.query(sql, params, (err, rows) => {
                if (err) {
                    return res.status(500).send('Terjadi kesalahan server.');
                }

                const dataFormatted = rows.map(r => ({
                    ...r,
                    tanggal_laporan: formatDateForInput(r.tanggal_laporan)
                }));

                const hasFilter = searchJudul || searchIsi || filterPimpinan || filterJenisLaporan || tanggalDari || tanggalSampai;
                let filterInfo = '';
                if (hasFilter) {
                    const filterParts = [];
                    if (searchJudul) filterParts.push(`judul: "${searchJudul}"`);
                    if (searchIsi) filterParts.push(`isi: "${searchIsi}"`);
                    if (filterPimpinan) {
                        const p = pimpinanList.find(pp => pp.id_pimpinan === filterPimpinan);
                        if (p) filterParts.push(`pimpinan: "${p.jabatan_pimpinan}"`);
                    }
                    if (filterJenisLaporan) {
                        const j = jenisList.find(jj => jj.id_jenis === filterJenisLaporan);
                        if (j) filterParts.push(`jenis: "${j.nama_jenis}"`);
                    }
                    if (tanggalDari && tanggalSampai) filterParts.push(`tanggal: ${tanggalDari} s/d ${tanggalSampai}`);
                    else if (tanggalDari) filterParts.push(`tanggal: dari ${tanggalDari}`);
                    else if (tanggalSampai) filterParts.push(`tanggal: sampai ${tanggalSampai}`);
                    filterInfo = filterParts.join(', ');
                }

                res.render('LaporanStaff/laporan_list', {
                    title: 'Laporan Staff',
                    data: dataFormatted,
                    JENIS_MAP,
                    currentPage: 'laporan',
                    pimpinanList,
                    jenisList,
                    searchJudul,
                    searchIsi,
                    filterPimpinan,
                    filterJenis: filterJenisLaporan,
                    tanggalDari,
                    tanggalSampai,
                    hasFilter,
                    filterInfo,
                    pagination: {
                        currentPage: page,
                        totalPages,
                        totalData,
                        startRecord: totalData > 0 ? offset + 1 : 0,
                        endRecord: Math.min(offset + limit, totalData),
                        hasNext: page < totalPages,
                        hasPrev: page > 1,
                        limit
                    }
                });
            });
        });
    });
});

// GET /laporan/page/:page - List with pagination
router.get('/laporan/page/:page', isAuthenticated, (req, res) => {
    const page = parseInt(req.params.page) || 1;
    const queryParams = { ...req.query, page: page };
    const queryString = new URLSearchParams(queryParams).toString();

    res.redirect(`/laporan?${queryString}`);
});

// GET /laporan/tambah - Form tambah
router.get('/laporan/tambah', isAuthenticated, (req, res) => {
    const qP = `
        SELECT id_pimpinan, jabatan_pimpinan
        FROM kategori_pimpinan
        WHERE is_deleted = 0
        ORDER BY jabatan_pimpinan
    `;
    const qJ = `
        SELECT id_jenis, nama_jenis
        FROM jenis
        WHERE is_deleted = 0
        ORDER BY nama_jenis
    `;

    db.query(qP, (e1, pimpinan) => {
        if (e1) return res.status(500).send('Gagal ambil data pimpinan.');
        db.query(qJ, (e2, jenis) => {
            if (e2) return res.status(500).send('Gagal ambil data jenis media.');
            res.render('LaporanStaff/laporan_form', {
                title: 'Tambah Laporan',
                pimpinan,
                jenis,
                JENIS_MAP,
                currentPage: 'laporan'
            });
        });
    });
});

// POST /laporan/tambah - Create laporan (UPDATED)
router.post('/laporan/tambah', isAuthenticated, upload.single('file_upload'), (req, res) => {
    const { jenis_laporan, id_pimpinan, id_jenis, tanggal_laporan, judul, isi_laporan } = req.body;

    let file_name = null;
    let file_path = null;
    let file_size = null;

    if (req.file) {
        file_name = req.file.originalname;
        // hitung path relatif terhadap folder /public
        const publicRoot = path.join(__dirname, '../public');
        file_path = path
            .relative(publicRoot, req.file.path)
            .replace(/\\/g, '/'); // windows safe
        file_size = req.file.size;
    }

    const sql = `
        INSERT INTO laporan_staff
        (jenis_laporan, id_pimpinan, id_jenis, tanggal_laporan, judul, isi_laporan,
         file_name, file_path, file_size, is_deleted, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NOW())
    `;
    const params = [
        Number(jenis_laporan),
        id_pimpinan ? Number(id_pimpinan) : null,
        id_jenis ? Number(id_jenis) : null,
        tanggal_laporan || null,
        judul,
        isi_laporan || null,
        file_name,
        file_path,
        file_size,
        (req.session?.user?.username) || 'system'
    ];

    db.query(sql, params, (err) => {
        if (err) {
            return res.status(500).send('Gagal menyimpan laporan.');
        }
        const backJenis = jenis_laporan ? `?jenis=${jenis_laporan}` : '';
        res.redirect('/laporan' + backJenis);
    });
});

// GET /laporan/download/:id - Download file (UPDATED)
router.get('/laporan/download/:id', isAuthenticated, (req, res) => {
    const { id } = req.params;

    const sql = `
        SELECT file_name, file_path
        FROM laporan_staff
        WHERE id = ? AND is_deleted = 0 AND file_name IS NOT NULL
        LIMIT 1
    `;

    db.query(sql, [id], (err, rows) => {
        if (err) {
            return res.status(500).send('Terjadi kesalahan server.');
        }

        if (rows.length === 0) {
            return res.status(404).send('File tidak ditemukan.');
        }

        const { file_name, file_path } = rows[0];
        const fullPath = path.join(__dirname, '../public/', file_path);

        if (!fs.existsSync(fullPath)) {
            return res.status(404).send('File tidak ditemukan di server.');
        }

        res.setHeader('Content-Disposition', `attachment; filename="${file_name}"`);
        res.setHeader('Content-Type', 'application/octet-stream');

        res.download(fullPath, file_name, (err) => {
            if (err) {
                return res.status(500).send('Gagal mendownload file.');
            }
        });
    });
});

// GET /laporan/hapus/:id - Soft delete
router.get('/laporan/hapus/:id', isAuthenticated, (req, res) => {
    const { id } = req.params;
    const sql = `
        UPDATE laporan_staff
        SET is_deleted = 1, updated_by = ?, updated_at = NOW()
        WHERE id = ?
    `;
    db.query(sql, [(req.session?.user?.username) || 'system', id], (err) => {
        if (err) {
            return res.status(500).send('Gagal menghapus.');
        }
        res.redirect('/laporan');
    });
});

// GET /laporan/edit/:id - Form edit
router.get('/laporan/edit/:id', isAuthenticated, (req, res) => {
    const { id } = req.params;

    const qDetail = `
        SELECT a.*
        FROM laporan_staff a
        WHERE a.id = ? AND a.is_deleted = 0
        LIMIT 1
    `;
    const qP = `
        SELECT id_pimpinan, jabatan_pimpinan
        FROM kategori_pimpinan
        WHERE is_deleted = 0
        ORDER BY jabatan_pimpinan
    `;
    const qJ = `
        SELECT id_jenis, nama_jenis
        FROM jenis
        WHERE is_deleted = 0
        ORDER BY nama_jenis
    `;

    db.query(qDetail, [id], (eD, rows) => {
        if (eD) {
            return res.status(500).send('Gagal mengambil data.');
        }
        if (rows.length === 0) {
            return res.status(404).send('Data tidak ditemukan atau sudah dihapus.');
        }

        const detail = rows[0];
        const detailFormatted = {
            ...detail,
            tanggal_laporan_str: formatDateForInput(detail.tanggal_laporan)
        };

        db.query(qP, (eP, pimpinan) => {
            if (eP) return res.status(500).send('Gagal ambil data pimpinan.');
            db.query(qJ, (eJ, jenis) => {
                if (eJ) return res.status(500).send('Gagal ambil data jenis media.');
                res.render('LaporanStaff/laporan_edit', {
                    title: 'Edit Laporan',
                    detail: detailFormatted,
                    pimpinan,
                    jenis,
                    JENIS_MAP,
                    currentPage: 'laporan'
                });
            });
        });
    });
});

// POST /laporan/edit/:id - Update laporan
router.post('/laporan/edit/:id', isAuthenticated, upload.single('file_upload'), (req, res) => {
    const { id } = req.params;
    const { jenis_laporan, id_pimpinan, id_jenis, tanggal_laporan, judul, isi_laporan } = req.body;

    db.query('SELECT * FROM laporan_staff WHERE id = ? AND is_deleted = 0', [id], (err, rows) => {
        if (err) return res.status(500).send('Gagal mengambil data.');
        if (!rows.length) return res.status(404).send('Data tidak ditemukan.');

        const lama = rows[0];
        const baru = {
            jenis_laporan: Number(jenis_laporan),
            id_pimpinan: id_pimpinan ? Number(id_pimpinan) : null,
            id_jenis: id_jenis ? Number(id_jenis) : null,
            tanggal_laporan: tanggal_laporan || null,
            judul,
            isi_laporan: isi_laporan || null
        };

        // Check if pimpinan or date changed (affects file path)
        const needFileMove = (
            lama.jenis_laporan !== baru.jenis_laporan ||
            lama.id_pimpinan !== baru.id_pimpinan ||
            formatDateForInput(lama.tanggal_laporan) !== baru.tanggal_laporan
        );

        // Handle ketika pimpinan baru kosong
        function getPimpinanNameAndContinue() {
            if (!baru.id_pimpinan) {
                // Pimpinan kosong, gunakan "No-Pimpinan"
                continueWithPimpinanName('No-Pimpinan');
                return;
            }

            // Ada pimpinan, query database
            const qPimpinan = `SELECT jabatan_pimpinan FROM kategori_pimpinan WHERE id_pimpinan = ? AND is_deleted = 0`;
            db.query(qPimpinan, [baru.id_pimpinan], (errPimpinan, pimpinanRows) => {
                if (errPimpinan || !pimpinanRows.length) {
                    return res.status(500).send('Pimpinan baru tidak ditemukan.');
                }
                const newPimpinanName = pimpinanRows[0].jabatan_pimpinan;
                continueWithPimpinanName(newPimpinanName);
            });
        }

        function continueWithPimpinanName(newPimpinanName) {
            let fileFields = '';
            let fileParams = [];
            let oldFilePath = null;

            // Handle file operations
            if (req.file) {
                // New file uploaded
                if (lama.file_path) {
                    oldFilePath = path.join(__dirname, '../public/', lama.file_path);
                }

                // Handle path untuk no-pimpinan
                let relativePath;
                if (newPimpinanName === 'No-Pimpinan') {
                    const jenisFolder = JENIS_MAP[baru.jenis_laporan] || 'Unknown';
                    const date = baru.tanggal_laporan ? new Date(baru.tanggal_laporan) : new Date();
                    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    const fullDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                    relativePath = `uploads/laporan/${jenisFolder}/No-Pimpinan/${yearMonth}/${fullDate}`;
                } else {
                    const pathResult = getUploadPath(baru.jenis_laporan, newPimpinanName, baru.tanggal_laporan);
                    relativePath = pathResult.relativePath;
                }

                fileFields = ', file_name = ?, file_path = ?, file_size = ?';
                fileParams = [
                    req.file.originalname,
                    `${relativePath}/${req.file.filename}`,
                    req.file.size
                ];
            } else if (needFileMove && lama.file_path) {
                // File perlu dipindah karena pimpinan/tanggal berubah
                let oldFileFullPath = path.join(__dirname, '../public/', lama.file_path);

                // Cari file lama jika path di DB tidak valid
                if (!fs.existsSync(oldFileFullPath)) {
                    const jenisFolderLama = JENIS_MAP[lama.jenis_laporan] || 'Unknown';
                    const dateObj = new Date(lama.tanggal_laporan);
                    const y = dateObj.getFullYear();
                    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const d = String(dateObj.getDate()).padStart(2, '0');
                    const yearMonth = `${y}-${m}`;
                    const fullDate = `${y}-${m}-${d}`;
                    const filenameStored = lama.file_path ? path.basename(lama.file_path) : null;

                    if (filenameStored) {
                        const baseDir = path.join(__dirname, '../public/uploads/laporan/', jenisFolderLama);
                        try {
                            // Cari di semua folder pimpinan termasuk No-Pimpinan
                            const searchDirs = ['No-Pimpinan'];
                            const pimpinanDirs = fs.readdirSync(baseDir, { withFileTypes: true })
                                .filter(ent => ent.isDirectory())
                                .map(ent => ent.name)
                                .filter(name => name !== 'No-Pimpinan');

                            searchDirs.push(...pimpinanDirs);

                            for (const pimpinanFolder of searchDirs) {
                                const candidate = path.join(baseDir, pimpinanFolder, yearMonth, fullDate, filenameStored);
                                if (fs.existsSync(candidate)) {
                                    oldFileFullPath = candidate;
                                    break;
                                }
                            }
                        } catch (e) {
                            // Ignore search errors
                        }
                    }
                }

                // Pindahkan file ke lokasi baru
                if (fs.existsSync(oldFileFullPath)) {
                    let newPath, newRelativePath;

                    if (newPimpinanName === 'No-Pimpinan') {
                        const jenisFolder = JENIS_MAP[baru.jenis_laporan] || 'Unknown';
                        const date = baru.tanggal_laporan ? new Date(baru.tanggal_laporan) : new Date();
                        const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                        const fullDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

                        newPath = path.join(__dirname, `../public/uploads/laporan/${jenisFolder}/No-Pimpinan/${yearMonth}/${fullDate}`);
                        newRelativePath = `uploads/laporan/${jenisFolder}/No-Pimpinan/${yearMonth}/${fullDate}`;
                    } else {
                        const { relativePath, fullPath } = getUploadPath(baru.jenis_laporan, newPimpinanName, baru.tanggal_laporan);
                        newPath = fullPath;
                        newRelativePath = relativePath;
                    }

                    if (!fs.existsSync(newPath)) {
                        fs.mkdirSync(newPath, { recursive: true });
                    }

                    const storedName = path.basename(oldFileFullPath);
                    const newFileFullPath = path.join(newPath, storedName);
                    const finalRelativePath = `${newRelativePath}/${storedName}`;

                    try {
                        fs.renameSync(oldFileFullPath, newFileFullPath);
                        fileFields = ', file_path = ?';
                        fileParams = [finalRelativePath];

                        // Cleanup empty old directory
                        try {
                            const parent = path.dirname(oldFileFullPath);
                            if (fs.existsSync(parent) && fs.readdirSync(parent).length === 0) {
                                fs.rmdirSync(parent);
                            }
                        } catch (_) { }
                    } catch (moveError) {
                        console.error('Error moving file:', moveError);
                        return res.status(500).send('Gagal memindahkan file.');
                    }
                }
            }

            // Format tanggal lama untuk perbandingan
            const dataLama = {
                jenis_laporan: lama.jenis_laporan,
                id_pimpinan: lama.id_pimpinan,
                id_jenis: lama.id_jenis,
                tanggal_laporan: formatDateForInput(lama.tanggal_laporan),
                judul: lama.judul,
                isi_laporan: lama.isi_laporan
            };

            // Check for changes
            const dataChanged = JSON.stringify(dataLama) !== JSON.stringify(baru);
            const fileChanged = req.file !== undefined || needFileMove;

            if (!dataChanged && !fileChanged) {
                return res.redirect('/laporan');
            }

            // Update database
            const sql = `
                UPDATE laporan_staff
                SET jenis_laporan   = ?,
                    id_pimpinan     = ?,
                    id_jenis        = ?,
                    tanggal_laporan = ?,
                    judul           = ?,
                    isi_laporan     = ?,
                    updated_by      = ?,
                    updated_at      = NOW()
                    ${fileFields}
                WHERE id = ? AND is_deleted = 0
            `;
            const params = [
                baru.jenis_laporan,
                baru.id_pimpinan,  // sudah bisa null
                baru.id_jenis,     // sudah bisa null
                baru.tanggal_laporan, // sudah bisa null
                baru.judul,
                baru.isi_laporan,
                (req.session?.user?.username) || 'system',
                ...fileParams,
                id
            ];

            db.query(sql, params, (err2) => {
                if (err2) {
                    return res.status(500).send('Gagal memperbarui data.');
                }

                // Clean up old file if it was replaced
                if (oldFilePath && fs.existsSync(oldFilePath)) {
                    try {
                        fs.unlinkSync(oldFilePath);
                        let parentDir = path.dirname(oldFilePath);
                        try {
                            if (fs.readdirSync(parentDir).length === 0) {
                                fs.rmdirSync(parentDir);
                            }
                        } catch (e) {
                            // Ignore cleanup errors
                        }
                    } catch (unlinkError) {
                        console.error('Error cleaning up old file:', unlinkError);
                    }
                }

                res.redirect('/laporan' + (baru.jenis_laporan ? `?jenis=${baru.jenis_laporan}` : ''));
            });
        }

        // Mulai proses
        getPimpinanNameAndContinue();
    });
});

module.exports = router;