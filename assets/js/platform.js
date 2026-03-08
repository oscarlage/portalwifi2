(function () {
  const SUPABASE_URL = window.PORTAL_SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.PORTAL_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !window.supabase) {
    console.warn("Supabase não configurado em window.PORTAL_SUPABASE_URL / window.PORTAL_SUPABASE_ANON_KEY");
    return;
  }

  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const navLinks = document.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll(".section");

  const modalCreateTenant = document.getElementById("modalCreateTenant");
  const modalCreateUser = document.getElementById("modalCreateUser");
  const modalEditUser = document.getElementById("modalEditUser");
  const modalManageMemberships = document.getElementById("modalManageMemberships");
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
  const userTenantFilter = document.getElementById("userTenantFilter");

  const btnOpenCreateTenant = document.getElementById("btnOpenCreateTenant");
  const btnOpenCreateTenant2 = document.getElementById("btnOpenCreateTenant2");
  const btnOpenCreateUser = document.getElementById("btnOpenCreateUser");
  const btnReloadTenants = document.getElementById("btnReloadTenants");
  const btnRefreshPlatform = document.getElementById("btnRefreshPlatform");
  const btnLogout = document.getElementById("btnLogout");

  const btnCreateTenantConfirm = document.getElementById("btnCreateTenantConfirm");
  const btnCreateUserConfirm = document.getElementById("btnCreateUserConfirm");
  const btnSaveUserEdit = document.getElementById("btnSaveUserEdit");
  const btnChangeAdminConfirm = document.getElementById("btnChangeAdminConfirm");
  const btnDisableTenantConfirm = document.getElementById("btnDisableTenantConfirm");
  const btnCopyAccessMessage = document.getElementById("btnCopyAccessMessage");
  const btnAddMembership = document.getElementById("btnAddMembership");

  const accessResultText = document.getElementById("accessResultText");

  const ACTIVE_TENANT_ID_KEY = "portalwifi.activeTenantId";
  const ACTIVE_TENANT_NAME_KEY = "portalwifi.activeTenantName";
  const ACTIVE_TENANT_SLUG_KEY = "portalwifi.activeTenantSlug";

  let allTenants = [];
  let allUsers = [];
  let membershipSnapshot = [];

  function openModal(el) {
    if (el) el.classList.remove("hidden");
  }

  function closeModal(el) {
    if (el) el.classList.add("hidden");
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDateBR(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
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

  function userStatusBadge(status) {
    const cls = status || "pending";
    const label =
      cls === "active" ? "Ativo" :
      cls === "blocked" ? "Bloqueado" :
      cls === "disabled" ? "Desabilitado" :
      "Pendente";

    return `<span class="badge ${cls}">${label}</span>`;
  }

  function activeBadge(isActive) {
    if (!isActive) return "";
    return `<div style="margin-top:6px;"><span class="badge active">Tenant ativo</span></div>`;
  }

  function userScopeLabel(scope) {
    if (scope === "global") return "Global";
    if (scope === "hybrid") return "Híbrido";
    return "Tenant";
  }

  function userRoleLabel(row) {
    if (row.platform_role) return row.platform_role;
    const memberships = Array.isArray(row.memberships) ? row.memberships : [];
    const roles = memberships.map(m => m.role).filter(Boolean);
    return roles.length ? [...new Set(roles)].join(", ") : "-";
  }

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

  function renderTenantMetrics(rows) {
    const total = rows.length;
    const active = rows.filter(r => r.status === "active").length;
    const disabled = rows.filter(r => r.status === "disabled").length;
    const admins = rows.filter(r => !!r.admin_email).length;

    const totalEl = document.getElementById("metricTotalTenants");
    const activeEl = document.getElementById("metricActiveTenants");
    const disabledEl = document.getElementById("metricDisabledTenants");
    const adminsEl = document.getElementById("metricAdmins");

    if (totalEl) totalEl.textContent = String(total);
    if (activeEl) activeEl.textContent = String(active);
    if (disabledEl) disabledEl.textContent = String(disabled);
    if (adminsEl) adminsEl.textContent = String(admins);
  }

  function renderUserMetrics(rows) {
    const total = rows.length;
    const globalUsers = rows.filter(r => r.scope === "global").length;
    const tenantUsers = rows.filter(r => (r.tenant_count || 0) > 0).length;
    const blocked = rows.filter(r => r.status === "blocked").length;

    const totalEl = document.getElementById("metricTotalUsers");
    const globalEl = document.getElementById("metricGlobalUsers");
    const tenantEl = document.getElementById("metricTenantUsers");
    const blockedEl = document.getElementById("metricBlockedUsers");

    if (totalEl) totalEl.textContent = String(total);
    if (globalEl) globalEl.textContent = String(globalUsers);
    if (tenantEl) tenantEl.textContent = String(tenantUsers);
    if (blockedEl) blockedEl.textContent = String(blocked);
  }

  async function loadTenants() {
    if (tenantsTableBody) {
      tenantsTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-row">Carregando tenants...</td>
        </tr>
      `;
    }

    const { data, error } = await supabaseClient
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar tenants:", error);
      if (tenantsTableBody) {
        tenantsTableBody.innerHTML = `
          <tr>
            <td colspan="7" class="empty-row">Erro ao carregar tenants.</td>
          </tr>
        `;
      }
      return;
    }

    allTenants = data || [];
    renderTenantMetrics(allTenants);
    renderTenants();
    populateUserTenantOptions();
    populateMembershipTenantOptions();
    populateUserTenantFilter();
  }

  async function loadUsers() {
    if (usersTableBody) {
      usersTableBody.innerHTML = `
        <tr>
          <td colspan="8" class="empty-row">Carregando usuários...</td>
        </tr>
      `;
    }

    const { data, error } = await supabaseClient
      .from("v_platform_users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar usuários:", error);
      if (usersTableBody) {
        usersTableBody.innerHTML = `
          <tr>
            <td colspan="8" class="empty-row">Erro ao carregar usuários.</td>
          </tr>
        `;
      }
      return;
    }

    allUsers = (data || []).map(row => ({
      ...row,
      memberships: Array.isArray(row.memberships) ? row.memberships : []
    }));

    renderUserMetrics(allUsers);
    renderUsers();
  }

  function filteredTenants() {
    const q = (tenantSearch?.value || "").trim().toLowerCase();
    const status = tenantStatusFilter?.value || "";

    return allTenants.filter(row => {
      const text = [
        row.name,
        row.slug,
        row.admin_name,
        row.admin_email
      ].join(" ").toLowerCase();

      const okSearch = !q || text.includes(q);
      const okStatus = !status || row.status === status;
      return okSearch && okStatus;
    });
  }

  function filteredUsers() {
    const q = (userSearch?.value || "").trim().toLowerCase();
    const status = userStatusFilter?.value || "";
    const type = userTypeFilter?.value || "";
    const tenantId = userTenantFilter?.value || "";

    return allUsers.filter(row => {
      const haystack = [
        row.full_name,
        row.email,
        row.tenant_names,
        row.platform_role
      ].join(" ").toLowerCase();

      const okSearch = !q || haystack.includes(q);
      const okStatus = !status || row.status === status;

      let okType = true;
      if (type === "global" || type === "tenant" || type === "hybrid") {
        okType = row.scope === type;
      } else if (type === "platform_admin") {
        okType = row.platform_role === "platform_admin";
      } else if (["tenant_admin", "tenant_viewer", "tenant_marketing"].includes(type)) {
        okType = row.memberships.some(m => m.role === type);
      }

      let okTenant = true;
      if (tenantId) {
        okTenant = row.memberships.some(m => String(m.tenant_id) === String(tenantId));
      }

      return okSearch && okStatus && okType && okTenant;
    });
  }

  function renderTenants() {
    if (!tenantsTableBody) return;

    const rows = filteredTenants();
    const activeTenantId = getActiveTenantId();

    if (!rows.length) {
      tenantsTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-row">Nenhum tenant encontrado.</td>
        </tr>
      `;
      return;
    }

    tenantsTableBody.innerHTML = rows.map(row => {
      const isActive = String(row.id) === String(activeTenantId);

      return `
        <tr>
          <td>
            <strong>${escapeHtml(row.name || "-")}</strong><br>
            <small class="muted">${escapeHtml(row.id || "-")}</small>
            ${activeBadge(isActive)}
          </td>
          <td>${escapeHtml(row.slug || "-")}</td>
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
          <strong>${escapeHtml(row.full_name || "-")}</strong>
          ${row.phone ? `<br><small class="muted">${escapeHtml(row.phone)}</small>` : ""}
        </td>
        <td>${escapeHtml(row.email || "-")}</td>
        <td>${escapeHtml(userScopeLabel(row.scope))}</td>
        <td>${escapeHtml(userRoleLabel(row))}</td>
        <td>${escapeHtml(row.tenant_names || "-")}</td>
        <td>${userStatusBadge(row.status)}</td>
        <td>${escapeHtml(formatDateBR(row.last_login_at))}</td>
        <td>
          <div class="actions">
            <button class="btn btn-light btn-sm" data-user-action="edit" data-user-id="${row.user_id}">
              Editar
            </button>

            <button class="btn btn-light btn-sm" data-user-action="memberships" data-user-id="${row.user_id}">
              Vínculos
            </button>

            <button class="btn btn-light btn-sm" data-user-action="resend-access" data-user-id="${row.user_id}">
              Reenviar acesso
            </button>

            ${
              row.status === "blocked"
                ? `<button class="btn btn-primary btn-sm" data-user-action="unblock" data-user-id="${row.user_id}">Desbloquear</button>`
                : `<button class="btn btn-light btn-sm" data-user-action="block" data-user-id="${row.user_id}">Bloquear</button>`
            }

            ${
              row.status === "disabled"
                ? `<button class="btn btn-primary btn-sm" data-user-action="enable" data-user-id="${row.user_id}">Habilitar</button>`
                : `<button class="btn btn-danger btn-sm" data-user-action="disable" data-user-id="${row.user_id}">Desabilitar</button>`
            }
          </div>
        </td>
      </tr>
    `).join("");
  }

  function populateUserTenantOptions() {
    const select = document.getElementById("userTenantId");
    if (!select) return;

    const current = select.value || "";

    select.innerHTML = `
      <option value="">Sem vínculo</option>
      ${allTenants.map(t => `
        <option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>
      `).join("")}
    `;

    if ([...select.options].some(opt => opt.value === current)) {
      select.value = current;
    }
  }

  function populateMembershipTenantOptions() {
    const select = document.getElementById("membershipTenantId");
    if (!select) return;

    const current = select.value || "";

    select.innerHTML = `
      <option value="">Selecione</option>
      ${allTenants.map(t => `
        <option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>
      `).join("")}
    `;

    if ([...select.options].some(opt => opt.value === current)) {
      select.value = current;
    }
  }

  function populateUserTenantFilter() {
    const select = document.getElementById("userTenantFilter");
    if (!select) return;

    const current = select.value || "";

    select.innerHTML = `
      <option value="">Todos os tenants</option>
      ${allTenants.map(t => `
        <option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>
      `).join("")}
    `;

    if ([...select.options].some(opt => opt.value === current)) {
      select.value = current;
    }
  }

  function buildTenantAccessMessage(tenant, adminEmail, adminName) {
    return [
      `Olá, ${adminName || "Administrador(a)"}.`,
      ``,
      `Seu acesso ao painel do tenant foi criado/atualizado com sucesso.`,
      ``,
      `Tenant: ${tenant.name || "-"}`,
      `Slug: ${tenant.slug || "-"}`,
      `Painel: https://portalwifi2.pages.dev/estabelecimento/?tenant=${tenant.slug || ""}`,
      `Usuário: ${adminEmail || "-"}`,
      `Senha provisória: [gerar/definir]`,
      ``,
      `Recomendamos alterar a senha no primeiro acesso.`,
      ``,
      `Equipe Portal WiFi`
    ].join("\n");
  }

  function buildUserAccessMessage(user) {
    return [
      `Olá, ${user.full_name || "Usuário(a)"}.`,
      ``,
      `Seu acesso à plataforma Portal WiFi foi criado/atualizado com sucesso.`,
      ``,
      `Escopo: ${userScopeLabel(user.scope)}`,
      `Papel global: ${user.platform_role || "-"}`,
      `Tenant(s): ${user.tenant_names || "-"}`,
      `Painel: https://portalwifi2.pages.dev/platform.html`,
      `Usuário: ${user.email || "-"}`,
      `Senha provisória: [gerar/definir]`,
      ``,
      `Recomendamos alterar a senha no primeiro acesso.`,
      ``,
      `Equipe Portal WiFi`
    ].join("\n");
  }

  function resetCreateUserForm() {
    ["userName", "userEmail", "userPhone"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    const userType = document.getElementById("userType");
    const userStatus = document.getElementById("userStatus");
    const userTenantId = document.getElementById("userTenantId");

    if (userType) userType.value = "tenant_admin";
    if (userStatus) userStatus.value = "active";
    if (userTenantId) userTenantId.value = "";
  }

  async function handleCreateTenant() {
    const name = document.getElementById("tenantName")?.value.trim();
    const slug = document.getElementById("tenantSlug")?.value.trim();
    const status = document.getElementById("tenantStatus")?.value;
    const admin_name = document.getElementById("adminName")?.value.trim();
    const admin_email = document.getElementById("adminEmail")?.value.trim().toLowerCase();

    if (!name || !slug || !status || !admin_name || !admin_email) {
      alert("Preencha os dados obrigatórios do tenant.");
      return;
    }

    const payload = {
      name,
      slug,
      status,
      admin_name,
      admin_email
    };

    const { error } = await supabaseClient
      .from("tenants")
      .insert(payload);

    if (error) {
      console.error(error);
      alert(`Erro ao criar tenant: ${error.message}`);
      return;
    }

    closeModal(modalCreateTenant);
    await loadTenants();

    const tenant = allTenants.find(t => t.slug === slug) || payload;
    accessResultText.textContent = buildTenantAccessMessage(tenant, admin_email, admin_name);
    openModal(modalAccessResult);
  }

  async function handleCreateUser() {
    const full_name = document.getElementById("userName")?.value.trim();
    const email = document.getElementById("userEmail")?.value.trim().toLowerCase();
    const phone = document.getElementById("userPhone")?.value.trim();
    const selectedType = document.getElementById("userType")?.value;
    const status = document.getElementById("userStatus")?.value;
    const tenantId = document.getElementById("userTenantId")?.value;

    if (!full_name || !email || !selectedType || !status) {
      alert("Preencha nome, e-mail, tipo e status.");
      return;
    }

    const isPlatform = selectedType === "platform_admin";
    const scope = isPlatform ? "global" : "tenant";
    const platform_role = isPlatform ? "platform_admin" : null;
    const generatedUserId = crypto.randomUUID();

    const { error: profileError } = await supabaseClient
      .from("profiles")
      .insert({
        user_id: generatedUserId,
        full_name,
        email,
        phone: phone || null,
        scope,
        platform_role,
        status,
        is_platform_user: isPlatform
      });

    if (profileError) {
      console.error(profileError);
      alert(`Erro ao criar usuário: ${profileError.message}`);
      return;
    }

    if (!isPlatform && tenantId) {
      const tenantRole =
        selectedType === "tenant_admin" ? "tenant_admin" :
        selectedType === "tenant_marketing" ? "tenant_marketing" :
        "tenant_viewer";

      const { error: memberError } = await supabaseClient
        .from("tenant_members")
        .insert({
          tenant_id: tenantId,
          user_id: generatedUserId,
          role: tenantRole,
          is_active: true
        });

      if (memberError) {
        console.error(memberError);
        alert(`Usuário criado, mas houve erro ao vincular ao tenant: ${memberError.message}`);
      }
    }

    resetCreateUserForm();
    closeModal(modalCreateUser);
    await loadUsers();

    const createdUser = allUsers.find(u => u.user_id === generatedUserId) || {
      full_name,
      email,
      scope,
      platform_role,
      tenant_names: "-"
    };

    accessResultText.textContent = buildUserAccessMessage(createdUser);
    openModal(modalAccessResult);
  }

  function fillEditUserForm(user) {
    document.getElementById("editUserId").value = user.user_id || "";
    document.getElementById("editUserName").value = user.full_name || "";
    document.getElementById("editUserEmail").value = user.email || "";
    document.getElementById("editUserPhone").value = user.phone || "";
    document.getElementById("editUserScope").value = user.scope || "tenant";
    document.getElementById("editUserPlatformRole").value = user.platform_role || "";
    document.getElementById("editUserStatus").value = user.status || "pending";
    document.getElementById("editIsPlatformUser").checked = !!user.is_platform_user;
  }

  async function handleSaveUserEdit() {
    const user_id = document.getElementById("editUserId")?.value;
    const full_name = document.getElementById("editUserName")?.value.trim();
    const email = document.getElementById("editUserEmail")?.value.trim().toLowerCase();
    const phone = document.getElementById("editUserPhone")?.value.trim();
    const scope = document.getElementById("editUserScope")?.value;
    const platform_role = document.getElementById("editUserPlatformRole")?.value || null;
    const status = document.getElementById("editUserStatus")?.value;
    const is_platform_user = !!document.getElementById("editIsPlatformUser")?.checked;

    if (!user_id || !full_name || !email || !scope || !status) {
      alert("Preencha os campos obrigatórios.");
      return;
    }

    const { error } = await supabaseClient
      .from("profiles")
      .update({
        full_name,
        email,
        phone: phone || null,
        scope,
        platform_role,
        status,
        is_platform_user
      })
      .eq("user_id", user_id);

    if (error) {
      console.error(error);
      alert(`Erro ao salvar usuário: ${error.message}`);
      return;
    }

    closeModal(modalEditUser);
    await loadUsers();
    alert("Usuário atualizado com sucesso.");
  }

  async function updateUserStatus(userId, status) {
    const { error } = await supabaseClient
      .from("profiles")
      .update({ status })
      .eq("user_id", userId);

    if (error) {
      console.error(error);
      alert(`Erro ao atualizar status: ${error.message}`);
      return;
    }

    await loadUsers();
  }

  async function updateTenantStatus(tenantId, status) {
    const { error } = await supabaseClient
      .from("tenants")
      .update({ status })
      .eq("id", tenantId);

    if (error) {
      console.error(error);
      alert(`Erro ao atualizar tenant: ${error.message}`);
      return;
    }

    await loadTenants();
  }

  async function handleConfirmChangeAdmin() {
    const tenantId = document.getElementById("changeAdminTenantId")?.value;
    const admin_name = document.getElementById("newAdminName")?.value.trim();
    const admin_email = document.getElementById("newAdminEmail")?.value.trim().toLowerCase();

    if (!tenantId || !admin_name || !admin_email) {
      alert("Informe nome e e-mail do novo admin.");
      return;
    }

    const { error } = await supabaseClient
      .from("tenants")
      .update({ admin_name, admin_email })
      .eq("id", tenantId);

    if (error) {
      console.error(error);
      alert(`Erro ao atualizar administrador: ${error.message}`);
      return;
    }

    closeModal(modalChangeAdmin);
    await loadTenants();
  }

  async function handleConfirmDisableTenant() {
    const tenantId = document.getElementById("disableTenantId")?.value;
    if (!tenantId) return;

    await updateTenantStatus(tenantId, "disabled");
    closeModal(modalDisableTenant);
  }

  async function openMembershipModal(user) {
    document.getElementById("membershipUserId").value = user.user_id || "";
    document.getElementById("membershipUserSummary").textContent =
      `${user.full_name || "-"} • ${user.email || "-"} • ${user.tenant_names || "Sem vínculos"}`;

    const { data, error } = await supabaseClient
      .from("tenant_members")
      .select("tenant_id, user_id, role, is_active, created_at")
      .eq("user_id", user.user_id);

    if (error) {
      console.error(error);
      alert(`Erro ao carregar vínculos: ${error.message}`);
      return;
    }

    membershipSnapshot = data || [];
    renderMembershipList();
    populateMembershipTenantOptions();
    openModal(modalManageMemberships);
  }

  function renderMembershipList() {
    const wrap = document.getElementById("membershipList");
    if (!wrap) return;

    if (!membershipSnapshot.length) {
      wrap.innerHTML = `<p class="muted">Nenhum vínculo encontrado.</p>`;
      return;
    }

    wrap.innerHTML = membershipSnapshot.map(item => {
      const tenant = allTenants.find(t => String(t.id) === String(item.tenant_id));
      const tenantName = tenant?.name || item.tenant_id;

      return `
        <div class="panel-card" style="margin-bottom:10px; padding:12px;">
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
            <div>
              <strong>${escapeHtml(tenantName)}</strong><br>
              <small class="muted">Role: ${escapeHtml(item.role || "-")} • ${item.is_active ? "Ativo" : "Inativo"}</small>
            </div>

            <div class="actions">
              <button class="btn btn-light btn-sm" data-membership-action="toggle" data-tenant-id="${item.tenant_id}">
                ${item.is_active ? "Inativar" : "Ativar"}
              </button>
              <button class="btn btn-danger btn-sm" data-membership-action="remove" data-tenant-id="${item.tenant_id}">
                Remover
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  async function addMembership() {
    const userId = document.getElementById("membershipUserId")?.value;
    const tenantId = document.getElementById("membershipTenantId")?.value;
    const role = document.getElementById("membershipRole")?.value;

    if (!userId || !tenantId || !role) {
      alert("Selecione tenant e papel.");
      return;
    }

    const existing = membershipSnapshot.find(m => String(m.tenant_id) === String(tenantId));

    if (existing) {
      const { error } = await supabaseClient
        .from("tenant_members")
        .update({ role, is_active: true })
        .eq("user_id", userId)
        .eq("tenant_id", tenantId);

      if (error) {
        console.error(error);
        alert(`Erro ao atualizar vínculo: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabaseClient
        .from("tenant_members")
        .insert({
          user_id: userId,
          tenant_id: tenantId,
          role,
          is_active: true
        });

      if (error) {
        console.error(error);
        alert(`Erro ao criar vínculo: ${error.message}`);
        return;
      }
    }

    const user = allUsers.find(u => String(u.user_id) === String(userId));
    if (user) {
      await openMembershipModal(user);
    }
    await loadUsers();
  }

  async function handleMembershipListClick(e) {
    const btn = e.target.closest("[data-membership-action]");
    if (!btn) return;

    const action = btn.dataset.membershipAction;
    const tenantId = btn.dataset.tenantId;
    const userId = document.getElementById("membershipUserId")?.value;

    if (!userId || !tenantId) return;

    const current = membershipSnapshot.find(m => String(m.tenant_id) === String(tenantId));
    if (!current) return;

    if (action === "toggle") {
      const { error } = await supabaseClient
        .from("tenant_members")
        .update({ is_active: !current.is_active })
        .eq("user_id", userId)
        .eq("tenant_id", tenantId);

      if (error) {
        console.error(error);
        alert(`Erro ao atualizar vínculo: ${error.message}`);
        return;
      }
    }

    if (action === "remove") {
      const { error } = await supabaseClient
        .from("tenant_members")
        .delete()
        .eq("user_id", userId)
        .eq("tenant_id", tenantId);

      if (error) {
        console.error(error);
        alert(`Erro ao remover vínculo: ${error.message}`);
        return;
      }
    }

    const user = allUsers.find(u => String(u.user_id) === String(userId));
    if (user) {
      await openMembershipModal(user);
    }
    await loadUsers();
  }

  async function handleTenantTableClick(e) {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const tenant = allTenants.find(t => String(t.id) === String(id));
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
      document.getElementById("changeAdminTenantId").value = tenant.id || "";
      document.getElementById("changeAdminTenantName").value = tenant.name || "";
      document.getElementById("newAdminName").value = tenant.admin_name || "";
      document.getElementById("newAdminEmail").value = tenant.admin_email || "";
      openModal(modalChangeAdmin);
      return;
    }

    if (action === "resend-access") {
      accessResultText.textContent = buildTenantAccessMessage(tenant, tenant.admin_email, tenant.admin_name);
      openModal(modalAccessResult);
      return;
    }

    if (action === "disable") {
      document.getElementById("disableTenantId").value = tenant.id || "";
      document.getElementById("disableTenantName").textContent = tenant.name || "-";
      document.getElementById("disableReason").value = "";
      openModal(modalDisableTenant);
      return;
    }

    if (action === "enable") {
      await updateTenantStatus(tenant.id, "active");
    }
  }

  async function handleUsersTableClick(e) {
    const btn = e.target.closest("[data-user-action]");
    if (!btn) return;

    const action = btn.dataset.userAction;
    const userId = btn.dataset.userId;
    const user = allUsers.find(u => String(u.user_id) === String(userId));
    if (!user) return;

    if (action === "edit") {
      fillEditUserForm(user);
      openModal(modalEditUser);
      return;
    }

    if (action === "memberships") {
      await openMembershipModal(user);
      return;
    }

    if (action === "resend-access") {
      accessResultText.textContent = buildUserAccessMessage(user);
      openModal(modalAccessResult);
      return;
    }

    if (action === "block") {
      await updateUserStatus(userId, "blocked");
      return;
    }

    if (action === "unblock") {
      await updateUserStatus(userId, "active");
      return;
    }

    if (action === "disable") {
      await updateUserStatus(userId, "disabled");
      return;
    }

    if (action === "enable") {
      await updateUserStatus(userId, "active");
    }
  }

  function bindEvents() {
    navLinks.forEach(btn => {
      btn.addEventListener("click", () => setSection(btn.dataset.section));
    });

    [btnOpenCreateTenant, btnOpenCreateTenant2].forEach(btn => {
      btn?.addEventListener("click", () => openModal(modalCreateTenant));
    });

    btnOpenCreateUser?.addEventListener("click", () => {
      resetCreateUserForm();
      populateUserTenantOptions();
      openModal(modalCreateUser);
    });

    btnReloadTenants?.addEventListener("click", loadTenants);

    btnRefreshPlatform?.addEventListener("click", async () => {
      await loadTenants();
      await loadUsers();
    });

    btnLogout?.addEventListener("click", () => {
      alert("Fluxo de logout ainda será integrado.");
    });

    tenantSearch?.addEventListener("input", renderTenants);
    tenantStatusFilter?.addEventListener("change", renderTenants);

    userSearch?.addEventListener("input", renderUsers);
    userStatusFilter?.addEventListener("change", renderUsers);
    userTypeFilter?.addEventListener("change", renderUsers);
    userTenantFilter?.addEventListener("change", renderUsers);

    tenantsTableBody?.addEventListener("click", handleTenantTableClick);
    usersTableBody?.addEventListener("click", handleUsersTableClick);

    btnCreateTenantConfirm?.addEventListener("click", handleCreateTenant);
    btnCreateUserConfirm?.addEventListener("click", handleCreateUser);
    btnSaveUserEdit?.addEventListener("click", handleSaveUserEdit);
    btnChangeAdminConfirm?.addEventListener("click", handleConfirmChangeAdmin);
    btnDisableTenantConfirm?.addEventListener("click", handleConfirmDisableTenant);
    btnAddMembership?.addEventListener("click", addMembership);

    document.getElementById("membershipList")?.addEventListener("click", handleMembershipListClick);

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
  }

  async function init() {
    bindEvents();
    setSection("overview");
    await loadTenants();
    await loadUsers();
  }

  init();
})();
