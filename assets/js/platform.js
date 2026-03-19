(function () {
  "use strict";

  const SUPABASE_URL = window.PORTAL_SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.PORTAL_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !window.supabase) {
    console.error("Supabase não configurado.");
    window.location.replace("/login.html?error=supabase_not_configured");
    return;
  }

  const sb = window.__PORTAL_SUPABASE_CLIENT__ || window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
  window.__PORTAL_SUPABASE_CLIENT__ = sb;

  const PLATFORM_ROLES = [
    "platform_admin",
    "platform_support",
    "platform_operations",
    "platform_readonly"
  ];

  const TENANT_ROLES = [
    "tenant_admin",
    "tenant_viewer",
    "tenant_marketing"
  ];

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
    modalEditTenant: document.getElementById("modalEditTenant"),
    modalEditUser: document.getElementById("modalEditUser"),

    tenantName: document.getElementById("tenantName"),
    tenantSlug: document.getElementById("tenantSlug"),
    tenantStatus: document.getElementById("tenantStatus"),

    btnUpdateTenantConfirm: document.getElementById("btnUpdateTenantConfirm"),

    editTenantId: document.getElementById("editTenantId"),
    editTenantName: document.getElementById("editTenantName"),
    editTenantSlug: document.getElementById("editTenantSlug"),
    editTenantStatus: document.getElementById("editTenantStatus"),

    userName: document.getElementById("userName"),
    userEmail: document.getElementById("userEmail"),
    userPhone: document.getElementById("userPhone"),
    userType: document.getElementById("userType"),
    userStatus: document.getElementById("userStatus"),
    userTenantId: document.getElementById("userTenantId"),
    userPassword: document.getElementById("userPassword"),
    userPasswordConfirm: document.getElementById("userPasswordConfirm"),

    btnUpdateUserConfirm: document.getElementById("btnUpdateUserConfirm"),
    editUserId: document.getElementById("editUserId"),
    editUserName: document.getElementById("editUserName"),
    editUserEmail: document.getElementById("editUserEmail"),
    editUserPhone: document.getElementById("editUserPhone"),
    editUserType: document.getElementById("editUserType"),
    editUserStatus: document.getElementById("editUserStatus"),
    editUserTenantId: document.getElementById("editUserTenantId"),

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

  function firstAccessBadge(lastLoginAt) {
    if (!lastLoginAt) {
      return `<span class="badge pending">Pendente</span>`;
    }
    return `<span class="badge active">Realizado</span>`;
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

  function isPlatformRole(value) {
    return PLATFORM_ROLES.includes(String(value || "").trim().toLowerCase());
  }

  function isTenantRole(value) {
    return TENANT_ROLES.includes(String(value || "").trim().toLowerCase());
  }

  function clearTenantSessionStorage() {
    try {
      sessionStorage.removeItem("tenant_id");
      sessionStorage.removeItem("tenant_role");
    } catch (err) {
      console.warn("Falha ao limpar sessão do tenant:", err);
    }
  }

  async function signOutAndRedirect(reason = "session_invalid") {
    try {
      clearTenantSessionStorage();
      await sb.auth.signOut();
    } catch (err) {
      console.error("Erro ao encerrar sessão:", err);
    }
    window.location.replace(`/login.html?error=${encodeURIComponent(reason)}`);
  }

  async function ensurePlatformAccess() {
    const { data: sessionData, error: sessionError } = await sb.auth.getSession();

    if (sessionError || !sessionData?.session?.user) {
      console.error("Sessão inválida:", sessionError);
      await signOutAndRedirect("no_session");
      return false;
    }

    const userId = sessionData.session.user.id;

    const { data: profile, error: profileError } = await sb
      .from("profiles")
      .select("user_id,email,status,is_platform_user,platform_role")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile) {
      console.error("Perfil não encontrado:", profileError);
      await signOutAndRedirect("profile_not_found");
      return false;
    }

    if (profile.status !== "active") {
      console.error("Usuário inativo:", profile.status);
      await signOutAndRedirect("user_inactive");
      return false;
    }

    if (profile.is_platform_user !== true) {
      console.error("Usuário sem acesso à plataforma.");
      await signOutAndRedirect("not_platform_user");
      return false;
    }

    clearTenantSessionStorage();
    return true;
  }

  function getProfileScopeAndRole(userType, tenantId) {
    const normalizedType = String(userType || "").trim().toLowerCase();
    const hasTenant = Boolean(tenantId);

    if (isPlatformRole(normalizedType)) {
      return {
        scope: "global",
        platformRole: normalizedType,
        membershipRole: null,
        isPlatformUser: true
      };
    }

    return {
      scope: hasTenant ? "tenant" : "global",
      platformRole: null,
      membershipRole: isTenantRole(normalizedType) ? normalizedType : null,
      isPlatformUser: false
    };
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
  }

  function resetUserModal() {
    if (els.userName) els.userName.value = "";
    if (els.userEmail) els.userEmail.value = "";
    if (els.userPhone) els.userPhone.value = "";
    if (els.userType) els.userType.value = "platform_readonly";
    if (els.userStatus) els.userStatus.value = "active";
    if (els.userTenantId) els.userTenantId.value = "";
    const pwd = generatePassword();
    if (els.userPassword) els.userPassword.value = pwd;
    if (els.userPasswordConfirm) els.userPasswordConfirm.value = pwd;
  }

  function resetEditTenantModal() {
    if (els.editTenantId) els.editTenantId.value = "";
    if (els.editTenantName) els.editTenantName.value = "";
    if (els.editTenantSlug) {
      els.editTenantSlug.value = "";
      delete els.editTenantSlug.dataset.editedManually;
    }
    if (els.editTenantStatus) els.editTenantStatus.value = "active";
  }

  function resetEditUserModal() {
    if (els.editUserId) els.editUserId.value = "";
    if (els.editUserName) els.editUserName.value = "";
    if (els.editUserEmail) els.editUserEmail.value = "";
    if (els.editUserPhone) els.editUserPhone.value = "";
    if (els.editUserType) els.editUserType.value = "platform_readonly";
    if (els.editUserStatus) els.editUserStatus.value = "active";
    if (els.editUserTenantId) els.editUserTenantId.value = "";
  }

  function renderTenantFilters() {
    if (!els.userTenantFilter || !els.userTenantId) return;

    const currentFilter = els.userTenantFilter.value;
    const currentCreate = els.userTenantId.value;

    const filterOptions = [`<option value="">Todos tenants</option>`]
      .concat(
        state.tenants.map((tenant) => (
          `<option value="${escapeHtml(tenant.id)}">${escapeHtml(tenant.name || tenant.slug || tenant.id)}</option>`
        ))
      )
      .join("");

    els.userTenantFilter.innerHTML = filterOptions;

    const createOptions = [`<option value="">Sem vínculo</option>`]
      .concat(
        state.tenants.map((tenant) => (
          `<option value="${escapeHtml(tenant.id)}">${escapeHtml(tenant.name || tenant.slug || tenant.id)}</option>`
        ))
      )
      .join("");

    els.userTenantId.innerHTML = createOptions;

    if ([...els.userTenantFilter.options].some((o) => o.value === currentFilter)) {
      els.userTenantFilter.value = currentFilter;
    }

    if ([...els.userTenantId.options].some((o) => o.value === currentCreate)) {
      els.userTenantId.value = currentCreate;
    }

    renderEditUserTenantOptions(els.editUserTenantId?.value || "");
  }

  function renderEditUserTenantOptions(selectedTenantId = "") {
    if (!els.editUserTenantId) return;

    const options = [`<option value="">Sem vínculo</option>`]
      .concat(
        state.tenants.map((tenant) => (
          `<option value="${escapeHtml(tenant.id)}">${escapeHtml(tenant.name || tenant.slug || tenant.id)}</option>`
        ))
      )
      .join("");

    els.editUserTenantId.innerHTML = options;

    if ([...els.editUserTenantId.options].some((o) => o.value === selectedTenantId)) {
      els.editUserTenantId.value = selectedTenantId;
    }
  }

  function openEditTenantModal(tenantId) {
    const tenant = state.tenants.find((t) => String(t.id) === String(tenantId));
    if (!tenant) {
      alert("Tenant não encontrado.");
      return;
    }

    if (els.editTenantId) els.editTenantId.value = tenant.id || "";
    if (els.editTenantName) els.editTenantName.value = tenant.name || "";
    if (els.editTenantSlug) {
      els.editTenantSlug.value = tenant.slug || "";
      delete els.editTenantSlug.dataset.editedManually;
    }
    if (els.editTenantStatus) els.editTenantStatus.value = tenant.status || "active";

    openModal(els.modalEditTenant);
  }

  function deriveUserType(user) {
    const profileRole = String(user.platform_role || "").trim().toLowerCase();
    if (isPlatformRole(profileRole)) return profileRole;

    const memberships = Array.isArray(user.memberships) ? user.memberships : [];
    const firstMembershipRole = String(memberships[0]?.role || "").trim().toLowerCase();
    if (isTenantRole(firstMembershipRole)) return firstMembershipRole;

    return "platform_readonly";
  }

  function openEditUserModal(userId) {
    const user = state.users.find((u) => String(u.user_id) === String(userId));

    if (!user) {
      alert("Usuário não encontrado.");
      return;
    }

    const memberships = Array.isArray(user.memberships) ? user.memberships : [];
    const firstTenantId = memberships.length ? String(memberships[0].tenant_id || "") : "";
    const derivedType = deriveUserType(user);

    if (els.editUserId) els.editUserId.value = user.user_id || "";
    if (els.editUserName) els.editUserName.value = user.full_name || "";
    if (els.editUserEmail) els.editUserEmail.value = user.email || "";
    if (els.editUserPhone) els.editUserPhone.value = user.phone || "";
    if (els.editUserType) els.editUserType.value = derivedType;
    if (els.editUserStatus) els.editUserStatus.value = user.status || "pending";

    renderEditUserTenantOptions(firstTenantId);
    openModal(els.modalEditUser);
  }

  function openUserLinksModal(userId) {
    const user = state.users.find((u) => String(u.user_id) === String(userId));

    if (!user) {
      alert("Usuário não encontrado.");
      return;
    }

    const memberships = Array.isArray(user.memberships) ? user.memberships : [];

    if (!memberships.length) {
      alert(`O usuário "${user.full_name || user.email}" ainda não possui vínculos com tenant.`);
      return;
    }

    const tenantNames = memberships
      .map((m) => `${m.tenant_name || m.tenant_id || "—"}${m.role ? ` (${m.role})` : ""}`)
      .join("\n");

    alert(`Vínculos do usuário:\n\n${tenantNames}`);
  }

  function getFilteredTenants() {
    const search = (els.tenantSearch?.value || "").trim().toLowerCase();
    const status = (els.tenantStatusFilter?.value || "").trim().toLowerCase();

    return state.tenants.filter((tenant) => {
      const haystack = [
        tenant.name,
        tenant.slug
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
      const memberships = Array.isArray(user.memberships) ? user.memberships : [];
      const resolvedType = deriveUserType(user);
      const haystack = [
        user.full_name,
        user.email,
        user.phone,
        user.scope,
        user.platform_role,
        user.tenant_names,
        resolvedType
      ].join(" ").toLowerCase();

      const userStatus = String(user.status || "").toLowerCase();

      let okTenant = true;
      if (tenantId) {
        okTenant = memberships.some((m) => String(m.tenant_id || "") === tenantId);
      }

      const okSearch = !search || haystack.includes(search);
      const okStatus = !status || userStatus === status;
      const okType = !type || resolvedType === type || String(user.scope || "").toLowerCase() === type;

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
        <td>—</td>
        <td>—</td>
        <td>${formatDate(tenant.created_at)}</td>
        <td>
          <div class="actions">
            <button class="btn btn-light btn-sm" type="button" data-tenant-action="edit" data-id="${escapeHtml(tenant.id)}">Editar</button>
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
          <td colspan="9" class="empty-row">Nenhum usuário encontrado.</td>
        </tr>
      `;
      return;
    }

    els.usersTableBody.innerHTML = rows.map((user) => {
      const scope = user.scope || "—";
      const role = deriveUserType(user) || "—";
      const tenantsLabel = user.tenant_names || "—";

      return `
        <tr>
          <td>${escapeHtml(user.full_name || "—")}</td>
          <td>${escapeHtml(user.email || "—")}</td>
          <td>${escapeHtml(scope)}</td>
          <td>${escapeHtml(role)}</td>
          <td>${escapeHtml(tenantsLabel)}</td>
          <td>${statusBadge(user.status)}</td>
          <td>${firstAccessBadge(user.last_login_at)}</td>
          <td>${formatDateTime(user.last_login_at)}</td>
          <td>
            <div class="actions">
              <button class="btn btn-light btn-sm" type="button" data-user-action="edit" data-id="${escapeHtml(user.user_id || "")}">Editar</button>
              <button class="btn btn-light btn-sm" type="button" data-user-action="link" data-id="${escapeHtml(user.user_id || "")}">Vínculos</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  function renderMetrics() {
    const totalTenants = state.tenants.length;
    const activeTenants = state.tenants.filter((t) => String(t.status || "").toLowerCase() === "active").length;
    const disabledTenants = state.tenants.filter((t) => String(t.status || "").toLowerCase() === "disabled").length;
    const admins = state.users.filter((u) => String(u.platform_role || "").toLowerCase() === "platform_admin").length;

    const totalUsers = state.users.length;
    const globalUsers = state.users.filter((u) => Number(u.tenant_count || 0) === 0).length;
    const tenantUsers = state.users.filter((u) => Number(u.tenant_count || 0) > 0).length;
    const blockedUsers = state.users.filter((u) => String(u.status || "").toLowerCase() === "blocked").length;

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
      <tr><td colspan="9" class="empty-row">Carregando usuários...</td></tr>
    `;

    const { data, error } = await sb
      .from("v_platform_users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar usuários:", error);
      els.usersTableBody.innerHTML = `
        <tr><td colspan="9" class="empty-row">Erro ao carregar usuários.</td></tr>
      `;
      state.users = [];
      renderMetrics();
      return;
    }

    state.users = Array.isArray(data) ? data : [];
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

    const payload = { name, slug, status };

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

    alert("Tenant criado com sucesso. Agora cadastre um usuário e vincule-o ao tenant.");
  }

  async function updateTenant() {
    const tenantId = (els.editTenantId?.value || "").trim();
    const name = (els.editTenantName?.value || "").trim();
    const slug = makeSlug(els.editTenantSlug?.value || "");
    const status = (els.editTenantStatus?.value || "active").trim();

    if (!tenantId) {
      alert("Tenant inválido.");
      return;
    }

    if (!name) {
      alert("Informe o nome do tenant.");
      els.editTenantName?.focus();
      return;
    }

    if (!slug) {
      alert("Informe um slug válido.");
      els.editTenantSlug?.focus();
      return;
    }

    const { error } = await sb
      .from("tenants")
      .update({ name, slug, status })
      .eq("id", tenantId);

    if (error) {
      console.error("Erro ao atualizar tenant:", error);
      alert(`Erro ao atualizar tenant: ${error.message}`);
      return;
    }

    closeModal(els.modalEditTenant);
    resetEditTenantModal();
    await refreshAll();
    setActiveSection("tenants");
  }

  async function createUser() {
    const fullName = (els.userName?.value || "").trim();
    const email = (els.userEmail?.value || "").trim().toLowerCase();
    const phone = (els.userPhone?.value || "").trim();
    const userType = (els.userType?.value || "platform_readonly").trim();
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

    if (!isPlatformRole(userType) && !isTenantRole(userType)) {
      alert("Tipo de usuário inválido.");
      els.userType?.focus();
      return;
    }

    if (isTenantRole(userType) && !tenantId) {
      alert("Usuários de tenant precisam estar vinculados a um tenant.");
      els.userTenantId?.focus();
      return;
    }

    if (tenantId && isPlatformRole(userType)) {
      alert("Para vincular o usuário a um tenant, selecione um perfil de tenant.");
      els.userType?.focus();
      return;
    }

    const roleData = getProfileScopeAndRole(userType, tenantId);

    const {
      data: currentSessionData,
      error: currentSessionError
    } = await sb.auth.getSession();

    if (currentSessionError || !currentSessionData?.session) {
      alert("Sua sessão expirou. Faça login novamente.");
      await signOutAndRedirect("session_expired");
      return;
    }

    const adminSession = currentSessionData.session;

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

    if (!authUserId) {
      alert("Não foi possível obter o ID do usuário criado.");
      return;
    }

    try {
      const { error: restoreError } = await sb.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token
      });

      if (restoreError) {
        console.warn("Falha ao restaurar sessão do administrador:", restoreError);
      }
    } catch (restoreErr) {
      console.warn("Erro ao tentar restaurar sessão do administrador:", restoreErr);
    }

    const updateProfile = await sb
      .from("profiles")
      .update({
        full_name: fullName,
        email,
        phone: phone || null,
        scope: roleData.scope,
        platform_role: roleData.platformRole,
        status,
        is_platform_user: roleData.isPlatformUser,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", authUserId);

    if (updateProfile.error) {
      console.error("Erro ao atualizar profile:", updateProfile.error);
      alert(`Usuário autenticado criado, mas falhou ao atualizar perfil: ${updateProfile.error.message}`);
      return;
    }

    if (tenantId && roleData.membershipRole) {
      const insertMembership = await sb.from("tenant_members").insert({
        tenant_id: tenantId,
        user_id: authUserId,
        role: roleData.membershipRole,
        is_active: status === "active"
      });

      if (insertMembership.error) {
        console.error("Erro ao gravar vínculo do tenant:", insertMembership.error);
        alert(`Usuário criado, mas falhou ao vincular ao tenant: ${insertMembership.error.message}`);
        return;
      }
    }

    closeModal(els.modalCreateUser);
    resetUserModal();
    await refreshAll();
    setActiveSection("users");

    alert("Usuário criado com sucesso.");
  }

  async function updateUser() {
    const userId = (els.editUserId?.value || "").trim();
    const fullName = (els.editUserName?.value || "").trim();
    const email = (els.editUserEmail?.value || "").trim().toLowerCase();
    const phone = (els.editUserPhone?.value || "").trim();
    const userType = (els.editUserType?.value || "platform_readonly").trim();
    const status = (els.editUserStatus?.value || "active").trim();
    const tenantId = (els.editUserTenantId?.value || "").trim() || null;

    if (!userId) {
      alert("Usuário inválido.");
      return;
    }

    if (!fullName) {
      alert("Informe o nome do usuário.");
      els.editUserName?.focus();
      return;
    }

    if (!email) {
      alert("Informe o e-mail do usuário.");
      els.editUserEmail?.focus();
      return;
    }

    if (!isPlatformRole(userType) && !isTenantRole(userType)) {
      alert("Tipo de usuário inválido.");
      els.editUserType?.focus();
      return;
    }

    if (isTenantRole(userType) && !tenantId) {
      alert("Usuários de tenant precisam estar vinculados a um tenant.");
      els.editUserTenantId?.focus();
      return;
    }

    if (tenantId && isPlatformRole(userType)) {
      alert("Para vincular o usuário a um tenant, selecione um perfil de tenant.");
      els.editUserType?.focus();
      return;
    }

    const roleData = getProfileScopeAndRole(userType, tenantId);

    const updateProfile = await sb
      .from("profiles")
      .update({
        full_name: fullName,
        email,
        phone: phone || null,
        scope: roleData.scope,
        platform_role: roleData.platformRole,
        status,
        is_platform_user: roleData.isPlatformUser,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId);

    if (updateProfile.error) {
      console.error("Erro ao atualizar perfil do usuário:", updateProfile.error);
      alert(`Erro ao atualizar usuário: ${updateProfile.error.message}`);
      return;
    }

    const removeMemberships = await sb
      .from("tenant_members")
      .delete()
      .eq("user_id", userId);

    if (removeMemberships.error) {
      console.error("Erro ao remover vínculos antigos:", removeMemberships.error);
      alert(`Usuário atualizado, mas falhou ao limpar vínculos antigos: ${removeMemberships.error.message}`);
      return;
    }

    if (tenantId && roleData.membershipRole) {
      const insertMembership = await sb
        .from("tenant_members")
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          role: roleData.membershipRole,
          is_active: status === "active"
        });

      if (insertMembership.error) {
        console.error("Erro ao gravar vínculo do tenant:", insertMembership.error);
        alert(`Usuário atualizado, mas falhou ao recriar vínculo: ${insertMembership.error.message}`);
        return;
      }
    }

    closeModal(els.modalEditUser);
    resetEditUserModal();
    await refreshAll();
    setActiveSection("users");

    alert("Usuário atualizado com sucesso.");
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
    els.btnUpdateTenantConfirm?.addEventListener("click", updateTenant);
    els.btnCreateUserConfirm?.addEventListener("click", createUser);
    els.btnUpdateUserConfirm?.addEventListener("click", updateUser);

    els.btnGeneratePassword?.addEventListener("click", () => {
      const pwd = generatePassword();
      if (els.userPassword) els.userPassword.value = pwd;
      if (els.userPasswordConfirm) els.userPasswordConfirm.value = pwd;
    });

    els.userType?.addEventListener("change", () => {
      const currentType = (els.userType.value || "").trim();
      if (isPlatformRole(currentType) && els.userTenantId) {
        els.userTenantId.value = "";
      }
    });

    els.editUserType?.addEventListener("change", () => {
      const currentType = (els.editUserType.value || "").trim();
      if (isPlatformRole(currentType) && els.editUserTenantId) {
        els.editUserTenantId.value = "";
      }
    });

    els.btnRefreshPlatform?.addEventListener("click", refreshAll);
    els.btnReloadTenants?.addEventListener("click", loadTenants);

    els.btnLogout?.addEventListener("click", async () => {
      try {
        clearTenantSessionStorage();
        await sb.auth.signOut();
      } catch (err) {
        console.error(err);
      }
      window.location.replace("/login.html");
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

    document.addEventListener("click", (event) => {
      const tenantActionBtn = event.target.closest("[data-tenant-action]");
      if (tenantActionBtn) {
        const action = tenantActionBtn.getAttribute("data-tenant-action");
        const tenantId = tenantActionBtn.getAttribute("data-id");

        if (action === "edit") {
          openEditTenantModal(tenantId);
          return;
        }
      }

      const userActionBtn = event.target.closest("[data-user-action]");
      if (userActionBtn) {
        const action = userActionBtn.getAttribute("data-user-action");
        const userId = userActionBtn.getAttribute("data-id");

        if (action === "edit") {
          openEditUserModal(userId);
          return;
        }

        if (action === "link") {
          openUserLinksModal(userId);
        }
      }
    });

    els.editTenantName?.addEventListener("input", () => {
      if (!els.editTenantSlug?.dataset.editedManually) {
        els.editTenantSlug.value = makeSlug(els.editTenantName.value);
      }
    });

    els.editTenantSlug?.addEventListener("input", () => {
      els.editTenantSlug.value = makeSlug(els.editTenantSlug.value);
      els.editTenantSlug.dataset.editedManually = "1";
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

    [els.tenantSearch, els.tenantStatusFilter].forEach((el) => {
      el?.addEventListener("input", renderTenantsTable);
      el?.addEventListener("change", renderTenantsTable);
    });

    [els.userSearch, els.userStatusFilter, els.userTypeFilter, els.userTenantFilter].forEach((el) => {
      el?.addEventListener("input", renderUsersTable);
      el?.addEventListener("change", renderUsersTable);
    });

    sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        window.location.replace("/login.html");
      }
    });
  }

  async function init() {
    bindEvents();
    resetUserModal();
    resetEditUserModal();

    const allowed = await ensurePlatformAccess();
    if (!allowed) return;

    await refreshAll();
  }

  init();
})();
