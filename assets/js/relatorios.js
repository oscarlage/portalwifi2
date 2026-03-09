(function () {
  "use strict";

  const API_BASE = "https://portalwifi-api.oscar-lage.workers.dev";
  const TENANT_ID_KEY = "portalwifi.activeTenantId";
  const TENANT_NAME_KEY = "portalwifi.activeTenantName";
  const TENANT_SLUG_KEY = "portalwifi.activeTenantSlug";

  const elConnections = document.getElementById("reportConnectionsToday");
  const elNewCustomers = document.getElementById("reportNewCustomers");
  const elReturningCustomers = document.getElementById("reportReturningCustomers");
  const elInsights = document.getElementById("reportInsights");
  const peakHoursCanvas = document.getElementById("peakHoursCanvas");

  const periodEl = document.getElementById("reportPeriod");
  const dateFromEl = document.getElementById("reportDateFrom");
  const dateToEl = document.getElementById("reportDateTo");
  const hourFromEl = document.getElementById("reportHourFrom");
  const hourToEl = document.getElementById("reportHourTo");
  const applyBtn = document.getElementById("applyReportFilters");

  let peakHoursChart = null;

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

  function buildQuery(paramsObj) {
    const qs = new URLSearchParams();
    Object.entries(paramsObj).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        qs.set(key, value);
      }
    });
    return qs.toString();
  }

  async function fetchSummary(tenantId, filters) {
    const qs = buildQuery({
      tenant_id: tenantId,
      period: filters.period,
      date_from: filters.date_from,
      date_to: filters.date_to
    });

    const res = await fetch(`${API_BASE}/api/admin/dashboard/summary?${qs}`);
    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.detail || data.error || "Falha ao carregar resumo.");
    }

    return data;
  }

  async function fetchPeakHours(tenantId, filters) {
    const qs = buildQuery({
      tenant_id: tenantId,
      period: filters.period,
      date_from: filters.date_from,
      date_to: filters.date_to,
      hour_from: filters.hour_from,
      hour_to: filters.hour_to
    });

    const res = await fetch(`${API_BASE}/api/admin/reports/peak-hours?${qs}`);
    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.detail || data.error || "Falha ao carregar horários de pico.");
    }

    return data;
  }

  function renderInsights(summary, peakHoursResponse) {
    const connected = safeNumber(summary.connected);
    const newCustomers = safeNumber(summary.new_customers);
    const returning = safeNumber(summary.returning_customers);
    const marketingOptin = safeNumber(summary.marketing_optin);

    const topHour = (peakHoursResponse.hours || []).reduce((best, current) => {
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

  function destroyChart() {
    if (peakHoursChart) {
      peakHoursChart.destroy();
      peakHoursChart = null;
    }
  }

  function renderPeakHoursChart(hoursResponse) {
    if (!peakHoursCanvas || !window.Chart) return;

    destroyChart();

    peakHoursChart = new Chart(peakHoursCanvas, {
      type: "bar",
      data: {
        labels: (hoursResponse.hours || []).map(item => item.label),
        datasets: [
          {
            label: "Conexões por hora",
            data: (hoursResponse.hours || []).map(item => safeNumber(item.value)),
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: "#f8fbff"
            }
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

      const summaryResponse = await fetchSummary(tenantId, filters);
      const peakHoursResponse = await fetchPeakHours(tenantId, filters);

      const summary = summaryResponse.summary || {};

      setText(elConnections, summary.connected ?? 0);
      setText(elNewCustomers, summary.new_customers ?? 0);
      setText(elReturningCustomers, summary.returning_customers ?? 0);

      renderPeakHoursChart(peakHoursResponse);
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
