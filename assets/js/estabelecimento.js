(function () {
  "use strict";

  const frame = document.getElementById("contentFrame");
  const buttons = Array.from(document.querySelectorAll(".nav-item"));
  const title = document.getElementById("pageTitle");
  const subtitle = document.getElementById("pageSubtitle");

  const tenantNameEl = document.getElementById("tenantName");
  const tenantSlugEl = document.getElementById("tenantSlug");
  const tenantNameFooterEl = document.getElementById("tenantNameFooter");

  const TENANT_ID_KEY = "portalwifi.activeTenantId";
  const TENANT_NAME_KEY = "portalwifi.activeTenantName";
  const TENANT_SLUG_KEY = "portalwifi.activeTenantSlug";
  const PAGE_KEY = "portalwifi.estabelecimento.page";

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

  function syncTenantFromUrl() {
    const queryTenantSlug = getQueryTenantSlug();

    if (!queryTenantSlug) return;

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

  function getStoredTenant() {
    return {
      id: localStorage.getItem(TENANT_ID_KEY),
      name: localStorage.getItem(TENANT_NAME_KEY),
      slug: localStorage.getItem(TENANT_SLUG_KEY)
    };
  }

  function updateTenantShell() {
    const tenant = getStoredTenant();
    const displayName = tenant.name || tenant.slug || "Estabelecimento";
    const displaySub = tenant.slug
      ? `Tenant ativo • ${tenant.slug}`
      : tenant.id
        ? `Tenant ativo • ${tenant.id}`
        : "Nenhum tenant selecionado";

    if (tenantNameEl) tenantNameEl.textContent = displayName;
    if (tenantSlugEl) tenantSlugEl.textContent = displaySub;
    if (tenantNameFooterEl) {
      tenantNameFooterEl.textContent = tenant.name || tenant.slug || tenant.id || "Não selecionado";
    }
  }

  function ensureTenantSelected() {
    const tenant = getStoredTenant();

    if (!tenant.id && !tenant.slug) {
      alert("Nenhum tenant ativo selecionado. Volte à plataforma e selecione um tenant.");
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

  window.addEventListener("popstate", () => {
    const page = getInitialPage();
    loadPage(page, false);
  });

  syncTenantFromUrl();
  updateTenantShell();
  loadPage(getInitialPage(), false);
})();
