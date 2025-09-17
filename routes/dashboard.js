const express = require("express");
const router = express.Router();
const db = require("../models/db");
const { promisify } = require('util');

// Promisify the query method
const query = promisify(db.query).bind(db);

/**
 * Build date filter clause based on filter type
 * @param {string} filterType - 'daily', 'weekly', 'monthly'
 * @param {string} date - Date string
 * @param {string} prefix - Table alias prefix (optional)
 */
function buildDateFilter(filterType, date, prefix = '') {
  switch (filterType) {
    case 'daily':
      return `DATE(${prefix}tanggal_laporan) = DATE('${date}')`;
    case 'weekly':
      return `YEARWEEK(${prefix}tanggal_laporan, 1) = YEARWEEK('${date}', 1)`;
    case 'monthly':
      const [year, month] = date.split('-');
      return `YEAR(${prefix}tanggal_laporan) = ${year} AND MONTH(${prefix}tanggal_laporan) = ${month}`;
    default:
      return '';
  }
}

/**
 * GET /api/dashboard/stats
 * Get overview statistics for dashboard
 */
router.get("/stats", async (req, res) => {
  try {
    // Extract filter parameters from query string
    const filters = {
      filterType: req.query.filterType || null,
      date: req.query.date || null,
    };

    // Build date filter clause
    let whereClause = 'WHERE is_deleted = 0';
    if (filters.filterType && filters.date) {
      whereClause += ` AND ${buildDateFilter(filters.filterType, filters.date)}`;
    }

    // Get total count from laporan_pimpinan
    const totalSql = `
      SELECT COUNT(*) as total_reports
      FROM laporan_pimpinan
      ${whereClause}
    `;
    const totalResult = await query(totalSql);
    const totalReports = totalResult[0].total_reports;

    // Get recent count based on filter or default to last 7 days
    let recentSql;
    if (filters.filterType === 'daily') {
      recentSql = `
        SELECT COUNT(*) as recent_reports
        FROM laporan_pimpinan
        WHERE is_deleted = 0
          AND DATE(tanggal_laporan) = DATE('${filters.date}')
      `;
    } else {
      recentSql = `
        SELECT COUNT(*) as recent_reports
        FROM laporan_pimpinan
        WHERE is_deleted = 0
          AND tanggal_laporan >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      `;
    }

    const recentResult = await query(recentSql);
    const recentReports = recentResult[0].recent_reports;

    // Get type stats from laporan_pimpinan
    const typeStatsSql = `
      SELECT
        jenis_laporan,
        CASE
          WHEN jenis_laporan = 1 THEN 'Prioritas'
          WHEN jenis_laporan = 2 THEN 'Khusus'
          WHEN jenis_laporan = 3 THEN 'Viralitas'
          ELSE 'Unknown'
        END as type_name,
        COUNT(*) as total
      FROM laporan_pimpinan
      ${whereClause}
      GROUP BY jenis_laporan
      ORDER BY jenis_laporan
    `;
    const typeStats = await query(typeStatsSql);

    // Get media stats from laporan_staff only (laporan_pimpinan doesn't have media types)
    let mediaStatsSql = `
      SELECT
        CASE
          WHEN ls.id_jenis IS NOT NULL AND j.nama_jenis IS NOT NULL THEN j.nama_jenis
          ELSE 'Non Media'
        END as media_type,
        COUNT(ls.id) as total
      FROM laporan_staff ls
      LEFT JOIN jenis j ON ls.id_jenis = j.id_jenis
      WHERE ls.is_deleted = 0`;

    if (filters.filterType && filters.date) {
      mediaStatsSql += ` AND ${buildDateFilter(filters.filterType, filters.date, 'ls.')}`;
    }

    mediaStatsSql += `
      GROUP BY
        CASE
          WHEN ls.id_jenis IS NOT NULL AND j.nama_jenis IS NOT NULL THEN j.nama_jenis
          ELSE 'Non Media'
        END`;
    const mediaStatsRaw = await query(mediaStatsSql);

    // Aggregate media stats by type
    const mediaStatsMap = {};
    mediaStatsRaw.forEach(item => {
      const type = item.media_type;
      if (!mediaStatsMap[type]) {
        mediaStatsMap[type] = 0;
      }
      mediaStatsMap[type] += item.total;
    });

    const mediaStats = Object.keys(mediaStatsMap).map(type => ({
      media_type: type,
      total: mediaStatsMap[type]
    })).sort((a, b) => b.total - a.total);

    // Get trend stats from laporan_pimpinan
    const trendStatsSql = `
      SELECT
        DATE_FORMAT(tanggal_laporan, '%Y-%m') as month,
        jenis_laporan,
        CASE
          WHEN jenis_laporan = 1 THEN 'Prioritas'
          WHEN jenis_laporan = 2 THEN 'Khusus'
          WHEN jenis_laporan = 3 THEN 'Viralitas'
          ELSE 'Unknown'
        END as type_name,
        COUNT(*) as total
      FROM laporan_pimpinan
      WHERE is_deleted = 0
        AND tanggal_laporan >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
        AND tanggal_laporan IS NOT NULL
      GROUP BY month, jenis_laporan
      ORDER BY month DESC, jenis_laporan
    `;
    const trendStats = await query(trendStatsSql);

    const stats = {
      totalReports,
      recentReports,
      typeStats,
      mediaStats,
      trendStats,
      lastUpdated: new Date().toISOString(),
      filters: filters
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
});

/**
 * GET /api/dashboard/chart-data
 * Get chart datasets for visualization
 */
router.get("/chart-data", async (req, res) => {
  try {
    // Extract filter parameters from query string
    const filters = {
      filterType: req.query.filterType || null,
      date: req.query.date || null,
    };

    // Build date filter clause
    let whereClause = 'WHERE is_deleted = 0';
    if (filters.filterType && filters.date) {
      whereClause += ` AND ${buildDateFilter(filters.filterType, filters.date)}`;
    }

    // Get type stats from laporan_pimpinan
    const typeStatsSql = `
      SELECT
        jenis_laporan,
        CASE
          WHEN jenis_laporan = 1 THEN 'Prioritas'
          WHEN jenis_laporan = 2 THEN 'Khusus'
          WHEN jenis_laporan = 3 THEN 'Viralitas'
          ELSE 'Unknown'
        END as type_name,
        COUNT(*) as total
      FROM laporan_pimpinan
      ${whereClause}
      GROUP BY jenis_laporan
      ORDER BY jenis_laporan
    `;
    const typeStats = await query(typeStatsSql);

    // Get media stats from laporan_staff only (laporan_pimpinan doesn't have media types)
    let mediaStatsSql = `
      SELECT
        CASE
          WHEN ls.id_jenis IS NOT NULL AND j.nama_jenis IS NOT NULL THEN j.nama_jenis
          ELSE 'Non Media'
        END as media_type,
        COUNT(ls.id) as total
      FROM laporan_staff ls
      LEFT JOIN jenis j ON ls.id_jenis = j.id_jenis
      WHERE ls.is_deleted = 0`;

    if (filters.filterType && filters.date) {
      mediaStatsSql += ` AND ${buildDateFilter(filters.filterType, filters.date, 'ls.')}`;
    }

    mediaStatsSql += `
      GROUP BY
        CASE
          WHEN ls.id_jenis IS NOT NULL AND j.nama_jenis IS NOT NULL THEN j.nama_jenis
          ELSE 'Non Media'
        END
    `;
    const mediaStatsRaw = await query(mediaStatsSql);

    // Aggregate media stats by type
    const mediaStatsMap = {};
    mediaStatsRaw.forEach(item => {
      const type = item.media_type;
      if (!mediaStatsMap[type]) {
        mediaStatsMap[type] = 0;
      }
      mediaStatsMap[type] += item.total;
    });

    const mediaStats = Object.keys(mediaStatsMap).map(type => ({
      media_type: type,
      total: mediaStatsMap[type]
    })).sort((a, b) => b.total - a.total);

    // Format data for Chart.js
    const barChartData = {
      labels: typeStats.map((item) => item.type_name),
      datasets: [
        {
          label: "Jumlah Laporan",
          data: typeStats.map((item) => item.total),
          backgroundColor: [
            "rgba(255, 183, 178, 0.8)", // Soft Peach
            "rgba(255, 218, 185, 0.8)", // Light Coral / Peach Puff
            "rgba(210, 180, 140, 0.8)", // Tan / Soft Brown
          ],
          borderColor: ["rgba(255, 183, 178, 1)", "rgba(255, 218, 185, 1)", "rgba(210, 180, 140, 1)"],
          borderWidth: 1,
        },
      ],
    };

    const pieChartData = {
      labels: mediaStats.map((item) => item.media_type || "Unknown"),
      datasets: [
        {
          label: "Distribusi Media",
          data: mediaStats.map((item) => item.total),
          backgroundColor: [
            "rgba(135, 206, 235, 0.8)", // Sky Blue (Netral)
            "rgba(144, 238, 144, 0.8)", // Light Green (Netral)
            "rgba(86, 53, 251, 1)", // Peach Puff (Pastel)
            "rgba(211, 211, 211, 0.8)", // Light Gray (Netral)
            "rgba(230, 230, 250, 0.8)", // Lavender (Lembut)
            "rgba(255, 250, 205, 0.8)", // Lemon Chiffon (Kuning pastel netral)
          ],
          borderColor: ["rgba(135, 206, 235, 1)", "rgba(144, 238, 144, 1)", "rgba(86, 53, 251, 1)", "rgba(211, 211, 211, 1)", "rgba(230, 230, 250, 1)", "rgba(255, 250, 205, 1)"],
          borderWidth: 1,
        },
      ],
    };

    // Add percentage data for frontend use
    const totalMediaCount = mediaStats.reduce((sum, item) => sum + item.total, 0);
    const pieChartWithPercentages = {
      ...pieChartData,
      // Add percentage information to the dataset for tooltip use
      datasets: pieChartData.datasets.map((dataset) => ({
        ...dataset,
        // Store original data for tooltips
        originalData: [...dataset.data],
      })),
      // Add total count for percentage calculations
      totalMediaCount: totalMediaCount,
    };

    res.json({
      success: true,
      data: {
        barChart: barChartData,
        pieChart: pieChartWithPercentages,
        filters: filters,
      },
    });
  } catch (error) {
    console.error("Dashboard chart data error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch chart data",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
});

/**
 * GET /api/dashboard/trends
 * Get time-based trend data
 */
router.get("/trends", async (req, res) => {
  try {
    // Get trend stats from laporan_pimpinan
    const trendStatsSql = `
      SELECT
        DATE_FORMAT(tanggal_laporan, '%Y-%m') as month,
        jenis_laporan,
        CASE
          WHEN jenis_laporan = 1 THEN 'Prioritas'
          WHEN jenis_laporan = 2 THEN 'Khusus'
          WHEN jenis_laporan = 3 THEN 'Viralitas'
          ELSE 'Unknown'
        END as type_name,
        COUNT(*) as total
      FROM laporan_pimpinan
      WHERE is_deleted = 0
        AND tanggal_laporan >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
        AND tanggal_laporan IS NOT NULL
      GROUP BY month, jenis_laporan
      ORDER BY month DESC, jenis_laporan
    `;
    const trendData = await query(trendStatsSql);

    // Group data by month for Chart.js line chart
    const months = [...new Set(trendData.map((item) => item.month))].sort();
    const types = ["Prioritas", "Khusus", "Viralitas"];

    const datasets = types.map((type, index) => {
      const typeData = months.map((month) => {
        const found = trendData.find((item) => item.month === month && item.type_name === type);
        return found ? found.total : 0;
      });

      const colors = [
        "rgba(54, 162, 235", // Blue for Prioritas
        "rgba(255, 206, 86", // Yellow for Khusus
        "rgba(255, 99, 132", // Red for Viralitas
      ];

      return {
        label: type,
        data: typeData,
        borderColor: colors[index] + ", 1)",
        backgroundColor: colors[index] + ", 0.2)",
        tension: 0.1,
        fill: false,
      };
    });

    const lineChartData = {
      labels: months,
      datasets: datasets,
    };

    res.json({
      success: true,
      data: {
        lineChart: lineChartData,
        rawData: trendData,
      },
    });
  } catch (error) {
    console.error("Dashboard trends error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch trend data",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
});

module.exports = router;