(function () {

const API_BASE = "https://portalwifi-api.oscar-lage.workers.dev";

const TENANT_ID_KEY = "portalwifi.activeTenantId";
const TENANT_NAME_KEY = "portalwifi.activeTenantName";
const TENANT_SLUG_KEY = "portalwifi.activeTenantSlug";

const tenantId = localStorage.getItem(TENANT_ID_KEY);
const tenantName = localStorage.getItem(TENANT_NAME_KEY);
const tenantSlug = localStorage.getItem(TENANT_SLUG_KEY);

const elTenantName = document.getElementById("tenantName");
const elConnected = document.getElementById("metricConnected");
const elNewCustomers = document.getElementById("metricNewCustomers");
const elReturning = document.getElementById("metricReturning");

init();

async function init() {

  if (!tenantId) {
    alert("Nenhum tenant ativo selecionado.");
    window.location.href = "/platform.html";
    return;
  }

  if (elTenantName) {
    elTenantName.textContent = tenantName || tenantSlug || "Estabelecimento";
  }

  await loadDashboard();

}

async function loadDashboard() {

  try {

    const res = await fetch(
      `${API_BASE}/api/admin/dashboard/summary?tenant_id=${tenantId}`
    );

    const data = await res.json();

    if (!data.ok) {
      console.error("Erro dashboard:", data);
      return;
    }

    const s = data.summary;

    if (elConnected) elConnected.textContent = s.connected ?? 0;
    if (elNewCustomers) elNewCustomers.textContent = s.new_customers ?? 0;
    if (elReturning) elReturning.textContent = s.returning_customers ?? 0;

  } catch (err) {
    console.error("Erro ao carregar dashboard:", err);
  }

}

})();
