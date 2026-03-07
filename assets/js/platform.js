(function () {
  const navLinks = document.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll(".section");

  const modalCreateTenant = document.getElementById("modalCreateTenant");
  const modalChangeAdmin = document.getElementById("modalChangeAdmin");
  const modalDisableTenant = document.getElementById("modalDisableTenant");
  const modalAccessResult = document.getElementById("modalAccessResult");

  const tenantsTableBody = document.getElementById("tenantsTableBody");
  const tenantSearch = document.getElementById("tenantSearch");
  const tenantStatusFilter = document.getElementById("tenantStatusFilter");

  const btnOpenCreateTenant = document.getElementById("btnOpenCreateTenant");
  const btnOpenCreateTenant2 = document.getElementById("btnOpenCreateTenant2");
  const btnReloadTenants = document.getElementById("btnReloadTenants");
  const btnRefreshPlatform = document.getElementById("btnRefreshPlatform");

  const accessResultText = document.getElementById("accessResultText");
  const btnCopyAccessMessage = document.getElementById("btnCopyAccessMessage");

  const ACTIVE_TENANT_ID_KEY = "portalwifi.activeTenantId";
  const ACTIVE_TENANT_NAME_KEY = "portalwifi.activeTenantName";
  const ACTIVE_TENANT_SLUG_KEY = "portalwifi.activeTenantSlug";

  let allTenants = [
    {
      id: "8814c725-ff72-41f2-be86-e9671bcc6c7b",
      name: "Sítio Coisa Nossa",
      slug: "sitio-coisa-nossa",
      status: "active",
      created_at: "2026-03-06T10:00:00Z",
      admin_name: "Oscar Lage",
      admin_email: "oscar@teste.com"
    }
  ];

  function getActiveTenantId() {
    return localStorage.getItem(ACTIVE_TENANT_ID_KEY) || "";
  }

  function setActiveTenant(tenant) {
    localStorage.setItem(ACTIVE_TENANT_ID_KEY, tenant.id);
    localStorage.setItem(ACTIVE_TENANT_NAME_KEY, tenant.name);
    localStorage.setItem(ACTIVE_TENANT_SLUG_KEY, tenant.slug);
  }

  function setSection(name) {
    navLinks.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.section === name);
    });

    sections.forEach(sec => {
      const id = sec.id.replace("section-", "");
      sec.classList.toggle("active", id === name);
    });
  }

  function openModal(el) {
    if (el) el.classList.remove("hidden");
  }

  function closeModal(el) {
    if (el) el.classList.add("hidden");
  }

  function formatDateBR(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("pt-BR");
  }

  function statusBadge(status) {
    const cls = status || "pending";
    const label =
      cls === "active" ? "Ativo" :
      cls === "disabled" ? "Desabilitado" :
      "Pendente";

    return `<span class="badge ${cls}">${label}</span>`;
  }

  function activeBadge(isActive) {
    if (!isActive) return "";
    return `<div style="margin-top:6px;"><span class="badge active">Tenant ativo</span></div>`;
  }

  function renderMetrics(rows) {
    document.getElementById("metricTotalTenants").textContent = rows.length;
    document.getElementById("metricActiveTenants").textContent = rows.filter(r => r.status === "active").length;
    document.getElementById("metricDisabledTenants").textContent = rows.filter(r => r.status === "disabled").length;
    document.getElementById("metricAdmins").textContent = rows.filter(r => !!r.admin_email).length;
  }

  function filteredTenants() {
    const q = (tenantSearch?.value || "").trim().toLowerCase();
    const status = tenantStatusFilter?.value || "";

    return allTenants.filter(row => {
      const text = `${row.name} ${row.slug} ${row.admin_name} ${row.admin_email}`.toLowerCase();
      const okSearch = !q || text.includes(q);
      const okStatus = !status || row.status === status;
      return okSearch && okStatus;
    });
  }

  function renderTenants() {
    const rows = filteredTenants();
    renderMetrics(allTenants);

    if (!rows.length) {
      tenantsTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-row">Nenhum tenant encontrado.</td>
        </tr>
      `;
      return;
    }

    const activeTenantId = getActiveTenantId();

    tenantsTableBody.innerHTML = rows.map(row => {
      const isActive = row.id === activeTenantId;

      return `
        <tr>
          <td>
            <strong>${escapeHtml(row.name)}</strong><br>
            <small class="muted">${escapeHtml(row.id)}</small>
            ${activeBadge(isActive)}
          </td>
          <td>${escapeHtml(row.slug)}</td>
          <td>${statusBadge(row.status)}</td>
          <td>${escapeHtml(row.admin_name || "-")}</td>
          <td>${escapeHtml(row.admin_email || "-")}</td>
          <td>${escapeHtml(formatDateBR(row.created_at))}</td>
          <td>
            <div class="actions">
              <button class="btn btn-light btn-sm" data-action="select" data-id="${row.id}">
                ${isActive ? "Selecionado" : "Selecionar"}
              </button>

              <button class="btn btn-primary btn-sm" data-action="open-panel" data-id="${row.id}">
                Abrir painel
              </button>

              <button class="btn btn-light btn-sm" data-action="change-admin" data-id="${row.id}">
                Alterar admin
              </button>

              <button class="btn btn-light btn-sm" data-action="resend-access" data-id="${row.id}">
                Reenviar acesso
              </button>

              ${
                row.status === "disabled"
                  ? `<button class="btn btn-primary btn-sm" data-action="enable" data-id="${row.id}">Habilitar</button>`
                  : `<button class="btn btn-danger btn-sm" data-action="disable" data-id="${row.id}">Desabilitar</button>`
              }
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function buildAccessMessage(tenant, adminEmail, adminName) {
    return [
      `Olá, ${adminName || "Administrador(a)"}.`,
      ``,
      `Seu acesso ao painel do tenant foi criado com sucesso.`,
      ``,
      `Tenant: ${tenant.name}`,
      `Slug: ${tenant.slug}`,
      `Painel: https://portalwifi2.pages.dev/painel`,
      `Usuário: ${adminEmail}`,
      `Senha provisória: [gerar/definir]`,
      ``,
      `Recomendamos alterar a senha no primeiro acesso.`,
      ``,
      `Equipe Portal WiFi`
    ].join("\n");
  }

  function handleCreateTenant() {
    const tenantName = document.getElementById("tenantName").value.trim();
    const tenantSlug = document.getElementById("tenantSlug").value.trim();
    const tenantStatus = document.getElementById("tenantStatus").value;
    const adminName = document.getElementById("adminName").value.trim();
    const adminEmail = document.getElementById("adminEmail").value.trim();

    if (!tenantName || !tenantSlug || !adminName || !adminEmail) {
      alert("Preencha os dados do tenant e do administrador.");
      return;
    }

    const id = crypto.randomUUID();

    const tenant = {
      id,
      name: tenantName,
      slug: tenantSlug,
      status: tenantStatus,
      created_at: new Date().toISOString(),
      admin_name: adminName,
      admin_email: adminEmail
    };

    allTenants.unshift(tenant);
    renderTenants();
    closeModal(modalCreateTenant);

    accessResultText.textContent = buildAccessMessage(tenant, adminEmail, adminName);
    openModal(modalAccessResult);
  }

  function handleTableClick(e) {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const tenant = allTenants.find(t => t.id === id);
    if (!tenant) return;

    if (action === "select") {
      setActiveTenant(tenant);
      renderTenants();
      alert(`Tenant ativo selecionado: ${tenant.name}`);
      return;
    }

if (action === "open-panel") {
  localStorage.setItem("portalwifi.activeTenantId", tenant.id || "");
  localStorage.setItem("portalwifi.activeTenantName", tenant.name || "");
  localStorage.setItem("portalwifi.activeTenantSlug", tenant.slug || "");

  renderTenants();
  window.location.href = `/estabelecimento/?tenant=${encodeURIComponent(tenant.slug || "")}`;
  return;
}

    if (action === "change-admin") {
      document.getElementById("changeAdminTenantId").value = tenant.id;
      document.getElementById("changeAdminTenantName").value = tenant.name;
      document.getElementById("newAdminName").value = "";
      document.getElementById("newAdminEmail").value = "";
      openModal(modalChangeAdmin);
      return;
    }

    if (action === "resend-access") {
      accessResultText.textContent = buildAccessMessage(tenant, tenant.admin_email, tenant.admin_name);
      openModal(modalAccessResult);
      return;
    }

    if (action === "disable") {
      document.getElementById("disableTenantId").value = tenant.id;
      document.getElementById("disableTenantName").textContent = tenant.name;
      document.getElementById("disableReason").value = "";
      openModal(modalDisableTenant);
      return;
    }

    if (action === "enable") {
      tenant.status = "active";
      renderTenants();
      return;
    }
  }

  function handleConfirmChangeAdmin() {
    const tenantId = document.getElementById("changeAdminTenantId").value;
    const newAdminName = document.getElementById("newAdminName").value.trim();
    const newAdminEmail = document.getElementById("newAdminEmail").value.trim();

    if (!tenantId || !newAdminName || !newAdminEmail) {
      alert("Informe o novo nome e e-mail do administrador.");
      return;
    }

    const tenant = allTenants.find(t => t.id === tenantId);
    if (!tenant) return;

    tenant.admin_name = newAdminName;
    tenant.admin_email = newAdminEmail;

    renderTenants();
    closeModal(modalChangeAdmin);
  }

  function handleConfirmDisableTenant() {
    const tenantId = document.getElementById("disableTenantId").value;
    const tenant = allTenants.find(t => t.id === tenantId);
    if (!tenant) return;

    tenant.status = "disabled";
    renderTenants();
    closeModal(modalDisableTenant);
  }

  navLinks.forEach(btn => {
    btn.addEventListener("click", () => setSection(btn.dataset.section));
  });

  [btnOpenCreateTenant, btnOpenCreateTenant2].forEach(btn => {
    btn?.addEventListener("click", () => openModal(modalCreateTenant));
  });

  btnReloadTenants?.addEventListener("click", renderTenants);
  btnRefreshPlatform?.addEventListener("click", renderTenants);

  tenantSearch?.addEventListener("input", renderTenants);
  tenantStatusFilter?.addEventListener("change", renderTenants);

  tenantsTableBody?.addEventListener("click", handleTableClick);

  document.getElementById("btnCreateTenantConfirm")?.addEventListener("click", handleCreateTenant);
  document.getElementById("btnChangeAdminConfirm")?.addEventListener("click", handleConfirmChangeAdmin);
  document.getElementById("btnDisableTenantConfirm")?.addEventListener("click", handleConfirmDisableTenant);

  btnCopyAccessMessage?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(accessResultText.textContent || "");
      alert("Mensagem copiada.");
    } catch {
      alert("Não foi possível copiar a mensagem.");
    }
  });

  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-close");
      closeModal(document.getElementById(id));
    });
  });

  setSection("overview");
  renderTenants();
})();
