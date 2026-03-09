(function () {
  "use strict";

  const API_BASE = "https://portalwifi-api.oscar-lage.workers.dev";
  const TENANT_ID_KEY = "portalwifi.activeTenantId";
  const TENANT_NAME_KEY = "portalwifi.activeTenantName";
  const TENANT_SLUG_KEY = "portalwifi.activeTenantSlug";

  const elConnectionsToday = document.getElementById("reportConnectionsToday");
  const elNewCustomers = document.getElementById("reportNewCustomers");
  const elReturningCustomers = document.getElementById("reportReturningCustomers");
  const elInsights = document.getElementById("reportInsights");
  const peakHoursCanvas = document.getElementById("peakHoursCanvas");

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
    if (elInsights) {
      elInsights.innerHTML = `
        <ul class="bullets">
          <li class="text-danger">${message}</li>
        </ul>
      `;
    }
  }

  function renderInsights(summary) {
    const connected = safeNumber(summary.connected);
    const newCustomers = safeNumber(summary.new_customers);
    const returning = safeNumber(summary.returning_customers);
    const marketingOptin = safeNumber(summary.marketing_optin);

    const insights = [];

    if (connected > 0) {
      insights.push(`Foram registradas ${connected} conexão(ões) no período consultado.`);
    } else {
      insights.push("Ainda não há conexões suficientes para análise no período.");
    }

    if (newCustomers > 0) {
      insights.push(`${newCustomers} novo(s) cliente(s) foram captados via Wi-Fi.`);
    } else {
      insights.push("Nenhum novo cliente foi captado no período.");
    }

    if (returning > 0) {
      insights.push(`${returning} cliente(s) recorrente(s) retornaram ao estabelecimento.`);
    } else {
      insights.push("Ainda não há recorrência suficiente para análise mais profunda.");
    }

    if (marketingOptin > 0) {
      insights.push(`${marketingOptin} cliente(s) aceitaram receber comunicações de marketing.`);
    } else {
      insights.push("Nenhum cliente com opt-in de marketing foi identificado até agora.");
    }

    if (elInsights) {
      elInsights.innerHTML = `
        <ul class="bullets">
          ${insights.map(item => `<li>${item}</li>`).join("")}
        </ul>
      `;
    }
  }

  function inferPeakHoursFromSummary(summary) {
    const connected = safeNumber(summary.connected);
    const newCustomers = safeNumber(summary.new_customers);
    const returning = safeNumber(summary.returning_customers);

    const base = Math.max(connected, 1);
    const labels = [
      "08h", "09h", "10h", "11h", "12h", "13h",
      "14h", "15h", "16h", "17h", "18h", "19h",
      "20h", "21h"
    ];

    const middayBoost = Math.max(newCustomers, 1);
    const eveningBoost = Math.max(returning, 1);

    const values = labels.map((hour, idx) => {
      let factor = 0.12;

      if (idx >= 3 && idx <= 5) factor += 0.22;
      if (idx >= 6 && idx <= 8) factor += 0.10;
      if (idx >= 9 && idx <= 12) factor += 0.18;

      if (idx >= 4 && idx <= 6) factor += middayBoost * 0.01;
      if (idx >= 10 && idx <= 12) factor += eveningBoost * 0.01;

      return Math.max(0, Math.round(base * factor));
    });

    return { labels, values, inferred: true };
  }

  async function fetchSummary(tenantId) {
    const res = await fetch(
      `${API_BASE}/api/admin/dashboard/summary?tenant_id=${encodeURIComponent(tenantId)}`
    );

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.detail || data.error || "Falha ao carregar resumo.");
    }

    return data.summary || {};
  }

  async function fetchPeakHours(tenantId) {
    // Endpoint futuro recomendado:
    // /api/admin/reports/peak-hours?tenant_id=...
    // Enquanto não existir, retornamos null para usar inferência local.
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/reports/peak-hours?tenant_id=${encodeURIComponent(tenantId)}`
      );

      if (!res.ok) return null;

      const data = await res.json();
      if (!data.ok || !Array.isArray(data.hours)) return null;

      return {
        labels: data.hours.map(item => item.label),
        values: data.hours.map(item => safeNumber(item.value)),
        inferred: false
      };
    } catch (_) {
      return null;
    }
  }

  function destroyChart() {
    if (peakHoursChart) {
      peakHoursChart.destroy();
      peakHoursChart = null;
    }
  }

  function renderPeakHoursChart(dataset) {
    if (!peakHoursCanvas || !window.Chart) return;

    destroyChart();

    peakHoursChart = new Chart(peakHoursCanvas, {
      type: "bar",
      data: {
        labels: dataset.labels,
        datasets: [
          {
            label: dataset.inferred ? "Fluxo estimado" : "Conexões por hora",
            data: dataset.values,
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
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                return `${context.raw} conexão(ões)`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: "#b9c7e6"
            },
            grid: {
              color: "rgba(255,255,255,.08)"
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: "#b9c7e6",
              precision: 0
            },
            grid: {
              color: "rgba(255,255,255,.08)"
            }
          }
        }
      }
    });
  }

  async function init() {
    const { tenantId, tenantName, tenantSlug } = getTenantContext();

    if (!tenantId) {
      renderError("Nenhum tenant ativo foi selecionado. Volte à plataforma e selecione um tenant.");
      return;
    }

    try {
      const summary = await fetchSummary(tenantId);

      setText(elConnectionsToday, summary.connected ?? 0);
      setText(elNewCustomers, summary.new_customers ?? 0);
      setText(elReturningCustomers, summary.returning_customers ?? 0);

      renderInsights(summary);

      const peakHours =
        (await fetchPeakHours(tenantId)) ||
        inferPeakHoursFromSummary(summary);

      renderPeakHoursChart(peakHours);

      if (peakHours.inferred && elInsights) {
        elInsights.innerHTML += `
          <ul class="bullets">
            <li class="muted">
              O gráfico de horários está em modo estimado para ${tenantName || tenantSlug || tenantId}, até o endpoint analítico específico ser disponibilizado.
            </li>
          </ul>
        `;
      }
    } catch (err) {
      console.error("Erro ao carregar relatórios:", err);
      renderError("Não foi possível carregar os relatórios do estabelecimento.");
    }
  }

  init();
})();
