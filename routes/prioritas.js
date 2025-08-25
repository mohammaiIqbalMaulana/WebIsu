var express = require('express');
var router = express.Router();
var connection = require('../models/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Konfigurasi multer untuk upload multiple files
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../public/uploads/prioritas');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        // Accept all file types
        cb(null, true);
    }
});

// Helper function untuk parse files data
function parseFilesData(fileNameStr, filePathStr, fileSizeInt) {
    if (!fileNameStr) return [];

    try {
        if (fileNameStr.startsWith('[') && fileNameStr.endsWith(']')) {
            const fileNames = JSON.parse(fileNameStr);
            const filePaths = JSON.parse(filePathStr || '[]');
            const avgSize = Math.floor(fileSizeInt / fileNames.length) || 0;

            return fileNames.map((name, index) => ({
                name: name,
                path: filePaths[index] || '',
                size: avgSize
            }));
        } else {
            return [{
                name: fileNameStr,
                path: filePathStr || '',
                size: parseInt(fileSizeInt) || 0
            }];
        }
    } catch (error) {
        console.error('Error parsing files data:', error);
        return [{
            name: fileNameStr,
            path: filePathStr || '',
            size: parseInt(fileSizeInt) || 0
        }];
    }
}

// Helper function untuk format files data
function formatFilesData(files) {
    if (!files || files.length === 0) {
        return { fileNames: null, filePaths: null, fileSizes: null };
    }

    if (files.length === 1) {
        return {
            fileNames: files[0].originalname,
            filePaths: '/uploads/prioritas/' + files[0].filename,
            fileSizes: files[0].size
        };
    } else {
        const fileNames = files.map(f => f.originalname);
        const filePaths = files.map(f => '/uploads/prioritas/' + f.filename);
        const fileSizes = files.map(f => f.size);
        const totalSize = fileSizes.reduce((total, size) => total + size, 0);

        return {
            fileNames: JSON.stringify(fileNames),
            filePaths: JSON.stringify(filePaths),
            fileSizes: totalSize
        };
    }
}

// Helper function untuk parse OPD IDs
function parseOpdIds(opdStr) {
    if (!opdStr) return [];

    try {
        // Remove any whitespace
        opdStr = opdStr.toString().trim();

        // Handle JSON array format: "[58,59]"
        if (opdStr.startsWith('[') && opdStr.endsWith(']')) {
            const parsed = JSON.parse(opdStr);
            const result = parsed.map(id => parseInt(id)).filter(id => !isNaN(id));
            return result;
        }
        // Handle comma-separated: "58,59"
        else if (opdStr.includes(',')) {
            const result = opdStr.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            return result;
        }
        // Handle single ID: "58"
        else {
            const id = parseInt(opdStr);
            const result = !isNaN(id) ? [id] : [];
            return result;
        }
    } catch (error) {
        console.error('Error parsing OPD IDs:', opdStr, error);
        return [];
    }
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

// Helper function untuk format kewenangan text
function formatKewenanganText(kewenanganArray) {
    if (!kewenanganArray || kewenanganArray.length === 0) return null;

    if (kewenanganArray.length === 1) {
        return kewenanganArray[0];
    } else {
        return JSON.stringify(kewenanganArray);
    }
}

// Helper function untuk format OPD IDs
function formatOpdIds(opdArray) {
    if (!opdArray || opdArray.length === 0) return null;

    if (opdArray.length === 1) {
        return opdArray[0].toString();
    } else {
        return JSON.stringify(opdArray.map(id => parseInt(id)));
    }
}

// Helper function untuk get OPD data by IDs
function getOpdByIds(opdIds, callback) {
    if (!opdIds || opdIds.length === 0) {
        return callback(null, []);
    }

    const placeholders = opdIds.map(() => '?').join(',');
    const query = `SELECT id, nama_opd FROM opd WHERE id IN (${placeholders}) AND is_deleted = 0`;

    connection.query(query, opdIds, (err, results) => {
        if (err) {
            console.error('Error fetching OPD data:', err);
            return callback(err, []);
        }
        callback(null, results || []);
    });
}

// Helper function untuk build URL dengan parameters
function buildUrlWithParams(baseUrl, params, excludeKeys = []) {
    const validParams = {};

    Object.keys(params).forEach(key => {
        if (!excludeKeys.includes(key) && params[key] && params[key].toString().trim()) {
            validParams[key] = params[key];
        }
    });

    const queryString = new URLSearchParams(validParams).toString();
    return baseUrl + (queryString ? '?' + queryString : '');
}

// Helper function untuk parse links data
function parseLinksData(linksStr) {
    if (!linksStr) return [];

    try {
        // Handle JSON array format: ["link1","link2"]
        if (linksStr.startsWith('[') && linksStr.endsWith(']')) {
            const parsed = JSON.parse(linksStr);
            return parsed.filter(link => link && link.toString().trim());
        }
        // Handle comma separated: "link1,link2"
        else if (linksStr.includes(',')) {
            return linksStr.split(',').map(link => link.trim()).filter(link => link);
        }
        // Single link: "link1"
        else {
            return linksStr.trim() ? [linksStr.trim()] : [];
        }
    } catch (error) {
        console.error('Error parsing links data:', error);
        return [];
    }
}

// Helper function untuk format links data
function formatLinksData(linksArray) {
    if (!linksArray || linksArray.length === 0) return null;

    if (linksArray.length === 1) {
        return linksArray[0];
    } else {
        return JSON.stringify(linksArray);
    }
}

// Helper function untuk validate dan clean URL
function validateAndCleanUrl(url) {
    if (!url || !url.trim()) return null;
    
    let cleanUrl = url.trim();
    
    // Add https:// if no protocol specified
    if (!cleanUrl.match(/^https?:\/\//)) {
        cleanUrl = 'https://' + cleanUrl;
    }
    
    return cleanUrl;
}

// 📌 Daftar Isu Prioritas dengan Enhanced Filtering
router.get('/', (req, res) => {
    const tanggalDari = req.query.tanggal_dari || '';
    const tanggalSampai = req.query.tanggal_sampai || '';
    const judulSearch = req.query.judul || '';
    const uraianSearch = req.query.uraian || '';
    const kewenanganFilter = req.query.kewenangan || '';
    const stakeholderFilter = req.query.stakeholder || '';

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // FIXED: Query dengan pengurutan yang lebih baik
    let query = `
        SELECT lp.*
        FROM laporan_pimpinan lp
        WHERE lp.jenis_laporan = 1 AND lp.is_deleted = 0
    `;
    let params = [];

    // Filter conditions (sama seperti sebelumnya)
    if (tanggalDari && tanggalSampai) {
        query += ' AND lp.tanggal_laporan BETWEEN ? AND ?';
        params.push(tanggalDari, tanggalSampai);
    } else if (tanggalDari) {
        query += ' AND lp.tanggal_laporan >= ?';
        params.push(tanggalDari);
    } else if (tanggalSampai) {
        query += ' AND lp.tanggal_laporan <= ?';
        params.push(tanggalSampai);
    }

    if (judulSearch.trim()) {
        query += ' AND lp.judul LIKE ?';
        params.push('%' + judulSearch + '%');
    }

    if (uraianSearch.trim()) {
        query += ' AND lp.isi_laporan LIKE ?';
        params.push('%' + uraianSearch + '%');
    }

    if (kewenanganFilter.trim()) {
        query += ' AND lp.kewenangan LIKE ?';
        params.push('%' + kewenanganFilter + '%');
    }

    if (stakeholderFilter.trim()) {
        const stakeholderIds = parseOpdIds(stakeholderFilter);
        if (stakeholderIds.length > 0) {
            const stakeholderConditions = [];
            stakeholderIds.forEach(id => {
                stakeholderConditions.push(`(
                    lp.stakeholder = ? OR 
                    lp.stakeholder LIKE ? OR 
                    lp.stakeholder LIKE ? OR 
                    lp.stakeholder LIKE ?
                )`);
                params.push(
                    id.toString(),
                    `[${id},%`,
                    `%,${id},%`,
                    `%,${id}]`
                );
            });
            query += ` AND (${stakeholderConditions.join(' OR ')})`;
        }
    }

    // FIXED: Pengurutan berdasarkan tanggal laporan DESC, lalu created_at DESC (yang terbaru diinput)
    // Jika created_at NULL, gunakan updated_at sebagai fallback
    query += ` ORDER BY 
        lp.tanggal_laporan DESC, 
        COALESCE(lp.created_at) DESC,
        lp.id DESC 
        LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    // Count query tetap sama
    let countQuery = `
        SELECT COUNT(lp.id) as total 
        FROM laporan_pimpinan lp 
        WHERE lp.jenis_laporan = 1 AND lp.is_deleted = 0
    `;
    let countParams = [];

    // Duplicate filter conditions for count
    if (tanggalDari && tanggalSampai) {
        countQuery += ' AND lp.tanggal_laporan BETWEEN ? AND ?';
        countParams.push(tanggalDari, tanggalSampai);
    } else if (tanggalDari) {
        countQuery += ' AND lp.tanggal_laporan >= ?';
        countParams.push(tanggalDari);
    } else if (tanggalSampai) {
        countQuery += ' AND lp.tanggal_laporan <= ?';
        countParams.push(tanggalSampai);
    }

    if (judulSearch.trim()) {
        countQuery += ' AND lp.judul LIKE ?';
        countParams.push('%' + judulSearch + '%');
    }

    if (uraianSearch.trim()) {
        countQuery += ' AND lp.isi_laporan LIKE ?';
        countParams.push('%' + uraianSearch + '%');
    }

    if (kewenanganFilter.trim()) {
        countQuery += ' AND lp.kewenangan LIKE ?';
        countParams.push('%' + kewenanganFilter + '%');
    }

    if (stakeholderFilter.trim()) {
        const stakeholderIds = parseOpdIds(stakeholderFilter);
        if (stakeholderIds.length > 0) {
            const stakeholderConditions = [];
            stakeholderIds.forEach(id => {
                stakeholderConditions.push(`(
                    lp.stakeholder = ? OR 
                    lp.stakeholder LIKE ? OR 
                    lp.stakeholder LIKE ? OR 
                    lp.stakeholder LIKE ?
                )`);
                countParams.push(
                    id.toString(),
                    `[${id},%`,
                    `%,${id},%`,
                    `%,${id}]`
                );
            });
            countQuery += ` AND (${stakeholderConditions.join(' OR ')})`;
        }
    }

    // Execute queries
    connection.query(countQuery, countParams, (err, countResult) => {
        if (err) {
            console.error(err);
            return res.render('LaporanPimpinan/prioritas/index', {
                title: 'Isu Prioritas',
                currentPage: 'isu-prioritas',
                data: [],
                pagination: null,
                tanggalDari, tanggalSampai, judulSearch, uraianSearch,
                kewenanganFilter, stakeholderFilter, limit,
                hasFilter: false
            });
        }

        const totalData = countResult[0].total;
        const totalPages = Math.ceil(totalData / limit);
        const hasFilter = !!(tanggalDari || tanggalSampai || judulSearch || uraianSearch || kewenanganFilter || stakeholderFilter);

        connection.query(query, params, (err, rows) => {
            if (err) {
                console.error(err);
                return res.render('LaporanPimpinan/prioritas/index', {
                    title: 'Isu Prioritas',
                    currentPage: 'isu-prioritas',
                    data: [],
                    pagination: null,
                    tanggalDari, tanggalSampai, judulSearch, uraianSearch,
                    kewenanganFilter, stakeholderFilter, limit,
                    hasFilter
                });
            }

            processRowsWithOPDNames(rows, (processedRows) => {
                const filterParams = {
                    tanggal_dari: tanggalDari,
                    tanggal_sampai: tanggalSampai,
                    judul: judulSearch,
                    uraian: uraianSearch,
                    kewenangan: kewenanganFilter,
                    stakeholder: stakeholderFilter,
                    limit: limit !== 10 ? limit : null
                };

                const pagination = {
                    currentPage: page,
                    totalPages: totalPages,
                    totalData: totalData,
                    limit: limit,
                    hasPrev: page > 1,
                    hasNext: page < totalPages,
                    startRecord: offset + 1,
                    endRecord: Math.min(offset + limit, totalData),
                    prevUrl: page > 1 ? buildUrlWithParams('/isu-prioritas', {
                        ...filterParams,
                        page: page > 2 ? page - 1 : null
                    }, ['page']) : null,
                    nextUrl: page < totalPages ? buildUrlWithParams('/isu-prioritas', {
                        ...filterParams,
                        page: page + 1
                    }) : null,
                    firstUrl: buildUrlWithParams('/isu-prioritas', filterParams, ['page']),
                    lastUrl: buildUrlWithParams('/isu-prioritas', {
                        ...filterParams,
                        page: totalPages
                    })
                };

                res.render('LaporanPimpinan/prioritas/index', {
                    title: 'Isu Prioritas',
                    currentPage: 'isu-prioritas',
                    data: processedRows,
                    pagination: pagination,
                    tanggalDari, tanggalSampai, judulSearch, uraianSearch,
                    kewenanganFilter, stakeholderFilter, hasFilter
                });
            });
        });
    });
});

// processRowsWithOPDNames dengan debug
function processRowsWithOPDNames(rows, callback) {
    if (rows.length === 0) {
        return callback([]);
    }

    // Collect stakeholder OPD IDs only (kewenangan sudah text manual)
    const stakeholderOpdIds = new Set();
    rows.forEach(row => {
        const stakeholderIds = parseOpdIds(row.stakeholder); // Tetap pake OPD
        stakeholderIds.forEach(id => stakeholderOpdIds.add(id));
    });

    if (stakeholderOpdIds.size === 0) {
        const processedRows = rows.map(row => ({
            ...row,
            files: parseFilesData(row.file_name, row.file_path, row.file_size),
            kewenanganNames: parseKewenanganText(row.kewenangan), // Parse as text
            stakeholderNames: [],
            links: parseLinksData(row.links)
        }));
        return callback(processedRows);
    }

    // Fetch stakeholder OPD names only
    const opdIdsArray = Array.from(stakeholderOpdIds);
    getOpdByIds(opdIdsArray, (err, opdData) => {
        if (err) {
            console.error('Error fetching OPD names:', err);
            opdData = [];
        }

        const opdMap = new Map();
        opdData.forEach(opd => {
            opdMap.set(opd.id, opd.nama_opd);
        });

        const processedRows = rows.map(row => {
            const stakeholderIds = parseOpdIds(row.stakeholder);
            const stakeholderNames = stakeholderIds.map(id => opdMap.get(id)).filter(Boolean);

            return {
                ...row,
                files: parseFilesData(row.file_name, row.file_path, row.file_size),
                kewenanganNames: parseKewenanganText(row.kewenangan), // Text array
                stakeholderNames, // OPD names array
                links: parseLinksData(row.links)
            };
        });

        callback(processedRows);
    });
}

// 📌 Form tambah dengan OPD data
router.get('/create', (req, res) => {
    // Get semua OPD untuk dropdown - hanya yang belum dihapus
    connection.query('SELECT id, nama_opd FROM opd WHERE is_deleted = 0 ORDER BY nama_opd ASC', (err, opdData) => {
        if (err) {
            console.error('Error fetching OPD:', err);
            opdData = [];
        }

        res.render('LaporanPimpinan/prioritas/create', {
            title: 'Tambah Isu Prioritas',
            currentPage: 'isu-prioritas',
            judul: '',
            tanggal_laporan: '',
            isi_laporan: '',
            opdData: opdData || []
        });
    });
});

// 📌 Simpan data dengan OPD
router.post('/store', upload.array('files'), (req, res) => {
    const { judul, tanggal_laporan, isi_laporan, kewenangan, stakeholder, links } = req.body;

    if (!judul || !tanggal_laporan || !isi_laporan) {
        return res.send(`
            <script>
                alert('Semua field wajib diisi');
                window.history.back();
            </script>
        `);
    }

    let formData = {
        judul,
        tanggal_laporan,
        isi_laporan,
        jenis_laporan: 1,
        created_by: 'admin',
        created_at: new Date()
    };

    // Handle kewenangan as text array
    if (kewenangan && Array.isArray(kewenangan) && kewenangan.length > 0) {
        const filteredKewenangan = kewenangan.filter(text => text && text.trim());
        formData.kewenangan = formatKewenanganText(filteredKewenangan);
    }
    // Handle OPD data
    if (stakeholder && Array.isArray(stakeholder) && stakeholder.length > 0) {
        formData.stakeholder = formatOpdIds(stakeholder);
    }

    // Handle links data
    if (links && Array.isArray(links) && links.length > 0) {
        const validLinks = links
            .map(link => validateAndCleanUrl(link))
            .filter(link => link !== null);
        if (validLinks.length > 0) {
            formData.links = formatLinksData(validLinks);
        }
    }

    // Handle files
    if (req.files && req.files.length > 0) {
        const filesData = formatFilesData(req.files);
        formData.file_name = filesData.fileNames;
        formData.file_path = filesData.filePaths;
        formData.file_size = filesData.fileSizes;
    }

    connection.query('INSERT INTO laporan_pimpinan SET ?', formData, (err) => {
        if (err) {
            console.error(err);
            return res.send(`
                <script>
                    alert('Gagal menyimpan data: ${err.message}');
                    window.history.back();
                </script>
            `);
        }
        res.redirect('/isu-prioritas');
    });
});

// 📌 Form edit dengan OPD data - FIXED VERSION
router.get('/edit/:id', (req, res) => {
    let id = req.params.id;

    // Get data laporan dan OPD
    const queries = [
        'SELECT * FROM laporan_pimpinan WHERE id = ? AND jenis_laporan = 1 AND is_deleted = 0',
        'SELECT id, nama_opd FROM opd WHERE is_deleted = 0 ORDER BY nama_opd ASC'
    ];

    connection.query(queries[0], [id], (err, rows) => {
        if (err) {
            console.error(err);
            return res.send('Error saat mengambil data');
        }
        if (rows.length <= 0) {
            return res.send('Data tidak ditemukan atau sudah dihapus');
        }

        connection.query(queries[1], (err, opdData) => {
            if (err) {
                console.error('Error fetching OPD:', err);
                opdData = [];
            }

            const data = rows[0];
            const formattedDate = formatDateForInput(data.tanggal_laporan);
            const existingFiles = parseFilesData(data.file_name, data.file_path, data.file_size);

            const selectedKewenangan = parseKewenanganText(data.kewenangan);
            const selectedStakeholderIds = parseOpdIds(data.stakeholder);
            const selectedLinks = parseLinksData(data.links);

            const selectedStakeholder = selectedStakeholderIds
                .map(id => {
                    const opd = opdData.find(opd => opd.id === id);
                    return opd ? { id: id, nama_opd: opd.nama_opd } : null;
                })
                .filter(Boolean); // Remove null values (deleted OPDs)

            res.render('LaporanPimpinan/prioritas/edit', {
                title: 'Edit Isu Prioritas',
                currentPage: 'isu-prioritas',
                id: data.id,
                judul: data.judul,
                tanggal_laporan: formattedDate,
                isi_laporan: data.isi_laporan,
                existingFiles: existingFiles,
                opdData: opdData || [],
                selectedKewenangan: selectedKewenangan,
                selectedStakeholder: selectedStakeholder,
                selectedLinks: selectedLinks
            });
        });
    });
});

// 📌 Update data dengan OPD
router.post('/update/:id', upload.array('files'), (req, res) => {
    let id = req.params.id;
    const { judul, tanggal_laporan, isi_laporan, keep_files, kewenangan, stakeholder, links } = req.body;

    if (!judul || !tanggal_laporan || !isi_laporan) {
        return res.send(`
            <script>
                alert('Semua field wajib diisi');
                window.history.back();
            </script>
        `);
    }

    // Get existing files first
    connection.query('SELECT file_name, file_path, file_size FROM laporan_pimpinan WHERE id = ?', [id], (err, result) => {
        if (err) {
            console.error(err);
            return res.send(`<script>alert('Error: ${err.message}'); window.history.back();</script>`);
        }

        let existingFiles = [];
        if (result.length > 0) {
            existingFiles = parseFilesData(result[0].file_name, result[0].file_path, result[0].file_size);
        }

        // Handle files
        const keepFilesArray = Array.isArray(keep_files) ? keep_files : (keep_files ? [keep_files] : []);
        const keptFiles = existingFiles.filter((file, index) => keepFilesArray.includes(index.toString()));

        let allFiles = [...keptFiles];
        if (req.files && req.files.length > 0) {
            const newFiles = req.files.map(file => ({
                name: file.originalname,
                path: '/uploads/prioritas/' + file.filename,
                size: file.size
            }));
            allFiles = [...allFiles, ...newFiles];
        }

        let formData = {
            judul,
            tanggal_laporan,
            isi_laporan,
            updated_by: 'admin',
            updated_at: new Date()
        };

        // Handle kewenangan as text
        if (kewenangan && Array.isArray(kewenangan) && kewenangan.length > 0) {
            const filteredKewenangan = kewenangan.filter(text => text && text.trim());
            formData.kewenangan = formatKewenanganText(filteredKewenangan);
        } else {
            formData.kewenangan = null;
        }
        
        // Handle OPD data
        if (stakeholder && Array.isArray(stakeholder) && stakeholder.length > 0) {
            formData.stakeholder = formatOpdIds(stakeholder);
        } else {
            formData.stakeholder = null;
        }

        // Handle links data
        if (links && Array.isArray(links) && links.length > 0) {
            const validLinks = links
                .map(link => validateAndCleanUrl(link))
                .filter(link => link !== null);
            if (validLinks.length > 0) {
                formData.links = formatLinksData(validLinks);
            } else {
                formData.links = null;
            }
        } else {
            formData.links = null;
        }

        // Handle files data
        if (allFiles.length === 0) {
            formData.file_name = null;
            formData.file_path = null;
            formData.file_size = null;
        } else if (allFiles.length === 1) {
            formData.file_name = allFiles[0].name;
            formData.file_path = allFiles[0].path;
            formData.file_size = allFiles[0].size;
        } else {
            formData.file_name = JSON.stringify(allFiles.map(f => f.name));
            formData.file_path = JSON.stringify(allFiles.map(f => f.path));
            formData.file_size = allFiles.reduce((total, f) => total + f.size, 0);
        }

        connection.query(
            'UPDATE laporan_pimpinan SET ? WHERE id = ? AND jenis_laporan = 1',
            [formData, id],
            (err) => {
                if (err) {
                    console.error(err);
                    return res.send(`
                        <script>
                            alert('Gagal update data: ${err.message}');
                            window.history.back();
                        </script>
                    `);
                }
                res.redirect('/isu-prioritas');
            }
        );
    });
});

// Helper function untuk format tanggal
function formatDateForInput(dateValue) {
    if (!dateValue) return '';
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Download endpoints tetap sama...
router.get('/download/:id/:fileIndex', (req, res) => {
    let id = req.params.id;
    let fileIndex = parseInt(req.params.fileIndex);

    connection.query(
        'SELECT file_name, file_path FROM laporan_pimpinan WHERE id = ? AND jenis_laporan = 1 AND is_deleted = 0',
        [id],
        (err, rows) => {
            if (err) {
                console.error(err);
                return res.send('Error saat mengambil file');
            }
            if (rows.length <= 0) {
                return res.send('Data tidak ditemukan atau sudah dihapus');
            }

            const files = parseFilesData(rows[0].file_name, rows[0].file_path);
            if (!files[fileIndex]) {
                return res.send('File tidak ditemukan');
            }

            const file = files[fileIndex];
            const filePath = path.join(__dirname, '../public', file.path);

            if (!fs.existsSync(filePath)) {
                return res.send('File tidak ditemukan di server');
            }

            res.download(filePath, file.name);
        }
    );
});

router.get('/download-all/:id', (req, res) => {
    let id = req.params.id;

    connection.query(
        'SELECT judul, file_name, file_path FROM laporan_pimpinan WHERE id = ? AND jenis_laporan = 1 AND is_deleted = 0',
        [id],
        (err, rows) => {
            if (err) {
                console.error(err);
                return res.send('Error saat mengambil file');
            }
            if (rows.length <= 0) {
                return res.send('Data tidak ditemukan atau sudah dihapus');
            }

            const files = parseFilesData(rows[0].file_name, rows[0].file_path);
            if (files.length === 0) {
                return res.send('Tidak ada file untuk didownload');
            }

            const archiver = require('archiver');
            const archive = archiver('zip', { zlib: { level: 9 } });

            res.attachment(`${rows[0].judul}-files.zip`);
            archive.pipe(res);

            files.forEach((file, index) => {
                const filePath = path.join(__dirname, '../public', file.path);
                if (fs.existsSync(filePath)) {
                    archive.file(filePath, { name: file.name });
                }
            });

            archive.finalize();
        }
    );
});

// 📌 Hapus data (Soft Delete)
router.get('/delete/:id', (req, res) => {
    let id = req.params.id;
    connection.query(
        'UPDATE laporan_pimpinan SET is_deleted = 1, updated_by = ?, updated_at = NOW() WHERE id = ? AND jenis_laporan = 1',
        ['admin', id],
        (err) => {
            if (err) {
                console.error(err);
                return res.send(`
                    <script>
                        alert('Gagal menghapus data: ${err.message}');
                        window.history.back();
                    </script>
                `);
            }
            res.redirect('/isu-prioritas');
        }
    );
});

// 📌 API endpoint untuk search OPD (untuk AJAX)
router.get('/api/opd', (req, res) => {
    const search = req.query.search || '';

    let query = 'SELECT id, nama_opd FROM opd WHERE is_deleted = 0';
    let params = [];

    if (search.trim()) {
        query += ' AND nama_opd LIKE ? ORDER BY nama_opd ASC';
        params.push('%' + search + '%');
    } else {
        query += ' ORDER BY nama_opd ASC';
    }

    connection.query(query, params, (err, results) => {
        if (err) {
            console.error('Error fetching OPD:', err);
            return res.json({ success: false, data: [] });
        }

        res.json({
            success: true,
            data: results || []
        });
    });
});

module.exports = router;