<!doctype html>
<html lang="pt-br">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dashboard</title>
  <link rel="stylesheet" href="/assets/css/estabelecimento.css">
</head>
<body class="frame-page">
  <section class="dashboard-grid">
    <div class="metric-card">
      <div class="metric-label">Conectados hoje</div>
      <div class="metric-value" id="connectedToday">0</div>
    </div>

    <div class="metric-card">
      <div class="metric-label">Novos clientes</div>
      <div class="metric-value" id="newCustomers">0</div>
    </div>

    <div class="metric-card">
      <div class="metric-label">Recorrentes</div>
      <div class="metric-value" id="returningCustomers">0</div>
    </div>
  </section>

  <section class="panel-card">
    <h2>Dicas para seu negócio</h2>
    <p>Em breve aqui aparecerão insights automáticos sobre movimento, retorno e oportunidades.</p>
  </section>

  <script>
    (async function () {
      const API = "https://portalwifi-api.oscar-lage.workers.dev/api/admin/dashboard/summary";

      try {
        const res = await fetch(API);
        const data = await res.json();
        if (!data.ok) return;

        document.getElementById("connectedToday").textContent = data.summary.connected ?? 0;
        document.getElementById("newCustomers").textContent = data.summary.new_customers ?? 0;
        document.getElementById("returningCustomers").textContent = data.summary.returning_customers ?? 0;
      } catch (err) {
        console.error("Erro ao carregar dashboard:", err);
      }
    })();
  </script>
</body>
</html>
