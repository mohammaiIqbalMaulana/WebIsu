const express = require('express');
const router = express.Router();
const db = require('../models/db');
const fs = require('fs');
const path = require('path');

// Helper function untuk validasi keberadaan file
function checkFileExists(filePath) {
    try {
        if (!filePath) return false;
        const fullPath = path.join(__dirname, '../public', filePath);
        return fs.existsSync(fullPath);
    } catch (error) {
        console.error('Error checking file existence:', error);
        return false;
    }
}

// Helper function untuk membuat URL file yang konsisten
function getFileUrl(filePath) {
    if (!filePath) return null;
    
    // Pastikan path dimulai dengan /
    let normalizedPath = filePath.startsWith('/') ? filePath : '/' + filePath;
    
    // Hapus duplikasi /uploads/prioritas/
    normalizedPath = normalizedPath.replace(/\/uploads\/prioritas\/uploads\/prioritas\//g, '/uploads/prioritas/');
    
    return normalizedPath;
}

// Helper function untuk parse kewenangan text
function parseKewenanganText(kewenanganStr) {
    if (!kewenanganStr) return [];

    try {
        // Handle JSON array format: ["text1","text2"]  
        if (kewenanganStr.startsWith('[') && kewenanganStr.endsWith(']')) {
            const parsed = JSON.parse(kewenanganStr);
            return parsed.filter(text => text && text.toString().trim());
        }
        // Handle comma separated: "text1,text2"
        else if (kewenanganStr.includes(',')) {
            return kewenanganStr.split(',').map(text => text.trim()).filter(text => text);
        }
        // Single text: "text1"
        else {
            return kewenanganStr.trim() ? [kewenanganStr.trim()] : [];
        }
    } catch (error) {
        console.error('Error parsing kewenangan text:', error);
        return [];
    }
}

// Monitoring Prioritas dengan filtering dan pagination
router.get('/monitoring-prioritas', async (req, res) => {
    try {
        const {
            tanggal_dari,
            tanggal_sampai,
            stakeholder,
            kewenangan,
            search,
            page = 1,
            limit = 9
        } = req.query;

        const offset = (page - 1) * limit;

        // Build query dengan join ke tabel OPD
        let query = `
            SELECT 
                lp.*,
                GROUP_CONCAT(DISTINCT opd.nama_opd) as stakeholder_names
            FROM laporan_pimpinan lp
            LEFT JOIN opd ON FIND_IN_SET(opd.id, REPLACE(REPLACE(REPLACE(lp.stakeholder, '[', ''), ']', ''), '"', '')) > 0
            WHERE lp.jenis_laporan = 1 AND lp.is_deleted = 0
        `;
        
        let params = [];

        // Tambahkan filter tanggal
        if (tanggal_dari && tanggal_sampai) {
            query += ' AND lp.tanggal_laporan BETWEEN ? AND ?';
            params.push(tanggal_dari, tanggal_sampai);
        } else if (tanggal_dari) {
            query += ' AND lp.tanggal_laporan >= ?';
            params.push(tanggal_dari);
        } else if (tanggal_sampai) {
            query += ' AND lp.tanggal_laporan <= ?';
            params.push(tanggal_sampai);
        }

        // Tambahkan filter stakeholder
        if (stakeholder) {
            query += ' AND lp.stakeholder LIKE ?';
            params.push(`%${stakeholder}%`);
        }

        // Tambahkan filter kewenangan
        if (kewenangan) {
            query += ' AND lp.kewenangan LIKE ?';
            params.push(`%${kewenangan}%`);
        }

        // Tambahkan search
        if (search) {
            query += ' AND (lp.judul LIKE ? OR lp.isi_laporan LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        // Group by untuk menghindari duplikasi
        query += ' GROUP BY lp.id';

        // Hitung total data untuk pagination
        const countQuery = `
            SELECT COUNT(DISTINCT lp.id) as total 
            FROM laporan_pimpinan lp
            WHERE lp.jenis_laporan = 1 AND lp.is_deleted = 0
            ${tanggal_dari && tanggal_sampai ? ' AND lp.tanggal_laporan BETWEEN ? AND ?' : ''}
            ${tanggal_dari && !tanggal_sampai ? ' AND lp.tanggal_laporan >= ?' : ''}
            ${!tanggal_dari && tanggal_sampai ? ' AND lp.tanggal_laporan <= ?' : ''}
            ${stakeholder ? ' AND lp.stakeholder LIKE ?' : ''}
            ${kewenangan ? ' AND lp.kewenangan LIKE ?' : ''}
            ${search ? ' AND (lp.judul LIKE ? OR lp.isi_laporan LIKE ?)' : ''}
        `;
        
        const countParams = [];
        if (tanggal_dari && tanggal_sampai) countParams.push(tanggal_dari, tanggal_sampai);
        else if (tanggal_dari) countParams.push(tanggal_dari);
        else if (tanggal_sampai) countParams.push(tanggal_sampai);
        if (stakeholder) countParams.push(`%${stakeholder}%`);
        if (kewenangan) countParams.push(`%${kewenangan}%`);
        if (search) countParams.push(`%${search}%`, `%${search}%`);

        const [countResult] = await db.promise().query(countQuery, countParams);
        const totalData = countResult[0].total;
        const totalPages = Math.ceil(totalData / limit);

        // Ambil data dengan pagination
        query += ' ORDER BY lp.tanggal_laporan DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [rows] = await db.promise().query(query, params);

        // Process data untuk tampilan dengan validasi file
        const processedRows = rows.map(row => {
            let files = [];
            let validFiles = [];
            
            if (row.file_path) {
                try {
                    // Coba parse sebagai JSON array
                    if (row.file_path.startsWith('[')) {
                        files = JSON.parse(row.file_path);
                    } else {
                        files = [row.file_path];
                    }
                    
                    // Validasi setiap file dan buat URL yang konsisten
                    validFiles = files
                        .map(filePath => getFileUrl(filePath))
                        .filter(fileUrl => fileUrl && checkFileExists(fileUrl));
                        
                } catch (e) {
                    // Fallback ke single file
                    const fileUrl = getFileUrl(row.file_path);
                    if (fileUrl && checkFileExists(fileUrl)) {
                        validFiles = [fileUrl];
                    }
                }
            }
            
            return {
                ...row,
                tanggal_formatted: new Date(row.tanggal_laporan).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                }),
                stakeholder_names_array: row.stakeholder_names ? row.stakeholder_names.split(',') : [],
                kewenangan_array: row.kewenangan ? parseKewenanganText(row.kewenangan) : [],
                files: validFiles,
                file_count: validFiles.length
            };
        });

        // Pisahkan highlight dan laporan kecil
        const highlight = processedRows.length > 0 ? processedRows[0] : null;
        const laporanKecil = processedRows.slice(1).map(laporan => ({
            ...laporan,
                isi_laporan: laporan.isi_laporan // Keep the original isi_laporan
        }));

        // Ambil data OPD untuk dropdown filter
        const [opdData] = await db.promise().query(
            "SELECT id, nama_opd FROM opd WHERE is_deleted = 0 ORDER BY nama_opd ASC"
        );
        
        res.render('highlight/monitoring-prioritas', {
            layout: 'layout',
            title: 'Monitoring Isu Prioritas',
            highlight,
            laporanKecil,
            currentPage: 'monitoring-prioritas',
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalData,
                hasPrev: page > 1,
                hasNext: page < totalPages,
                prevPage: page > 1 ? page - 1 : null,
                nextPage: page < totalPages ? page + 1 : null
            },
            filters: {
                tanggal_dari,
                tanggal_sampai,
                stakeholder,
                kewenangan,
                search
            },
            opdData
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Terjadi kesalahan server");
    }
});

// Monitoring Khusus dengan filtering dan pagination
router.get('/monitoring-khusus', async (req, res) => {
    try {
        const {
            tanggal_dari,
            tanggal_sampai,
            stakeholder,
            kewenangan,
            search,
            page = 1,
            limit = 9
        } = req.query;

        const offset = (page - 1) * limit;

        // Build query dengan join ke tabel OPD
        let query = `
            SELECT 
                lp.*,
                GROUP_CONCAT(DISTINCT opd.nama_opd) as stakeholder_names
            FROM laporan_pimpinan lp
            LEFT JOIN opd ON FIND_IN_SET(opd.id, REPLACE(REPLACE(REPLACE(lp.stakeholder, '[', ''), ']', ''), '"', '')) > 0
            WHERE lp.jenis_laporan = 2 AND lp.is_deleted = 0
        `;
        
        let params = [];

        // Tambahkan filter tanggal
        if (tanggal_dari && tanggal_sampai) {
            query += ' AND lp.tanggal_laporan BETWEEN ? AND ?';
            params.push(tanggal_dari, tanggal_sampai);
        } else if (tanggal_dari) {
            query += ' AND lp.tanggal_laporan >= ?';
            params.push(tanggal_dari);
        } else if (tanggal_sampai) {
            query += ' AND lp.tanggal_laporan <= ?';
            params.push(tanggal_sampai);
        }

        // Tambahkan filter stakeholder
        if (stakeholder) {
            query += ' AND lp.stakeholder LIKE ?';
            params.push(`%${stakeholder}%`);
        }

        // Tambahkan filter kewenangan
        if (kewenangan) {
            query += ' AND lp.kewenangan LIKE ?';
            params.push(`%${kewenangan}%`);
        }

        // Tambahkan search
        if (search) {
            query += ' AND (lp.judul LIKE ? OR lp.isi_laporan LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        // Group by untuk menghindari duplikasi
        query += ' GROUP BY lp.id';

        // Hitung total data untuk pagination
        const countQuery = `
            SELECT COUNT(DISTINCT lp.id) as total 
            FROM laporan_pimpinan lp
            WHERE lp.jenis_laporan = 2 AND lp.is_deleted = 0
            ${tanggal_dari && tanggal_sampai ? ' AND lp.tanggal_laporan BETWEEN ? AND ?' : ''}
            ${tanggal_dari && !tanggal_sampai ? ' AND lp.tanggal_laporan >= ?' : ''}
            ${!tanggal_dari && tanggal_sampai ? ' AND lp.tanggal_laporan <= ?' : ''}
            ${stakeholder ? ' AND lp.stakeholder LIKE ?' : ''}
            ${kewenangan ? ' AND lp.kewenangan LIKE ?' : ''}
            ${search ? ' AND (lp.judul LIKE ? OR lp.isi_laporan LIKE ?)' : ''}
        `;
        
        const countParams = [];
        if (tanggal_dari && tanggal_sampai) countParams.push(tanggal_dari, tanggal_sampai);
        else if (tanggal_dari) countParams.push(tanggal_dari);
        else if (tanggal_sampai) countParams.push(tanggal_sampai);
        if (stakeholder) countParams.push(`%${stakeholder}%`);
        if (kewenangan) countParams.push(`%${kewenangan}%`);
        if (search) countParams.push(`%${search}%`, `%${search}%`);

        const [countResult] = await db.promise().query(countQuery, countParams);
        const totalData = countResult[0].total;
        const totalPages = Math.ceil(totalData / limit);

        // Ambil data dengan pagination
        query += ' ORDER BY lp.tanggal_laporan DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [rows] = await db.promise().query(query, params);

        // Process data untuk tampilan dengan validasi file
        const processedRows = rows.map(row => {
            let files = [];
            let validFiles = [];
            
            if (row.file_path) {
                try {
                    // Coba parse sebagai JSON array
                    if (row.file_path.startsWith('[')) {
                        files = JSON.parse(row.file_path);
                    } else {
                        files = [row.file_path];
                    }
                    
                    // Validasi setiap file dan buat URL yang konsisten
                    validFiles = files
                        .map(filePath => getFileUrl(filePath))
                        .filter(fileUrl => fileUrl && checkFileExists(fileUrl));
                        
                } catch (e) {
                    // Fallback ke single file
                    const fileUrl = getFileUrl(row.file_path);
                    if (fileUrl && checkFileExists(fileUrl)) {
                        validFiles = [fileUrl];
                    }
                }
            }
            
            return {
                ...row,
                tanggal_formatted: new Date(row.tanggal_laporan).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                }),
                stakeholder_names_array: row.stakeholder_names ? row.stakeholder_names.split(',') : [],
                kewenangan_array: row.kewenangan ? parseKewenanganText(row.kewenangan) : [],
                files: validFiles,
                file_count: validFiles.length
            };
        });

        // Pisahkan highlight dan laporan kecil
        const highlight = processedRows.length > 0 ? processedRows[0] : null;
        const laporanKecil = processedRows.slice(1).map(laporan => ({
            ...laporan,
                isi_laporan: laporan.isi_laporan // Keep the original isi_laporan
        }));

        // Ambil data OPD untuk dropdown filter
        const [opdData] = await db.promise().query(
            "SELECT id, nama_opd FROM opd WHERE is_deleted = 0 ORDER BY nama_opd ASC"
        );
        
        res.render('highlight/monitoring-khusus', {
            layout: 'layout',
            title: 'Monitoring Isu Khusus',
            highlight,
            laporanKecil,
            currentPage: 'monitoring-khusus',
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalData,
                hasPrev: page > 1,
                hasNext: page < totalPages,
                prevPage: page > 1 ? page - 1 : null,
                nextPage: page < totalPages ? page + 1 : null
            },
            filters: {
                tanggal_dari,
                tanggal_sampai,
                stakeholder,
                kewenangan,
                search
            },
            opdData
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Terjadi kesalahan server");
    }
});

// Monitoring Khusus dengan filtering dan pagination
router.get('/monitoring-viralitas', async (req, res) => {
    try {
        const {
            tanggal_dari,
            tanggal_sampai,
            stakeholder,
            kewenangan,
            search,
            page = 1,
            limit = 9
        } = req.query;

        const offset = (page - 1) * limit;

        // Build query dengan join ke tabel OPD
        let query = `
            SELECT 
                lp.*,
                GROUP_CONCAT(DISTINCT opd.nama_opd) as stakeholder_names
            FROM laporan_pimpinan lp
            LEFT JOIN opd ON FIND_IN_SET(opd.id, REPLACE(REPLACE(REPLACE(lp.stakeholder, '[', ''), ']', ''), '"', '')) > 0
            WHERE lp.jenis_laporan = 3 AND lp.is_deleted = 0
        `;
        
        let params = [];

        // Tambahkan filter tanggal
        if (tanggal_dari && tanggal_sampai) {
            query += ' AND lp.tanggal_laporan BETWEEN ? AND ?';
            params.push(tanggal_dari, tanggal_sampai);
        } else if (tanggal_dari) {
            query += ' AND lp.tanggal_laporan >= ?';
            params.push(tanggal_dari);
        } else if (tanggal_sampai) {
            query += ' AND lp.tanggal_laporan <= ?';
            params.push(tanggal_sampai);
        }

        // Tambahkan filter stakeholder
        if (stakeholder) {
            query += ' AND lp.stakeholder LIKE ?';
            params.push(`%${stakeholder}%`);
        }

        // Tambahkan filter kewenangan
        if (kewenangan) {
            query += ' AND lp.kewenangan LIKE ?';
            params.push(`%${kewenangan}%`);
        }

        // Tambahkan search
        if (search) {
            query += ' AND (lp.judul LIKE ? OR lp.isi_laporan LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        // Group by untuk menghindari duplikasi
        query += ' GROUP BY lp.id';

        // Hitung total data untuk pagination
        const countQuery = `
            SELECT COUNT(DISTINCT lp.id) as total 
            FROM laporan_pimpinan lp
            WHERE lp.jenis_laporan = 3 AND lp.is_deleted = 0
            ${tanggal_dari && tanggal_sampai ? ' AND lp.tanggal_laporan BETWEEN ? AND ?' : ''}
            ${tanggal_dari && !tanggal_sampai ? ' AND lp.tanggal_laporan >= ?' : ''}
            ${!tanggal_dari && tanggal_sampai ? ' AND lp.tanggal_laporan <= ?' : ''}
            ${stakeholder ? ' AND lp.stakeholder LIKE ?' : ''}
            ${kewenangan ? ' AND lp.kewenangan LIKE ?' : ''}
            ${search ? ' AND (lp.judul LIKE ? OR lp.isi_laporan LIKE ?)' : ''}
        `;
        
        const countParams = [];
        if (tanggal_dari && tanggal_sampai) countParams.push(tanggal_dari, tanggal_sampai);
        else if (tanggal_dari) countParams.push(tanggal_dari);
        else if (tanggal_sampai) countParams.push(tanggal_sampai);
        if (stakeholder) countParams.push(`%${stakeholder}%`);
        if (kewenangan) countParams.push(`%${kewenangan}%`);
        if (search) countParams.push(`%${search}%`, `%${search}%`);

        const [countResult] = await db.promise().query(countQuery, countParams);
        const totalData = countResult[0].total;
        const totalPages = Math.ceil(totalData / limit);

        // Ambil data dengan pagination
        query += ' ORDER BY lp.tanggal_laporan DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [rows] = await db.promise().query(query, params);

        // Process data untuk tampilan dengan validasi file
        const processedRows = rows.map(row => {
            let files = [];
            let validFiles = [];
            
            if (row.file_path) {
                try {
                    // Coba parse sebagai JSON array
                    if (row.file_path.startsWith('[')) {
                        files = JSON.parse(row.file_path);
                    } else {
                        files = [row.file_path];
                    }
                    
                    // Validasi setiap file dan buat URL yang konsisten
                    validFiles = files
                        .map(filePath => getFileUrl(filePath))
                        .filter(fileUrl => fileUrl && checkFileExists(fileUrl));
                        
                } catch (e) {
                    // Fallback ke single file
                    const fileUrl = getFileUrl(row.file_path);
                    if (fileUrl && checkFileExists(fileUrl)) {
                        validFiles = [fileUrl];
                    }
                }
            }
            
            return {
                ...row,
                tanggal_formatted: new Date(row.tanggal_laporan).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                }),
                stakeholder_names_array: row.stakeholder_names ? row.stakeholder_names.split(',') : [],
                kewenangan_array: row.kewenangan ? parseKewenanganText(row.kewenangan) : [],
                files: validFiles,
                file_count: validFiles.length
            };
        });

        // Pisahkan highlight dan laporan kecil
        const highlight = processedRows.length > 0 ? processedRows[0] : null;
        const laporanKecil = processedRows.slice(1).map(laporan => ({
            ...laporan,
                isi_laporan: laporan.isi_laporan // Keep the original isi_laporan
        }));

        // Ambil data OPD untuk dropdown filter
        const [opdData] = await db.promise().query(
            "SELECT id, nama_opd FROM opd WHERE is_deleted = 0 ORDER BY nama_opd ASC"
        );
        
        res.render('highlight/monitoring-viralitas', {
            layout: 'layout',
            title: 'Monitoring Isu Viralitas',
            highlight,
            laporanKecil,
            currentPage: 'monitoring-viralitas',
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalData,
                hasPrev: page > 1,
                hasNext: page < totalPages,
                prevPage: page > 1 ? page - 1 : null,
                nextPage: page < totalPages ? page + 1 : null
            },
            filters: {
                tanggal_dari,
                tanggal_sampai,
                stakeholder,
                kewenangan,
                search
            },
            opdData
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Terjadi kesalahan server");
    }
});

// API endpoint untuk detail laporan (universal untuk prioritas dan khusus)
router.get('/laporan-detail/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Cek apakah ID valid
        if (!id || isNaN(id)) {
            return res.json({ success: false, message: 'ID laporan tidak valid' });
        }
        
        // Query langsung untuk mendapatkan detail laporan
        const query = `
            SELECT 
                lp.*,
                GROUP_CONCAT(DISTINCT opd.nama_opd) as stakeholder_names
            FROM laporan_pimpinan lp
            LEFT JOIN opd ON FIND_IN_SET(opd.id, REPLACE(REPLACE(REPLACE(lp.stakeholder, '[', ''), ']', ''), '"', '')) > 0
            WHERE lp.id = ? AND lp.is_deleted = 0
            GROUP BY lp.id
        `;
        
        const [rows] = await db.promise().query(query, [id]);
        
        if (rows.length === 0) {
            console.error('Laporan tidak ditemukan untuk ID:', id);
            return res.json({ 
                success: false, 
                message: 'Laporan tidak ditemukan',
                detail: 'Laporan dengan ID ' + id + ' tidak ditemukan'
            });
        }
        
        const laporan = rows[0];
        
        // Process files
        let files = [];
        let validFiles = [];
        
        if (laporan.file_path) {
            try {
                if (laporan.file_path.startsWith('[')) {
                    files = JSON.parse(laporan.file_path);
                } else {
                    files = [laporan.file_path];
                }
                
                validFiles = files
                    .map(filePath => getFileUrl(filePath))
                    .filter(fileUrl => fileUrl && checkFileExists(fileUrl));
                    
            } catch (e) {
                const fileUrl = getFileUrl(laporan.file_path);
                if (fileUrl && checkFileExists(fileUrl)) {
                    validFiles = [fileUrl];
                }
            }
        }
        
        const processedLaporan = {
            ...laporan,
            tanggal_formatted: new Date(laporan.tanggal_laporan).toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            }),
            stakeholder_names_array: laporan.stakeholder_names ? laporan.stakeholder_names.split(',') : [],
            kewenangan_array: laporan.kewenangan ? parseKewenanganText(laporan.kewenangan) : [],
            files: validFiles,
            file_count: validFiles.length
        };
        
        res.json({ success: true, data: processedLaporan });
        
    } catch (err) {
        console.error('Error fetching laporan detail:', err);
        res.json({ 
            success: false, 
            message: 'Terjadi kesalahan server',
            detail: err.message 
        });
    }
});

module.exports = router;
