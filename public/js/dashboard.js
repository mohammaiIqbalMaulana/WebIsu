/**
 * Dashboard JavaScript
 * Handles Chart.js initialization, data fetching, and auto-refresh
 */

class Dashboard {
  constructor() {
    this.charts = {};
    this.refreshInterval = 30000; // 30 seconds
    this.refreshTimer = null;
    this.isLoading = false;
    this.currentFilters = {
      filterType: "all",
      date: null,
    };

    this.init();
  }

  /**
   * Initialize dashboard
   */
  async init() {
    try {
      this.showLoading(true);
      this.setupFilterControls();
      await this.initCharts();
      this.setupAutoRefresh();
      this.setupEventListeners();
      this.showLoading(false);
      this.showSuccess("Dashboard loaded successfully");
    } catch (error) {
      console.error("Dashboard initialization error:", error);
      this.showError("Failed to load dashboard");
      this.showLoading(false);
    }
  }

  /**
   * Initialize all charts
   */
  async initCharts() {
    // Get chart data from API
    const data = await this.fetchChartData();

    // Initialize Bar Chart
    this.initBarChart(data.barChart);

    // Initialize Pie Chart
    this.initPieChart(data.pieChart);
  }

  /**
   * Initialize Bar Chart (Report Types)
   */
  initBarChart(data) {
    const ctx = document.getElementById("barChart");
    if (!ctx) {
      console.warn("Bar chart canvas not found");
      return;
    }

    // Destroy existing chart if it exists
    if (this.charts.barChart) {
      this.charts.barChart.destroy();
    }

    this.charts.barChart = new Chart(ctx, {
      type: "bar",
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: "Laporan berdasarkan Jenis",
            font: {
              size: 16,
              weight: "bold",
            },
          },
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
            },
          },
        },
        animation: {
          duration: 1000,
          easing: "easeInOutQuart",
        },
      },
    });
  }

  /**
   * Initialize Pie Chart (Media Types)
   */
  initPieChart(data) {
    const ctx = document.getElementById("pieChart");
    if (!ctx) {
      console.warn("Pie chart canvas not found");
      return;
    }

    // Destroy existing chart if it exists
    if (this.charts.pieChart) {
      this.charts.pieChart.destroy();
    }

    // Calculate percentages for display
    const dataset = data.datasets[0];
    const originalData = dataset.originalData || dataset.data;
    const total = data.totalMediaCount || originalData.reduce((sum, value) => sum + value, 0);
    const percentages = originalData.map((value) => (total > 0 ? ((value / total) * 100).toFixed(1) : 0));

    // Update labels to show percentages
    const percentageLabels = data.labels.map((label, index) => `${label} (${percentages[index]}%)`);

    // Create chart with percentage labels
    const chartData = {
      labels: percentageLabels,
      datasets: [
        {
          ...dataset,
          data: originalData, // Keep original data for accurate visualization
        },
      ],
    };

    this.charts.pieChart = new Chart(ctx, {
      type: "pie",
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: "Distribusi berdasarkan Media",
            font: {
              size: 16,
              weight: "bold",
            },
          },
          legend: {
            position: "bottom",
            labels: {
              padding: 20,
              usePointStyle: true,
            },
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const dataset = context.dataset;
                const originalData = dataset.originalData || dataset.data;
                const value = originalData[context.dataIndex] || 0;
                const total = context.chart.data.totalMediaCount || originalData.reduce((sum, val) => sum + val, 0);
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;

                return `${context.label.split(" (")[0]}: ${percentage}% (${value} laporan)`;
              },
            },
          },
        },
        animation: {
          duration: 1000,
          easing: "easeInOutQuart",
        },
      },
    });
  }

  /**
   * Fetch chart data from API
   */
  async fetchChartData() {
    try {
      const params = new URLSearchParams();
      if (this.currentFilters.filterType !== "all" && this.currentFilters.date) {
        params.append("filterType", this.currentFilters.filterType);
        params.append("date", this.currentFilters.date);
      }

      const url = `/api/dashboard/chart-data${params.toString() ? "?" + params.toString() : ""}`;
      const response = await fetch(url, {
        method: "GET",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to fetch chart data");
      }

      return result.data;
    } catch (error) {
      console.error("Error fetching chart data:", error);
      throw error;
    }
  }

  /**
   * Fetch dashboard statistics
   */
  async fetchStats() {
    try {
      const params = new URLSearchParams();
      if (this.currentFilters.filterType !== "all" && this.currentFilters.date) {
        params.append("filterType", this.currentFilters.filterType);
        params.append("date", this.currentFilters.date);
      }

      const url = `/api/dashboard/stats${params.toString() ? "?" + params.toString() : ""}`;
      const response = await fetch(url, {
        method: "GET",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to fetch statistics");
      }

      return result.data;
    } catch (error) {
      console.error("Error fetching stats:", error);
      throw error;
    }
  }

  /**
   * Update charts with new data
   */
  async updateCharts() {
    if (this.isLoading) return;

    try {
      this.isLoading = true;
      this.showRefreshIndicator(true);

      const data = await this.fetchChartData();

      // Update bar chart
      if (this.charts.barChart && data.barChart) {
        this.charts.barChart.data = data.barChart;
        this.charts.barChart.update("active");
      }

      // Update pie chart
      if (this.charts.pieChart && data.pieChart) {
        this.charts.pieChart.data = data.pieChart;
        this.charts.pieChart.update("active");
      }

      // Update stats if element exists
      await this.updateStats();

      this.showRefreshIndicator(false);
      this.updateLastRefreshTime();
    } catch (error) {
      console.error("Error updating charts:", error);
      this.showError("Failed to refresh charts");
      this.showRefreshIndicator(false);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Update statistics display
   */
  async updateStats() {
    try {
      const stats = await this.fetchStats();

      // Update total reports
      const totalElement = document.getElementById("totalReports");
      if (totalElement && stats.totalReports !== undefined) {
        totalElement.textContent = stats.totalReports.toLocaleString();
      }

      // Update recent reports
      const recentElement = document.getElementById("recentReports");
      if (recentElement && stats.recentReports !== undefined) {
        recentElement.textContent = stats.recentReports.toLocaleString();
      }

      // Update priority reports (count of jenis_laporan = 1)
      const priorityElement = document.getElementById("priorityReports");
      if (priorityElement && stats.typeStats) {
        const priorityData = stats.typeStats.find((item) => item.jenis_laporan === 1);
        const priorityCount = priorityData ? priorityData.total : 0;
        priorityElement.textContent = priorityCount.toLocaleString();
      }
    } catch (error) {
      console.error("Error updating stats:", error);
    }
  }

  /**
   * Setup auto-refresh functionality
   */
  setupAutoRefresh() {
    this.startAutoRefresh();
  }

  /**
   * Start auto-refresh
   */
  startAutoRefresh() {
    // Clear existing timer
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    // Set up new timer
    this.refreshTimer = setInterval(() => {
      this.updateCharts();
    }, this.refreshInterval);

    console.log(`Auto-refresh enabled: ${this.refreshInterval / 1000}s interval`);
    this.updateToggleIcon();
  }

  /**
   * Stop auto-refresh
   */
  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    console.log("Auto-refresh disabled");
    this.updateToggleIcon();
  }

  /**
   * Update toggle icon based on auto-refresh state
   */
  updateToggleIcon() {
    const icon = document.getElementById("autoRefreshIcon");
    if (icon) {
      icon.className = this.refreshTimer ? "bi bi-pause-circle" : "bi bi-play-circle";
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Manual refresh button
    const refreshBtn = document.getElementById("refreshBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        this.updateCharts();
      });
    }

    // Toggle auto-refresh button
    const toggleBtn = document.getElementById("toggleAutoRefresh");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        if (this.refreshTimer) {
          this.stopAutoRefresh();
        } else {
          this.startAutoRefresh();
        }
      });
    }

    // Handle visibility change (pause refresh when tab is hidden)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.stopAutoRefresh();
      } else {
        this.startAutoRefresh();
        this.updateCharts(); // Refresh when tab becomes visible
      }
    });
  }

  /**
   * Setup filter controls
   */
  setupFilterControls() {
    // Filter buttons
    const filterButtons = document.querySelectorAll(".filter-btn");
    filterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        // Remove active class from all buttons
        filterButtons.forEach((b) => b.classList.remove("active"));
        // Add active class to clicked button
        btn.classList.add("active");

        const filterType = btn.getAttribute("data-filter");
        this.currentFilters.filterType = filterType;

        // Show/hide appropriate date picker
        this.toggleDatePicker(filterType);

        // If "all" is selected, update immediately
        if (filterType === "all") {
          this.currentFilters.date = null;
          this.updateCharts();
        } else this.updateCharts();
      });
    });

    // Date pickers
    const dailyPicker = document.getElementById("dailyPicker");
    const weeklyPicker = document.getElementById("weeklyPicker");
    const monthlyPicker = document.getElementById("monthlyPicker");

    if (dailyPicker) {
      dailyPicker.addEventListener("change", (e) => {
        this.currentFilters.date = e.target.value;
        this.updateCharts();
      });
    }

    if (weeklyPicker) {
      weeklyPicker.addEventListener("change", (e) => {
        // Convert week format (2024-W01) to first day of week
        const [year, week] = e.target.value.split("-W");
        const firstDayOfYear = new Date(year, 0, 1);
        const daysToFirstMonday = (8 - firstDayOfYear.getDay()) % 7;
        const firstMonday = new Date(year, 0, 1 + daysToFirstMonday);
        const weekStart = new Date(firstMonday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);

        this.currentFilters.date = weekStart.toISOString().split("T")[0];
        this.updateCharts();
      });
    }

    if (monthlyPicker) {
      monthlyPicker.addEventListener("change", (e) => {
        this.currentFilters.date = e.target.value; // Format: YYYY-MM
        this.updateCharts();
      });
    }

    // Set default date values
    const today = new Date();
    if (dailyPicker) dailyPicker.value = today.toISOString().split("T")[0];
    if (monthlyPicker) {
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      monthlyPicker.value = `${year}-${month}`;
    }
    if (weeklyPicker) {
      const year = today.getFullYear();
      const week = this.getWeekNumber(today);
      weeklyPicker.value = `${year}-W${String(week).padStart(2, "0")}`;
    }
  }

  /**
   * Toggle date picker visibility based on filter type
   */
  toggleDatePicker(filterType) {
    const dailyPicker = document.getElementById("dailyPicker");
    const weeklyPicker = document.getElementById("weeklyPicker");
    const monthlyPicker = document.getElementById("monthlyPicker");

    // Hide all pickers first
    [dailyPicker, weeklyPicker, monthlyPicker].forEach((picker) => {
      if (picker) picker.style.display = "none";
    });

    // Show appropriate picker
    switch (filterType) {
      case "daily":
        if (dailyPicker) {
          dailyPicker.style.display = "block";
          this.currentFilters.date = dailyPicker.value;
        }
        break;
      case "weekly":
        if (weeklyPicker) {
          weeklyPicker.style.display = "block";
          if (weeklyPicker.value) {
            const [year, week] = weeklyPicker.value.split("-W");
            const firstDayOfYear = new Date(year, 0, 1);
            const daysToFirstMonday = (8 - firstDayOfYear.getDay()) % 7;
            const firstMonday = new Date(year, 0, 1 + daysToFirstMonday);
            const weekStart = new Date(firstMonday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
            this.currentFilters.date = weekStart.toISOString().split("T")[0];
          }
        }
        break;
      case "monthly":
        if (monthlyPicker) {
          monthlyPicker.style.display = "block";
          this.currentFilters.date = monthlyPicker.value;
        }
        break;
      default:
        this.currentFilters.date = null;
    }
  }

  /**
   * Get week number for date
   */
  getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  /**
   * Show/hide loading indicator
   */
  showLoading(show) {
    const loader = document.getElementById("dashboardLoader");
    if (loader) {
      loader.style.display = show ? "block" : "none";
    }
  }

  /**
   * Show/hide refresh indicator
   */
  showRefreshIndicator(show) {
    const indicator = document.getElementById("refreshIndicator");
    if (indicator) {
      indicator.style.display = show ? "inline-block" : "none";
    }
  }

  /**
   * Update last refresh time display
   */
  updateLastRefreshTime() {
    const element = document.getElementById("lastRefresh");
    if (element) {
      const now = new Date();
      element.textContent = now.toLocaleTimeString("id-ID");
    }
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    this.showToast(message, "success");
  }

  /**
   * Show error message
   */
  showError(message) {
    this.showToast(message, "error");
  }

  /**
   * Show toast notification
   */
  showToast(message, type = "info") {
    // Create toast element if it doesn't exist
    let toast = document.getElementById("dashboardToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "dashboardToast";
      toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 4px;
                color: white;
                font-weight: 500;
                z-index: 9999;
                opacity: 0;
                transition: opacity 0.3s ease;
            `;
      document.body.appendChild(toast);
    }

    // Set message and style based on type
    toast.textContent = message;
    toast.className = `toast toast-${type}`;

    switch (type) {
      case "success":
        toast.style.backgroundColor = "#28a745";
        break;
      case "error":
        toast.style.backgroundColor = "#dc3545";
        break;
      default:
        toast.style.backgroundColor = "#007bff";
    }

    // Show toast
    toast.style.opacity = "1";

    // Hide after 3 seconds
    setTimeout(() => {
      toast.style.opacity = "0";
    }, 3000);
  }

  /**
   * Cleanup - destroy charts and clear timers
   */
  destroy() {
    // Clear refresh timer
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    // Destroy charts
    Object.values(this.charts).forEach((chart) => {
      if (chart && typeof chart.destroy === "function") {
        chart.destroy();
      }
    });

    this.charts = {};
    console.log("Dashboard destroyed");
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Only initialize if we're on the dashboard page
  if (document.getElementById("barChart") || document.getElementById("pieChart")) {
    window.dashboard = new Dashboard();
  }
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (window.dashboard) {
    window.dashboard.destroy();
  }
});