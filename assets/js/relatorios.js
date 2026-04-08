(function () {
  "use strict";

  const TENANT_ID_KEY = "portalwifi.activeTenantId";
  const TENANT_NAME_KEY = "portalwifi.activeTenantName";
  const TENANT_SLUG_KEY = "portalwifi.activeTenantSlug";

  const elConnections = document.getElementById("reportConnectionsToday");
  const elNewCustomers = document.getElementById("reportNewCustomers");
  const elReturningCustomers = document.getElementById("reportReturningCustomers");
  const elInsights = document.getElementById("reportInsights");

  const peakHoursCanvas = document.getElementById("peakHoursCanvas");
  const customersMixCanvas = document.getElementById("customersMixCanvas");

  const periodEl = document.getElementById("reportPeriod");
  const dateFromEl = document.getElementById("reportDateFrom");
  const dateToEl = document.getElementById("reportDateTo");
  const hourFromEl = document.getElementById("reportHourFrom");
  const hourToEl = document.getElementById("reportHourTo");
  const applyBtn = document.getElementById("applyReportFilters");

  let peakHoursChart = null;
  let customersMixChart = null;
  let loadReportSummary = null;
  let loadPeakHoursReport = null;

  function getTenantContext() {
    return {
      tenantId: localStorage.getItem(TENANT_ID_KEY),
      tenantName: localStorage.getItem(TENANT_NAME_KEY),
      tenantSlug: localStorage.getItem(TENANT_SLUG_KEY)
    };
  }

  function setText(el, value) {
    if (el) el.textContent = String(value ?? "");
  }

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function renderError(message) {
    if (!elInsights) return;
    elInsights.innerHTML = `
      <ul class="bullets">
        <li class="text-danger">${message}</li>
      </ul>
    `;
  }

  function populateHourSelects() {
    const options = Array.from({ length: 24 }, (_, i) =>
      `<option value="${i}">${String(i).padStart(2, "0")}h</option>`
    ).join("");

    if (hourFromEl) hourFromEl.innerHTML = options;
    if (hourToEl) hourToEl.innerHTML = options;

    if (hourFromEl) hourFromEl.value = "0";
    if (hourToEl) hourToEl.value = "23";
  }

  function toggleCustomDates() {
    const isCustom = periodEl?.value === "custom";
    if (dateFromEl) dateFromEl.disabled = !isCustom;
    if (dateToEl) dateToEl.disabled = !isCustom;
  }

  function getFilters() {
    return {
      period: periodEl?.value || "today",
      date_from: dateFromEl?.value || "",
      date_to: dateToEl?.value || "",
      hour_from: hourFromEl?.value || "0",
      hour_to: hourToEl?.value || "23"
    };
  }

  async function ensureReportServices() {
    if (loadReportSummary && loadPeakHoursReport) {
      return {
        getReportSummary: loadReportSummary,
        getPeakHoursReport: loadPeakHoursReport
      };
    }

    const module = await import("./services/session-service.js");
    loadReportSummary = module.getReportSummary;
    loadPeakHoursReport = module.getPeakHoursReport;

    return {
      getReportSummary: loadReportSummary,
      getPeakHoursReport: loadPeakHoursReport
    };
  }

  function renderInsights(summary, peakHoursResponse) {
    const connected = safeNumber(summary.connected);
    const newCustomers = safeNumber(summary.new_customers);
    const returning = safeNumber(summary.returning_customers);
    const marketingOptin = safeNumber(summary.marketing_optin);

    const topHour = (peakHoursResponse || []).reduce((best, current) => {
      if (!best || safeNumber(current.value) > safeNumber(best.value)) return current;
      return best;
    }, null);

    const insights = [];

    insights.push(`Foram registradas ${connected} conexão(ões) no período filtrado.`);
    insights.push(`${newCustomers} novo(s) cliente(s) foram captados.`);
    insights.push(`${returning} cliente(s) recorrente(s) retornaram.`);
    insights.push(`${marketingOptin} cliente(s) possuem opt-in de marketing.`);

    if (topHour && safeNumber(topHour.value) > 0) {
      insights.push(`O horário de maior movimento foi ${topHour.label}, com ${topHour.value} conexão(ões).`);
    } else {
      insights.push("Ainda não há dados suficientes para identificar horário de pico.");
    }

    if (elInsights) {
      elInsights.innerHTML = `
        <ul class="bullets">
          ${insights.map(item => `<li>${item}</li>`).join("")}
        </ul>
      `;
    }
  }

  function destroyCharts() {
    if (peakHoursChart) {
      peakHoursChart.destroy();
      peakHoursChart = null;
    }
    if (customersMixChart) {
      customersMixChart.destroy();
      customersMixChart = null;
    }
  }

  function renderPeakHoursChart(hoursResponse) {
    if (!peakHoursCanvas || !window.Chart) return;

    peakHoursChart = new Chart(peakHoursCanvas, {
      type: "bar",
      data: {
        labels: (hoursResponse || []).map(item => item.label),
        datasets: [
          {
            label: "Conexões por hora",
            data: (hoursResponse || []).map(item => safeNumber(item.value)),
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: "#f8fbff" }
          }
        },
        scales: {
          x: {
            ticks: { color: "#b9c7e6" },
            grid: { color: "rgba(255,255,255,.08)" }
          },
          y: {
            beginAtZero: true,
            ticks: { color: "#b9c7e6", precision: 0 },
            grid: { color: "rgba(255,255,255,.08)" }
          }
        }
      }
    });
  }

  function renderCustomersMixChart(summary) {
    if (!customersMixCanvas || !window.Chart) return;

    customersMixChart = new Chart(customersMixCanvas, {
      type: "bar",
      data: {
        labels: ["Novos clientes", "Recorrentes"],
        datasets: [
          {
            label: "Clientes no período",
            data: [
              safeNumber(summary.new_customers),
              safeNumber(summary.returning_customers)
            ],
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: "#f8fbff" }
          }
        },
        scales: {
          x: {
            ticks: { color: "#b9c7e6" },
            grid: { color: "rgba(255,255,255,.08)" }
          },
          y: {
            beginAtZero: true,
            ticks: { color: "#b9c7e6", precision: 0 },
            grid: { color: "rgba(255,255,255,.08)" }
          }
        }
      }
    });
  }

  async function loadReports() {
    const { tenantId } = getTenantContext();

    if (!tenantId) {
      renderError("Nenhum tenant ativo foi selecionado. Volte à plataforma e selecione um tenant.");
      return;
    }

    try {
      const filters = getFilters();
      const services = await ensureReportServices();

      const summary = await services.getReportSummary(tenantId, filters);
      const peakHoursResponse = await services.getPeakHoursReport(tenantId, filters);

      setText(elConnections, summary.connected ?? 0);
      setText(elNewCustomers, summary.new_customers ?? 0);
      setText(elReturningCustomers, summary.returning_customers ?? 0);

      destroyCharts();
      renderPeakHoursChart(peakHoursResponse);
      renderCustomersMixChart(summary);
      renderInsights(summary, peakHoursResponse);

    } catch (err) {
      console.error("Erro ao carregar relatórios:", err);
      renderError("Não foi possível carregar os relatórios com os filtros informados.");
    }
  }

  function bindEvents() {
    if (periodEl) {
      periodEl.addEventListener("change", toggleCustomDates);
    }

    if (applyBtn) {
      applyBtn.addEventListener("click", loadReports);
    }
  }

  function init() {
    populateHourSelects();
    toggleCustomDates();
    bindEvents();
    loadReports();
  }

  init();
})();
