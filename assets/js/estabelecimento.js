(async function () {
  const API = "https://portalwifi-api.oscar-lage.workers.dev/api/admin/dashboard/summary";

  try {
    const res = await fetch(API);
    const data = await res.json();

    if (!data.ok) {
      console.error("Erro ao carregar summary:", data);
      return;
    }

    const summary = data.summary || {};

    const connectedEl = document.getElementById("connectedToday");
    const newEl = document.getElementById("newCustomers");
    const returningEl = document.getElementById("returningCustomers");

    if (connectedEl) connectedEl.textContent = summary.connected ?? 0;
    if (newEl) newEl.textContent = summary.new_customers ?? 0;
    if (returningEl) returningEl.textContent = summary.returning_customers ?? 0;

    console.log("Dashboard summary carregado:", data);

  } catch (err) {
    console.error("Falha ao carregar dashboard:", err);
  }
})();
