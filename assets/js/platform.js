(function () {
  "use strict";

  const SUPABASE_URL = window.PORTAL_SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.PORTAL_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !window.supabase) {
    console.error("Supabase não configurado.");
    return;
  }

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const state = {
    tenants: [],
    users: []
  };

  const els = {
    navLinks: document.querySelectorAll(".nav-link"),
    sections: document.querySelectorAll(".section"),

    btnRefreshPlatform: document.getElementById("btnRefreshPlatform"),
    btnReloadTenants: document.getElementById("btnReloadTenants"),
    btnLogout: document.getElementById("btnLogout"),

    btnOpenCreateTenant: document.getElementById("btnOpenCreateTenant"),
    btnOpenCreateTenant2: document.getElementById("btnOpenCreateTenant2"),
    btnCreateTenantConfirm: document.getElementById("btnCreateTenantConfirm"),

    btnOpenCreateUser: document.getElementById("btnOpenCreateUser"),
    btnCreateUserConfirm: document.getElementById("btnCreateUserConfirm"),
    btnGeneratePassword: document.getElementById("btnGeneratePassword"),

    modalCreateTenant: document.getElementById("modalCreateTenant"),
    modalCreateUser: document.getElementById("modalCreateUser"),

    tenantName: document.getElementById("tenantName"),
    tenantSlug: document.getElementById("tenantSlug"),
    tenantStatus: document.getElementById("tenantStatus"),
    tenantAdminName: document.getElementById("tenantAdminName"),
    tenantAdminEmail: document.getElementById("tenantAdminEmail"),

    userName: document.getElementById("userName"),
    userEmail: document.getElementById("userEmail"),
    userPhone: document.getElementById("userPhone"),
    userType: document.getElementById("userType"),
    userStatus: document.getElementById("userStatus"),
    userTenantId: document.getElementById("userTenantId"),
    userPassword: document.getElementById("userPassword"),
    userPasswordConfirm: document.getElementById("userPasswordConfirm"),

    tenantSearch: document.getElementById("tenantSearch"),
    tenantStatusFilter: document.getElementById("tenantStatusFilter"),
    userSearch: document.getElementById("userSearch"),
    userStatusFilter: document.getElementById("userStatusFilter"),
    userTypeFilter: document.getElementById("userTypeFilter"),
    userTenantFilter: document.getElementById("userTenantFilter"),

    tenantsTableBody: document.getElementById("tenantsTableBody"),
    usersTableBody: document.getElementById("usersTableBody"),

    metricTotalTenants: document.getElementById("metricTotalTenants"),
    metricActiveTenants: document.getElementById("metricActiveTenants"),
    metricDisabledTenants: document.getElementById("metricDisabledTenants"),
    metricAdmins: document.getElementById("metricAdmins"),
    metricTotalUsers: document.getElementById("metricTotalUsers"),
    metricGlobalUsers: document.getElementById("metricGlobalUsers"),
    metricTenantUsers: document.getElementById("metricTenantUsers"),
    metricBlockedUsers: document.getElementById("metricBlockedUsers")
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("pt-BR");
  }

  function formatDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR");
  }

  function statusBadge(status) {
    const safe = String(status || "").toLowerCase();
    const labelMap = {
      active: "Ativo",
      pending: "Pendente",
      disabled: "Desabilitado",
      blocked: "Bloqueado"
    };
    const label = labelMap[safe] || safe || "—";
    return `<span class="badge ${escapeHtml(safe)}">${escapeHtml(label)}</span>`;
  }

  function makeSlug(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function generatePassword(length = 10) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#*!";
    let out = "";
    for (let i = 0; i < length; i += 1) {
      out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
  }

  function openModal(modal) {
    if (!modal) return;
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.add("hidden");
    if (![...document.querySelectorAll(".modal-backdrop")].some(el => !el.classList.contains("hidden"))) {
      document.body.style.overflow = "";
    }
  }

  function closeAllModals() {
    document.querySelectorAll(".modal-backdrop").forEach((modal) => {
      modal.classList.add("hidden");
    });
    document.body.style.overflow = "";
  }

  function setActiveSection(sectionName) {
    els.navLinks.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.section === sectionName);
    });

    els.sections.forEach((section) => {
      section.classList.toggle("active", section.id === `section-${sectionName}`);
    });
  }

  function resetTenantModal() {
    if (els.tenantName) els.tenantName.value = "";
    if (els.tenantSlug) {
      els.tenantSlug.value = "";
      delete els.tenantSlug.dataset.editedManually;
    }
    if (els.tenantStatus) els.tenantStatus.value = "active";
    if (els.tenantAdminName) els.tenantAdminName.value = "";
    if (els.tenantAdminEmail) els.tenantAdminEmail.value = "";
  }

  function resetUserModal() {
    if (els.userName) els.userName.value = "";
    if (els.userEmail) els.userEmail.value = "";
    if (els.userPhone) els.userPhone.value = "";
    if (els.userType) els.userType.value = "tenant_admin";
    if (els.userStatus) els.userStatus.value = "active";
    if (els.userTenantId) els.userTenantId.value = "";
    const pwd = generatePassword();
    if (els.userPassword) els.userPassword.value = pwd;
    if (els.userPasswordConfirm) els.userPasswordConfirm.value = pwd;
  }

  function renderTenantFilters() {
    if (!els.userTenantFilter || !els.userTenantId) return;

    const currentFilter = els.userTenantFilter.value;
    const currentCreate = els.userTenantId.value;

    const options = [`<option value="">Todos tenants</option>`]
      .concat(
        state.tenants.map((tenant) => (
          `<option value="${escapeHtml(tenant.id)}">${escapeHtml(tenant.name || tenant.slug || tenant.id)}</option>`
        ))
      )
      .join("");

    els.userTenantFilter.innerHTML = options;

    const createOptions = [`<option value="">Sem vínculo</option>`]
      .concat(
        state.tenants.map((tenant) => (
          `<option value="${escapeHtml(tenant.id)}">${escapeHtml(tenant.name || tenant.slug || tenant.id)}</option>`
        ))
      )
      .join("");

    els.userTenantId.innerHTML = createOptions;

    if ([...els.userTenantFilter.options].some(o => o.value === currentFilter)) {
      els.userTenantFilter.value = currentFilter;
    }

    if ([...els.userTenantId.options].some(o => o.value === currentCreate)) {
      els.userTenantId.value = currentCreate;
    }
  }

  function getFilteredTenants() {
    const search = (els.tenantSearch?.value || "").trim().toLowerCase();
    const status = (els.tenantStatusFilter?.value || "").trim().toLowerCase();

    return state.tenants.filter((tenant) => {
      const haystack = [
        tenant.name,
        tenant.slug,
        tenant.admin_name,
        tenant.admin_email
      ].join(" ").toLowerCase();

      const okSearch = !search || haystack.includes(search);
      const okStatus = !status || String(tenant.status || "").toLowerCase() === status;

      return okSearch && okStatus;
    });
  }

  function getFilteredUsers() {
    const search = (els.userSearch?.value || "").trim().toLowerCase();
    const status = (els.userStatusFilter?.value || "").trim().toLowerCase();
    const type = (els.userTypeFilter?.value || "").trim().toLowerCase();
    const tenantId = (els.userTenantFilter?.value || "").trim();

    return state.users.filter((user) => {
      const haystack = [
        user.full_name,
        user.email,
        user.phone,
        user.scope,
        user.platform_role,
        user.user_type,
        user.tenant_name
      ].join(" ").toLowerCase();

      const userType = String(user.user_type || user.platform_role || "").toLowerCase();
      const userStatus = String(user.status || "").toLowerCase();

      const okSearch = !search || haystack.includes(search);
      const okStatus = !status || userStatus === status;
      const okType = !type || userType === type || String(user.platform_role || "").toLowerCase() === type;
      const okTenant = !tenantId || String(user.tenant_id || "") === tenantId;

      return okSearch && okStatus && okType && okTenant;
    });
  }

  function renderTenantsTable() {
    if (!els.tenantsTableBody) return;

    const rows = getFilteredTenants();

    if (!rows.length) {
      els.tenantsTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-row">Nenhum tenant encontrado.</td>
        </tr>
      `;
      return;
    }

    els.tenantsTableBody.innerHTML = rows.map((tenant) => `
      <tr>
        <td>${escapeHtml(tenant.name || "—")}</td>
        <td>${escapeHtml(tenant.slug || "—")}</td>
        <td>${statusBadge(tenant.status)}</td>
        <td>${escapeHtml(tenant.admin_name || "—")}</td>
        <td>${escapeHtml(tenant.admin_email || "—")}</td>
        <td>${formatDate(tenant.created_at)}</td>
        <td>
          <div class="actions">
            <button class="btn btn-light btn-sm" type="button" data-tenant-action="edit" data-id="${escapeHtml(tenant.id)}">Editar</button>
            <button class="btn btn-light btn-sm" type="button" data-tenant-action="users" data-id="${escapeHtml(tenant.id)}">Usuários</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  function renderUsersTable() {
    if (!els.usersTableBody) return;

    const rows = getFilteredUsers();

    if (!rows.length) {
      els.usersTableBody.innerHTML = `
        <tr>
          <td colspan="8" class="empty-row">Nenhum usuário encontrado.</td>
        </tr>
      `;
      return;
    }

    els.usersTableBody.innerHTML = rows.map((user) => {
      const type = user.user_type || user.platform_role || "—";
      const scope = user.scope || (user.tenant_id ? "tenant" : "global");
      const tenantsLabel = user.tenant_name || (user.tenant_id ? user.tenant_id : "—");

      return `
        <tr>
          <td>${escapeHtml(user.full_name || "—")}</td>
          <td>${escapeHtml(user.email || "—")}</td>
          <td>${escapeHtml(scope)}</td>
          <td>${escapeHtml(type)}</td>
          <td>${escapeHtml(tenantsLabel)}</td>
          <td>${statusBadge(user.status)}</td>
          <td>${formatDateTime(user.last_login_at)}</td>
          <td>
            <div class="actions">
              <button class="btn btn-light btn-sm" type="button" data-user-action="edit" data-id="${escapeHtml(user.id || user.user_id || "")}">Editar</button>
              <button class="btn btn-light btn-sm" type="button" data-user-action="link" data-id="${escapeHtml(user.id || user.user_id || "")}">Vínculos</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  function renderMetrics() {
    const totalTenants = state.tenants.length;
    const activeTenants = state.tenants.filter(t => String(t.status || "").toLowerCase() === "active").length;
    const disabledTenants = state.tenants.filter(t => String(t.status || "").toLowerCase() === "disabled").length;
    const admins = state.tenants.filter(t => t.admin_email || t.admin_name).length;

    const totalUsers = state.users.length;
    const globalUsers = state.users.filter(u => !u.tenant_id).length;
    const tenantUsers = state.users.filter(u => !!u.tenant_id).length;
    const blockedUsers = state.users.filter(u => String(u.status || "").toLowerCase() === "blocked").length;

    if (els.metricTotalTenants) els.metricTotalTenants.textContent = String(totalTenants);
    if (els.metricActiveTenants) els.metricActiveTenants.textContent = String(activeTenants);
    if (els.metricDisabledTenants) els.metricDisabledTenants.textContent = String(disabledTenants);
    if (els.metricAdmins) els.metricAdmins.textContent = String(admins);

    if (els.metricTotalUsers) els.metricTotalUsers.textContent = String(totalUsers);
    if (els.metricGlobalUsers) els.metricGlobalUsers.textContent = String(globalUsers);
    if (els.metricTenantUsers) els.metricTenantUsers.textContent = String(tenantUsers);
    if (els.metricBlockedUsers) els.metricBlockedUsers.textContent = String(blockedUsers);
  }

  async function loadTenants() {
    if (!els.tenantsTableBody) return;

    els.tenantsTableBody.innerHTML = `
      <tr><td colspan="7" class="empty-row">Carregando...</td></tr>
    `;

    const { data, error } = await sb
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar tenants:", error);
      els.tenantsTableBody.innerHTML = `
        <tr><td colspan="7" class="empty-row">Erro ao carregar tenants.</td></tr>
      `;
      state.tenants = [];
      renderMetrics();
      renderTenantFilters();
      return;
    }

    state.tenants = Array.isArray(data) ? data : [];
    renderTenantsTable();
    renderTenantFilters();
    renderMetrics();
  }

  async function loadUsers() {
    if (!els.usersTableBody) return;

    els.usersTableBody.innerHTML = `
      <tr><td colspan="8" class="empty-row">Carregando usuários...</td></tr>
    `;

    let usersData = [];
    let usersError = null;

    const attemptProfiles = await sb
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (!attemptProfiles.error) {
      usersData = attemptProfiles.data || [];
    } else {
      usersError = attemptProfiles.error;

      const attemptUsers = await sb
        .from("platform_users")
        .select("*")
        .order("created_at", { ascending: false });

      if (!attemptUsers.error) {
        usersData = attemptUsers.data || [];
        usersError = null;
      } else {
        usersError = attemptUsers.error;
      }
    }

    if (usersError) {
      console.error("Erro ao carregar usuários:", usersError);
      els.usersTableBody.innerHTML = `
        <tr><td colspan="8" class="empty-row">Erro ao carregar usuários.</td></tr>
      `;
      state.users = [];
      renderMetrics();
      return;
    }

    const tenantMap = new Map(state.tenants.map(t => [String(t.id), t.name || t.slug || t.id]));

    state.users = usersData.map((user) => ({
      ...user,
      id: user.id || user.user_id,
      tenant_name: user.tenant_name || tenantMap.get(String(user.tenant_id || "")) || ""
    }));

    renderUsersTable();
    renderMetrics();
  }

  async function refreshAll() {
    await loadTenants();
    await loadUsers();
  }

  async function createTenant() {
    const name = (els.tenantName?.value || "").trim();
    const slug = makeSlug(els.tenantSlug?.value || "");
    const status = (els.tenantStatus?.value || "active").trim();
    const adminName = (els.tenantAdminName?.value || "").trim();
    const adminEmail = (els.tenantAdminEmail?.value || "").trim().toLowerCase();

    if (!name) {
      alert("Informe o nome do tenant.");
      els.tenantName?.focus();
      return;
    }

    if (!slug) {
      alert("Informe um slug válido.");
      els.tenantSlug?.focus();
      return;
    }

    const payload = {
      name,
      slug,
      status,
      admin_name: adminName || null,
      admin_email: adminEmail || null
    };

    const { error } = await sb.from("tenants").insert(payload);

    if (error) {
      console.error("Erro ao criar tenant:", error);
      alert(`Erro ao criar tenant: ${error.message}`);
      return;
    }

    closeModal(els.modalCreateTenant);
    resetTenantModal();
    await refreshAll();
    setActiveSection("tenants");
  }

  async function createUser() {
    const fullName = (els.userName?.value || "").trim();
    const email = (els.userEmail?.value || "").trim().toLowerCase();
    const phone = (els.userPhone?.value || "").trim();
    const userType = (els.userType?.value || "tenant_admin").trim();
    const status = (els.userStatus?.value || "active").trim();
    const tenantId = (els.userTenantId?.value || "").trim() || null;
    const password = (els.userPassword?.value || "").trim();
    const passwordConfirm = (els.userPasswordConfirm?.value || "").trim();

    if (!fullName) {
      alert("Informe o nome do usuário.");
      els.userName?.focus();
      return;
    }

    if (!email) {
      alert("Informe o e-mail do usuário.");
      els.userEmail?.focus();
      return;
    }

    if (!password) {
      alert("Informe a senha provisória.");
      els.userPassword?.focus();
      return;
    }

    if (password !== passwordConfirm) {
      alert("A confirmação de senha não confere.");
      els.userPasswordConfirm?.focus();
      return;
    }

    const scope = tenantId ? "tenant" : "global";

    const authCreate = await sb.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });

    if (authCreate.error) {
      console.error("Erro ao criar autenticação do usuário:", authCreate.error);
      alert(`Erro ao criar autenticação do usuário: ${authCreate.error.message}`);
      return;
    }

    const authUserId = authCreate.data?.user?.id || null;

    const profilePayload = {
      user_id: authUserId,
      full_name: fullName,
      email,
      phone: phone || null,
      scope,
      platform_role: userType,
      user_type: userType,
      status,
      tenant_id: tenantId,
      is_platform_user: userType === "platform_admin"
    };

    let insertOk = false;

    const insertProfiles = await sb.from("profiles").insert(profilePayload);
    if (!insertProfiles.error) {
      insertOk = true;
    } else {
      console.warn("Insert em profiles falhou, tentando platform_users:", insertProfiles.error);

      const fallbackPayload = {
        ...profilePayload,
        id: authUserId
      };

      const insertPlatformUsers = await sb.from("platform_users").insert(fallbackPayload);
      if (!insertPlatformUsers.error) {
        insertOk = true;
      } else {
        console.error("Erro ao persistir usuário:", insertPlatformUsers.error);
        alert(`Usuário autenticado criado, mas falhou ao gravar perfil: ${insertPlatformUsers.error.message}`);
        return;
      }
    }

    if (!insertOk) {
      alert("Não foi possível concluir o cadastro do usuário.");
      return;
    }

    closeModal(els.modalCreateUser);
    resetUserModal();
    await refreshAll();
    setActiveSection("users");
  }

  function bindEvents() {
    els.navLinks.forEach((btn) => {
      btn.addEventListener("click", () => {
        setActiveSection(btn.dataset.section);
      });
    });

    els.btnOpenCreateTenant?.addEventListener("click", () => {
      resetTenantModal();
      openModal(els.modalCreateTenant);
    });

    els.btnOpenCreateTenant2?.addEventListener("click", () => {
      resetTenantModal();
      openModal(els.modalCreateTenant);
    });

    els.btnOpenCreateUser?.addEventListener("click", () => {
      resetUserModal();
      openModal(els.modalCreateUser);
    });

    els.btnCreateTenantConfirm?.addEventListener("click", createTenant);
    els.btnCreateUserConfirm?.addEventListener("click", createUser);

    els.btnGeneratePassword?.addEventListener("click", () => {
      const pwd = generatePassword();
      if (els.userPassword) els.userPassword.value = pwd;
      if (els.userPasswordConfirm) els.userPasswordConfirm.value = pwd;
    });

    els.btnRefreshPlatform?.addEventListener("click", refreshAll);
    els.btnReloadTenants?.addEventListener("click", loadTenants);

    els.btnLogout?.addEventListener("click", async () => {
      try {
        await sb.auth.signOut();
      } catch (err) {
        console.error(err);
      }
      window.location.href = "/login.html";
    });

    document.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const modalId = btn.getAttribute("data-close");
        closeModal(document.getElementById(modalId));
      });
    });

    document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) {
          closeModal(backdrop);
        }
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeAllModals();
      }
    });

    els.tenantName?.addEventListener("input", () => {
      if (!els.tenantSlug?.dataset.editedManually) {
        els.tenantSlug.value = makeSlug(els.tenantName.value);
      }
    });

    els.tenantSlug?.addEventListener("input", () => {
      els.tenantSlug.value = makeSlug(els.tenantSlug.value);
      els.tenantSlug.dataset.editedManually = "1";
    });

    [
      els.tenantSearch,
      els.tenantStatusFilter
    ].forEach((el) => {
      el?.addEventListener("input", renderTenantsTable);
      el?.addEventListener("change", renderTenantsTable);
    });

    [
      els.userSearch,
      els.userStatusFilter,
      els.userTypeFilter,
      els.userTenantFilter
    ].forEach((el) => {
      el?.addEventListener("input", renderUsersTable);
      el?.addEventListener("change", renderUsersTable);
    });
  }

  async function init() {
    bindEvents();
    resetUserModal();
    await refreshAll();
  }

  init();
})();
