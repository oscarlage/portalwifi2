(async function () {
  const API_BASE = "https://portalwifi-api.oscar-lage.workers.dev";
  const TENANT_ID_KEY = "portalwifi.activeTenantId";

  const tbody = document.getElementById("clientesTable");
  const buscaInput = document.getElementById("buscaCliente");

  const tenantId = localStorage.getItem(TENANT_ID_KEY);

  let allRows = [];

  function onlyDigits(v) {
    return (v || "").replace(/\D+/g, "");
  }

  function formatPhoneBR(phone) {
    const d = onlyDigits(phone);
    let p = d;

    if (p.startsWith("55") && p.length >= 12) {
      p = p.slice(2);
    }

    if (p.length === 11) {
      return `(${p.slice(0, 2)}) ${p.slice(2, 3)}${p.slice(3, 7)}-${p.slice(7, 11)}`;
    }

    if (p.length === 10) {
      return `(${p.slice(0, 2)}) ${p.slice(2, 6)}-${p.slice(6, 10)}`;
    }

    return phone || "-";
  }

  function formatDateBR(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;

    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderRows(rows) {
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="opacity:.7;">Nenhum cliente encontrado.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = rows.map(row => `
      <tr>
        <td>${escapeHtml(row.full_name || "Não informado")}</td>
        <td>${escapeHtml(formatPhoneBR(row.phone || ""))}</td>
        <td>${escapeHtml(row.city || "-")}</td>
        <td>${escapeHtml(formatDateBR(row.created_at))}</td>
      </tr>
    `).join("");
  }

  function applyFilter() {
    const q = (buscaInput?.value || "").trim().toLowerCase();

    if (!q) {
      renderRows(allRows);
      return;
    }

    const filtered = allRows.filter(row => {
      const name = String(row.full_name || "").toLowerCase();
      const phone = String(row.phone || "").toLowerCase();
      const city = String(row.city || "").toLowerCase();

      return name.includes(q) || phone.includes(q) || city.includes(q);
    });

    renderRows(filtered);
  }

  async function loadClients() {
    if (!tenantId) {
      console.error("Nenhum tenant ativo selecionado.");
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4" style="color:#ffb4b4;">
              Nenhum tenant ativo foi selecionado.
            </td>
          </tr>
        `;
      }
      return;
    }

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="opacity:.7;">Carregando clientes...</td>
        </tr>
      `;
    }

    try {
      const res = await fetch(
        `${API_BASE}/api/admin/leads?tenant_id=${encodeURIComponent(tenantId)}`
      );

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.detail || data.error || "Falha ao carregar clientes.");
      }

      allRows = Array.isArray(data.data) ? data.data : [];
      renderRows(allRows);

    } catch (err) {
      console.error("Erro ao carregar clientes:", err);

      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4" style="color:#ffb4b4;">
              Erro ao carregar clientes.
            </td>
          </tr>
        `;
      }
    }
  }

  if (buscaInput) {
    buscaInput.addEventListener("input", applyFilter);
  }

  await loadClients();
})();
