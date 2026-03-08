(function () {
  const SUPABASE_URL = window.PORTAL_SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.PORTAL_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !window.supabase) {
    console.warn("Supabase não configurado em window.PORTAL_SUPABASE_URL / window.PORTAL_SUPABASE_ANON_KEY");
    return;
  }

  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const usersTableBody = document.getElementById("usersTableBody");
  const userSearch = document.getElementById("userSearch");
  const userStatusFilter = document.getElementById("userStatusFilter");
  const userTypeFilter = document.getElementById("userTypeFilter");
  const btnOpenCreateUser = document.getElementById("btnOpenCreateUser");
  const btnCreateUserConfirm = document.getElementById("btnCreateUserConfirm");

  const modalCreateUser = document.getElementById("modalCreateUser");
  const modalEditUser = document.getElementById("modalEditUser");
  const modalAccessResult = document.getElementById("modalAccessResult");

  const accessResultText = document.getElementById("accessResultText");
  const btnCopyAccessMessage = document.getElementById("btnCopyAccessMessage");

  const btnSaveUserEdit = document.getElementById("btnSaveUserEdit");

  let allUsers = [];
  let allTenants = [];

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

  function userStatusBadge(status) {
    const cls = status || "pending";
    const label =
      cls === "active" ? "Ativo" :
      cls === "blocked" ? "Bloqueado" :
      cls === "disabled" ? "Desabilitado" :
      "Pendente";

    return `<span class="badge ${cls}">${label}</span>`;
  }

  function userTypeLabel(row) {
    if (row.scope === "global") return "Global";
    if (row.scope === "hybrid") return "Híbrido";
    return "Tenant";
  }

  function roleLabel(row) {
    if (row.platform_role) return row.platform_role;
    const memberships = Array.isArray(row.memberships) ? row.memberships : [];
    if (!memberships.length) return "-";
    return memberships.map(m => m.role).filter(Boolean).join(", ");
  }

  function buildUserAccessMessage(user) {
    return [
      `Olá, ${user.full_name || "Usuário(a)"}.`,
      ``,
      `Seu acesso à plataforma Portal WiFi foi criado/atualizado com sucesso.`,
      ``,
      `Escopo: ${userTypeLabel(user)}`,
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

  async function loadTenants() {
    const { data, error } = await supabaseClient
      .from("tenants")
      .select("id, name, slug")
      .order("name", { ascending: true });

    if (error) {
      console.error("Erro ao carregar tenants:", error);
      return;
    }

    allTenants = data || [];
    populateUserTenantOptions();
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

    if ([...select.options].some(opt => opt.value === currentValue)) {
      select.value = currentValue;
    }
  }

  async function loadUsers() {
    if (!usersTableBody) return;

    usersTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-row">Carregando usuários...</td>
      </tr>
    `;

    const { data, error } = await supabaseClient
      .from("v_platform_users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar usuários:", error);
      usersTableBody.innerHTML = `
        <tr>
          <td colspan="8" class="empty-row">Erro ao carregar usuários.</td>
        </tr>
      `;
      return;
    }

    allUsers = data || [];
    renderUsers();
  }

  function filteredUsers() {
    const q = (userSearch?.value || "").trim().toLowerCase();
    const status = userStatusFilter?.value || "";
    const type = userTypeFilter?.value || "";

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
      if (type === "platform_admin") {
        okType = row.platform_role === "platform_admin";
      } else if (type === "tenant_admin") {
        okType = Array.isArray(row.memberships) && row.memberships.some(m => m.role === "tenant_admin");
      } else if (type === "tenant_manager") {
        okType = Array.isArray(row.memberships) && row.memberships.some(m => m.role === "tenant_manager");
      } else if (type === "tenant_viewer") {
        okType = Array.isArray(row.memberships) && row.memberships.some(m => m.role === "tenant_viewer");
      }

      return okSearch && okStatus && okType;
    });
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
        <td>${escapeHtml(userTypeLabel(row))}</td>
        <td>${escapeHtml(row.tenant_names || "-")}</td>
        <td>${userStatusBadge(row.status)}</td>
        <td>${escapeHtml(formatDateBR(row.last_login_at))}</td>
        <td>${escapeHtml(formatDateBR(row.created_at))}</td>
        <td>
          <div class="actions">
            <button class="btn btn-light btn-sm" data-user-action="edit" data-user-id="${row.user_id}">
              Editar
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

  function resetCreateUserForm() {
    const fields = [
      "userName",
      "userEmail",
      "userPhone"
    ];

    fields.forEach(id => {
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
        selectedType === "tenant_manager" ? "tenant_manager" :
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
    const memberships = Array.isArray(user.memberships) ? user.memberships : [];

    document.getElementById("editUserId").value = user.user_id || "";
    document.getElementById("editUserName").value = user.full_name || "";
    document.getElementById("editUserEmail").value = user.email || "";
    document.getElementById("editUserPhone").value = user.phone || "";
    document.getElementById("editUserScope").value = user.scope || "tenant";
    document.getElementById("editUserPlatformRole").value = user.platform_role || "";
    document.getElementById("editUserStatus").value = user.status || "pending";
    document.getElementById("editIsPlatformUser").checked = !!user.is_platform_user;

    return memberships;
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
    btnOpenCreateUser?.addEventListener("click", () => {
      resetCreateUserForm();
      populateUserTenantOptions();
      openModal(modalCreateUser);
    });

    btnCreateUserConfirm?.addEventListener("click", handleCreateUser);
    btnSaveUserEdit?.addEventListener("click", handleSaveUserEdit);

    userSearch?.addEventListener("input", renderUsers);
    userStatusFilter?.addEventListener("change", renderUsers);
    userTypeFilter?.addEventListener("change", renderUsers);

    usersTableBody?.addEventListener("click", handleUsersTableClick);

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
    await loadTenants();
    await loadUsers();
  }

  init();
})();
