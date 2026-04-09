(function () {
  "use strict";

  const frame = document.getElementById("contentFrame");
  const buttons = Array.from(document.querySelectorAll(".nav-item"));
  const title = document.getElementById("pageTitle");
  const subtitle = document.getElementById("pageSubtitle");
  const workspaceBrandTitle = document.getElementById("workspaceBrandTitle");
  const userMenu = document.getElementById("userMenu");
  const userMenuTrigger = document.getElementById("userMenuTrigger");
  const userMenuDropdown = document.getElementById("userMenuDropdown");
  const userMenuLabel = document.getElementById("userMenuLabel");

  const tenantNameEl = document.getElementById("tenantName");
  const tenantSlugEl = document.getElementById("tenantSlug");
  const tenantNameFooterEl = document.getElementById("tenantNameFooter");

  const TENANT_ID_KEY = "portalwifi.activeTenantId";
  const TENANT_NAME_KEY = "portalwifi.activeTenantName";
  const TENANT_SLUG_KEY = "portalwifi.activeTenantSlug";
  const PAGE_KEY = "portalwifi.estabelecimento.page";
  const SESSION_TENANT_ID_KEY = "tenant_id";
  const SESSION_TENANT_ROLE_KEY = "tenant_role";
  const AUTH_CONTEXT_KEY = "portalwifi.authContext";
  const TENANT_MEMBERSHIPS_KEY = "portalwifi.tenantMemberships";

  const DEFAULT_PAGE = "/estabelecimento/home.html";

  const pageMeta = {
    "/estabelecimento/home.html": {
      title: "Dashboard",
      subtitle: "Visão geral do movimento do Wi-Fi."
    },
    "/estabelecimento/clientes.html": {
      title: "Clientes",
      subtitle: "Base de clientes captados pelo Wi-Fi."
    },
    "/estabelecimento/campanhas.html": {
      title: "Campanhas",
      subtitle: "Campanhas e ações de relacionamento."
    },
    "/estabelecimento/configuracoes.html": {
      title: "Configurações",
      subtitle: "Personalização do portal e parâmetros do estabelecimento."
    },
    "/estabelecimento/relatorios.html": {
      title: "Relatórios",
      subtitle: "Análises e visão consolidada dos acessos."
    }
  };

  function getQueryTenantSlug() {
    const params = new URLSearchParams(window.location.search);
    return params.get("tenant");
  }

  function getQueryTenantId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("tenant_id");
  }

  function syncTenantContext() {
    const queryTenantSlug = getQueryTenantSlug();
    const queryTenantId = getQueryTenantId();
    const sessionTenantId = sessionStorage.getItem(SESSION_TENANT_ID_KEY);

    if (queryTenantId) {
      localStorage.setItem(TENANT_ID_KEY, queryTenantId);
    } else if (sessionTenantId && !localStorage.getItem(TENANT_ID_KEY)) {
      localStorage.setItem(TENANT_ID_KEY, sessionTenantId);
    }

    if (queryTenantSlug) {
      localStorage.setItem(TENANT_SLUG_KEY, queryTenantSlug);

      const savedName = localStorage.getItem(TENANT_NAME_KEY);
      if (!savedName) {
        const label = queryTenantSlug
          .split("-")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ");

        localStorage.setItem(TENANT_NAME_KEY, label);
      }
    }

    if (!localStorage.getItem(TENANT_NAME_KEY)) {
      const fallbackLabel = queryTenantSlug || queryTenantId || sessionTenantId || "Estabelecimento";
      localStorage.setItem(TENANT_NAME_KEY, fallbackLabel);
    }
  }

  function safeJsonParse(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn("Falha ao interpretar contexto salvo:", error);
      return fallback;
    }
  }

  function getStoredAccessContext() {
    const access = safeJsonParse(sessionStorage.getItem(AUTH_CONTEXT_KEY), null);
    const memberships = safeJsonParse(sessionStorage.getItem(TENANT_MEMBERSHIPS_KEY), []);

    if (access && Array.isArray(memberships)) {
      return {
        ...access,
        memberships
      };
    }

    const legacyTenantId = sessionStorage.getItem(SESSION_TENANT_ID_KEY);
    const legacyTenantRole = sessionStorage.getItem(SESSION_TENANT_ROLE_KEY);

    if (legacyTenantId) {
      return {
        scope: "tenant",
        platformRole: null,
        tenantRole: legacyTenantRole || "tenant_viewer",
        canAccessGlobalAdmin: false,
        canAccessTenantAdmin: true,
        memberships: [{
          tenant_id: legacyTenantId,
          role: legacyTenantRole || "tenant_viewer",
          is_active: true
        }]
      };
    }

    return null;
  }

  function getStoredTenant() {
    return {
      id: localStorage.getItem(TENANT_ID_KEY),
      name: localStorage.getItem(TENANT_NAME_KEY),
      slug: localStorage.getItem(TENANT_SLUG_KEY)
    };
  }

  function clearTenantContext() {
    sessionStorage.removeItem(SESSION_TENANT_ID_KEY);
    sessionStorage.removeItem(SESSION_TENANT_ROLE_KEY);
    sessionStorage.removeItem("tenant_unit_id");
    sessionStorage.removeItem(AUTH_CONTEXT_KEY);
    sessionStorage.removeItem(TENANT_MEMBERSHIPS_KEY);
    localStorage.removeItem(TENANT_ID_KEY);
    localStorage.removeItem(TENANT_NAME_KEY);
    localStorage.removeItem(TENANT_SLUG_KEY);
  }

  async function ensureTenantAccess() {
    const tenant = getStoredTenant();
    const access = getStoredAccessContext();

    if (!access) {
      clearTenantContext();
      window.location.replace("/login.html?error=no_access_context");
      return null;
    }

    const permissions = await import("./core/permissions.js");
    const targetTenantId = tenant.id || access.memberships[0]?.tenant_id || null;

    if (targetTenantId && !permissions.canAccessTenantAdmin({ platform_role: access.platformRole }, access.memberships, targetTenantId)) {
      if (access.canAccessGlobalAdmin) {
        window.location.replace("/platform.html?error=tenant_access_denied");
      } else {
        clearTenantContext();
        window.location.replace("/login.html?error=tenant_access_denied");
      }
      return null;
    }

    if (!tenant.id && targetTenantId) {
      localStorage.setItem(TENANT_ID_KEY, targetTenantId);
      sessionStorage.setItem(SESSION_TENANT_ID_KEY, targetTenantId);
    }

    return {
      access,
      permissions,
      tenantId: targetTenantId
    };
  }

  function applyNavigationPermissions(permissionState) {
    if (!permissionState) {
      return;
    }

    const { access, permissions, tenantId } = permissionState;

    const visibility = {
      "/estabelecimento/home.html": true,
      "/estabelecimento/clientes.html": true,
      "/estabelecimento/campanhas.html": permissions.canManageCampaigns({ platform_role: access.platformRole }, access.memberships, tenantId),
      "/estabelecimento/configuracoes.html": permissions.canManageSettings({ platform_role: access.platformRole }, access.memberships, tenantId),
      "/estabelecimento/relatorios.html": permissions.canViewReports({ platform_role: access.platformRole }, access.memberships, tenantId)
    };

    buttons.forEach((btn) => {
      const page = btn.dataset.page || DEFAULT_PAGE;
      const allowed = visibility[page] !== false;

      btn.hidden = !allowed;
      btn.disabled = !allowed;
      btn.setAttribute("aria-hidden", allowed ? "false" : "true");
    });

    const currentPage = getInitialPage();
    if (visibility[currentPage] === false) {
      const fallbackPage = Object.entries(visibility).find(([, allowed]) => allowed)?.[0] || DEFAULT_PAGE;
      localStorage.setItem(PAGE_KEY, fallbackPage);
    }
  }

  function updateTenantShell() {
    const tenant = getStoredTenant();
    const displayName = tenant.name || tenant.slug || "Cliente";
    const displaySub = tenant.slug
      ? `Cliente ativo • ${tenant.slug}`
      : tenant.id
        ? `Cliente ativo • ${tenant.id}`
        : "Nenhum cliente selecionado";

    if (tenantNameEl) tenantNameEl.textContent = displayName;
    if (tenantSlugEl) tenantSlugEl.textContent = displaySub;
    if (workspaceBrandTitle) workspaceBrandTitle.textContent = displayName;
    if (userMenuLabel) userMenuLabel.textContent = displayName;
    if (tenantNameFooterEl) {
      tenantNameFooterEl.textContent = tenant.name || tenant.slug || tenant.id || "Não selecionado";
    }

    document.title = `Nexora - ${displayName}`;
  }

  function getCurrentPage() {
    const savedPage = localStorage.getItem(PAGE_KEY);
    return savedPage && pageMeta[savedPage] ? savedPage : DEFAULT_PAGE;
  }

  function openUserMenu() {
    if (!userMenu || !userMenuTrigger || !userMenuDropdown) return;
    userMenuDropdown.classList.remove("hidden");
    userMenu.classList.add("is-open");
    userMenuTrigger.setAttribute("aria-expanded", "true");
  }

  function closeUserMenu() {
    if (!userMenu || !userMenuTrigger || !userMenuDropdown) return;
    userMenuDropdown.classList.add("hidden");
    userMenu.classList.remove("is-open");
    userMenuTrigger.setAttribute("aria-expanded", "false");
  }

  function toggleUserMenu() {
    if (!userMenuDropdown || userMenuDropdown.classList.contains("hidden")) {
      openUserMenu();
      return;
    }

    closeUserMenu();
  }

  function applyEmbeddedFrameLayout() {
    if (!frame?.contentDocument?.body) return;
    frame.contentDocument.body.classList.add("embedded-shell");
  }

  function ensureTenantSelected() {
    const tenant = getStoredTenant();

    if (!tenant.id && !tenant.slug) {
      alert("Nenhum cliente ativo selecionado. Volte à plataforma e selecione um cliente.");
      window.location.href = "/platform.html";
      return false;
    }

    return true;
  }

  function setActiveByPage(page) {
    buttons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === page);
    });
  }

  function updateHeader(page) {
    const meta = pageMeta[page] || pageMeta[DEFAULT_PAGE];
    if (title) title.textContent = meta.title;
    if (subtitle) subtitle.textContent = meta.subtitle;
  }

  function buildShellUrl(page) {
    const tenant = getStoredTenant();
    const url = new URL(window.location.href);

    url.pathname = "/estabelecimento/index.html";
    url.searchParams.delete("page");

    if (page && page !== DEFAULT_PAGE) {
      url.searchParams.set("page", page);
    }

    if (tenant.slug) {
      url.searchParams.set("tenant", tenant.slug);
    }

    if (tenant.id) {
      url.searchParams.set("tenant_id", tenant.id);
    }

    return url.pathname + url.search;
  }

  function loadPage(page, pushState = true) {
    const targetPage = pageMeta[page] ? page : DEFAULT_PAGE;

    if (!ensureTenantSelected()) return;

    if (frame) {
      frame.src = targetPage;
    }

    updateHeader(targetPage);
    setActiveByPage(targetPage);
    localStorage.setItem(PAGE_KEY, targetPage);
    closeUserMenu();

    if (pushState) {
      history.pushState({ page: targetPage }, "", buildShellUrl(targetPage));
    }
  }

  function getInitialPage() {
    const params = new URLSearchParams(window.location.search);
    const queryPage = params.get("page");
    const savedPage = localStorage.getItem(PAGE_KEY);

    if (queryPage && pageMeta[queryPage]) return queryPage;
    if (savedPage && pageMeta[savedPage]) return savedPage;
    return DEFAULT_PAGE;
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const page = btn.dataset.page || DEFAULT_PAGE;
      loadPage(page, true);
    });
  });

  frame?.addEventListener("load", () => {
    applyEmbeddedFrameLayout();
  });

  userMenuTrigger?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleUserMenu();
  });

  document.addEventListener("click", (event) => {
    const userActionBtn = event.target.closest("[data-user-action]");
    if (userActionBtn) {
      const action = userActionBtn.getAttribute("data-user-action");

      if (action === "settings") {
        loadPage("/estabelecimento/configuracoes.html", true);
        return;
      }

      if (action === "change-password") {
        const returnUrl = buildShellUrl(getCurrentPage());
        window.location.href = `/reset-password.html?mode=self-service&return=${encodeURIComponent(returnUrl)}`;
        return;
      }

      if (action === "logout") {
        window.location.href = "/logout.html";
        return;
      }
    }

    if (userMenu && !userMenu.contains(event.target)) {
      closeUserMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeUserMenu();
    }
  });

  window.addEventListener("popstate", () => {
    const page = getInitialPage();
    loadPage(page, false);
  });

  (async function init() {
    syncTenantContext();
    const permissionState = await ensureTenantAccess();

    if (!permissionState) {
      return;
    }

    applyNavigationPermissions(permissionState);
    updateTenantShell();
    loadPage(getInitialPage(), false);
  })();
})();
