(function () {
  const navLinks = document.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll(".section");

  const modalCreateTenant = document.getElementById("modalCreateTenant");
  const modalCreateUser = document.getElementById("modalCreateUser");
  const modalChangeAdmin = document.getElementById("modalChangeAdmin");
  const modalDisableTenant = document.getElementById("modalDisableTenant");
  const modalAccessResult = document.getElementById("modalAccessResult");

  const tenantsTableBody = document.getElementById("tenantsTableBody");
  const tenantSearch = document.getElementById("tenantSearch");
  const tenantStatusFilter = document.getElementById("tenantStatusFilter");

  const usersTableBody = document.getElementById("usersTableBody");
  const userSearch = document.getElementById("userSearch");
  const userStatusFilter = document.getElementById("userStatusFilter");
  const userTypeFilter = document.getElementById("userTypeFilter");

  const btnOpenCreateTenant = document.getElementById("btnOpenCreateTenant");
  const btnOpenCreateTenant2 = document.getElementById("btnOpenCreateTenant2");
  const btnOpenCreateUser = document.getElementById("btnOpenCreateUser");
  const btnReloadTenants = document.getElementById("btnReloadTenants");
  const btnRefreshPlatform = document.getElementById("btnRefreshPlatform");
  const btnLogout = document.getElementById("btnLogout");

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

  let allUsers = [
    {
      id: "u-001",
      name: "Oscar Lage",
      email: "oscar@teste.com",
      phone: "",
      type: "tenant_admin",
      status: "active",
      tenant_id: "8814c725-ff72-41f2-be86-e9671bcc6c7b",
      tenant_name: "Sítio Coisa Nossa",
      last_login_at: "2026-03-07T13:20:00Z",
      created_at: "2026-03-06T10:10:00Z"
    }
  ];

  function getActiveTenantId() {
    return localStorage.getItem(ACTIVE_TENANT_ID_KEY) || "";
  }

  function setActiveTenant(tenant) {
    localStorage.setItem(ACTIVE_TENANT_ID_KEY, tenant.id || "");
    localStorage.setItem(ACTIVE_TENANT_NAME_KEY, tenant.name || "");
    localStorage.setItem(ACTIVE_TENANT_SLUG_KEY, tenant.slug || "");
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

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function statusBadge(status) {
    const cls = status || "pending";
    const label =
      cls === "active" ? "Ativo" :
      cls === "disabled" ? "Desabilitado" :
      "Pendente";

    return `<span class="badge ${cls}">${label}</span>`;
  }

  function userStatusBadge(status) {
    const cls = status || "pending";
    const label =
      cls === "active" ? "Ativo" :
      cls === "blocked" ? "Bloqueado" :
      cls === "disabled" ? "Desabilitado" :
      "Pendente";

    return `<span class="badge ${cls}">${label}</span>`;
  }

  function userTypeLabel(type) {
    return (
      type === "platform_admin" ? "Platform admin" :
      type === "tenant_admin" ? "Tenant admin" :
      type === "tenant_manager" ? "Tenant manager" :
      type === "tenant_viewer" ? "Tenant viewer" :
      type || "-"
    );
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

  function filteredUsers() {
    const q = (userSearch?.value || "").trim().toLowerCase();
    const status = userStatusFilter?.value || "";
    const type = userTypeFilter?.value || "";

    return allUsers.filter(row => {
      const text = `${row.name} ${row.email} ${row.tenant_name || ""}`.toLowerCase();
      const okSearch = !q || text.includes(q);
      const okStatus = !status || row.status === status;
      const okType = !type || row.type === type;
      return okSearch && okStatus && okType;
    });
  }

  function populateUserTenantOptions() {
    const select = document.getElementById("userTenantId");
    if (!select) return;

    const currentValue = select.value || "";

    select.innerHTML = `
      <option value="">Sem vínculo</option>
      ${allTenants.map(t => `
        <option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>
      `).join("")}
    `;

    select.value = currentValue;
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

  function renderUsers() {
    if (!usersTableBody) return;

    const rows = filteredUsers();

    if (!rows.length) {
      usersTableBody.innerHTML = `
        <tr>
          <td colspan="8" class="empty-row">Nenhum usuário encontrado.</td>
        </tr>
      `;
      return;
    }

    usersTableBody.innerHTML = rows.map(row => `
      <tr>
        <td>
          <strong>${escapeHtml(row.name)}</strong>
          ${row.phone ? `<br><small class="muted">${escapeHtml(row.phone)}</small>` : ""}
        </td>
        <td>${escapeHtml(row.email || "-")}</td>
        <td>${escapeHtml(userTypeLabel(row.type))}</td>
        <td>${escapeHtml(row.tenant_name || "-")}</td>
        <td>${userStatusBadge(row.status)}</td>
        <td>${escapeHtml(formatDateBR(row.last_login_at) || "-")}</td>
        <td>${escapeHtml(formatDateBR(row.created_at) || "-")}</td>
        <td>
          <div class="actions">
            <button class="btn btn-light btn-sm" data-user-action="resend-access" data-user-id="${row.id}">
              Reenviar acesso
            </button>

            <button class="btn btn-light btn-sm" data-user-action="reset-password" data-user-id="${row.id}">
              Resetar senha
            </button>

            ${
              row.status === "blocked"
                ? `<button class="btn btn-primary btn-sm" data-user-action="unblock" data-user-id="${row.id}">Desbloquear</button>`
                : `<button class="btn btn-light btn-sm" data-user-action="block" data-user-id="${row.id}">Bloquear</button>`
            }

            ${
              row.status === "disabled"
                ? `<button class="btn btn-primary btn-sm" data-user-action="enable" data-user-id="${row.id}">Habilitar</button>`
                : `<button class="btn btn-danger btn-sm" data-user-action="disable" data-user-id="${row.id}">Desabilitar</button>`
            }
          </div>
        </td>
      </tr>
    `).join("");
  }

  function buildAccessMessage(tenant, adminEmail, adminName) {
    return [
      `Olá, ${adminName || "Administrador(a)"}.`,
      ``,
      `Seu acesso ao painel do tenant foi criado com sucesso.`,
      ``,
      `Tenant: ${tenant.name}`,
      `Slug: ${tenant.slug}`,
      `Painel: https://portalwifi2.pages.dev/estabelecimento/?tenant=${tenant.slug}`,
      `Usuário: ${adminEmail}`,
      `Senha provisória: [gerar/definir]`,
      ``,
      `Recomendamos alterar a senha no primeiro acesso.`,
      ``,
      `Equipe Portal WiFi`
    ].join("\n");
  }

  function buildUserAccessMessage(user) {
    return [
      `Olá, ${user.name || "Usuário(a)"}.`,
      ``,
      `Seu acesso à plataforma Portal WiFi foi criado/atualizado com sucesso.`,
      ``,
      `Perfil: ${userTypeLabel(user.type)}`,
      `Tenant: ${user.tenant_name || "Sem vínculo"}`,
      `Painel: https://portalwifi2.pages.dev/platform.html`,
      `Usuário: ${user.email}`,
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
    populateUserTenantOptions();
    closeModal(modalCreateTenant);

    accessResultText.textContent = buildAccessMessage(tenant, adminEmail, adminName);
    openModal(modalAccessResult);
  }

  function handleCreateUser() {
    const userName = document.getElementById("userName")?.value.trim();
    const userEmail = document.getElementById("userEmail")?.value.trim();
    const userPhone = document.getElementById("userPhone")?.value.trim();
    const userType = document.getElementById("userType")?.value;
    const userStatus = document.getElementById("userStatus")?.value;
    const userTenantId = document.getElementById("userTenantId")?.value;

    if (!userName || !userEmail || !userType || !userStatus) {
      alert("Preencha nome, e-mail, tipo e status do usuário.");
      return;
    }

    const tenant = allTenants.find(t => t.id === userTenantId);

    const user = {
      id: crypto.randomUUID(),
      name: userName,
      email: userEmail,
      phone: userPhone || "",
      type: userType,
      status: userStatus,
      tenant_id: tenant?.id || "",
      tenant_name: tenant?.name || "",
      last_login_at: "",
      created_at: new Date().toISOString()
    };

    allUsers.unshift(user);
    renderUsers();
    closeModal(modalCreateUser);

    accessResultText.textContent = buildUserAccessMessage(user);
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
      setActiveTenant(tenant);
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

  function handleUsersTableClick(e) {
    const btn = e.target.closest("[data-user-action]");
    if (!btn) return;

    const action = btn.dataset.userAction;
    const id = btn.dataset.userId;
    const user = allUsers.find(u => u.id === id);
    if (!user) return;

    if (action === "resend-access") {
      accessResultText.textContent = buildUserAccessMessage(user);
      openModal(modalAccessResult);
      return;
    }

    if (action === "reset-password") {
      accessResultText.textContent = [
        `Reset de senha solicitado para ${user.name}.`,
        ``,
        `Usuário: ${user.email}`,
        `Nova senha provisória: [gerar/definir]`
      ].join("\n");
      openModal(modalAccessResult);
      return;
    }

    if (action === "block") {
      user.status = "blocked";
      renderUsers();
      return;
    }

    if (action === "unblock") {
      user.status = "active";
      renderUsers();
      return;
    }

    if (action === "disable") {
      user.status = "disabled";
      renderUsers();
      return;
    }

    if (action === "enable") {
      user.status = "active";
      renderUsers();
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

  btnOpenCreateUser?.addEventListener("click", () => {
    populateUserTenantOptions();
    openModal(modalCreateUser);
  });

  btnReloadTenants?.addEventListener("click", renderTenants);

  btnRefreshPlatform?.addEventListener("click", () => {
    renderTenants();
    renderUsers();
  });

  btnLogout?.addEventListener("click", () => {
    alert("Fluxo de logout ainda será integrado.");
  });

  tenantSearch?.addEventListener("input", renderTenants);
  tenantStatusFilter?.addEventListener("change", renderTenants);

  userSearch?.addEventListener("input", renderUsers);
  userStatusFilter?.addEventListener("change", renderUsers);
  userTypeFilter?.addEventListener("change", renderUsers);

  tenantsTableBody?.addEventListener("click", handleTableClick);
  usersTableBody?.addEventListener("click", handleUsersTableClick);

  document.getElementById("btnCreateTenantConfirm")?.addEventListener("click", handleCreateTenant);
  document.getElementById("btnCreateUserConfirm")?.addEventListener("click", handleCreateUser);
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
  populateUserTenantOptions();
  renderUsers();
})();
