(function () {
  const frame = document.getElementById("contentFrame");
  const buttons = Array.from(document.querySelectorAll(".nav-item"));
  const title = document.getElementById("pageTitle");
  const subtitle = document.getElementById("pageSubtitle");
  const reloadBtn = document.getElementById("reloadFrameBtn");

  const shellTenantName = document.getElementById("shellTenantName");
  const shellTenantSub = document.getElementById("shellTenantSub");
  const sideTenantValue = document.getElementById("sideTenantValue");

  const TENANT_ID_KEY = "portalwifi.activeTenantId";
  const TENANT_NAME_KEY = "portalwifi.activeTenantName";
  const TENANT_SLUG_KEY = "portalwifi.activeTenantSlug";
  const ROUTE_KEY = "portalwifi.estabelecimento.route";

  function getQueryTenantSlug() {
    const params = new URLSearchParams(window.location.search);
    return params.get("tenant");
  }

  function syncTenantFromUrl() {
    const queryTenantSlug = getQueryTenantSlug();
    if (queryTenantSlug) {
      localStorage.setItem(TENANT_SLUG_KEY, queryTenantSlug);

      const savedName = localStorage.getItem(TENANT_NAME_KEY);
      if (!savedName) {
        localStorage.setItem(
          TENANT_NAME_KEY,
          queryTenantSlug
            .split("-")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ")
        );
      }
    }
  }

  syncTenantFromUrl();

  const tenantId = localStorage.getItem(TENANT_ID_KEY);
  const tenantName = localStorage.getItem(TENANT_NAME_KEY);
  const tenantSlug = localStorage.getItem(TENANT_SLUG_KEY);

  const BASE_ROUTE = "/estabelecimento";
  const DEFAULT_ROUTE = BASE_ROUTE;

  const routes = {
    "/estabelecimento": {
      page: "/estabelecimento/home.html",
      title: "Dashboard",
      subtitle: "Visão geral do movimento do Wi-Fi."
    },
    "/estabelecimento/clientes": {
      page: "/estabelecimento/clientes.html",
      title: "Clientes",
      subtitle: "Base de clientes captados pelo Wi-Fi."
    },
    "/estabelecimento/campanhas": {
      page: "/estabelecimento/campanhas.html",
      title: "Campanhas",
      subtitle: "Campanhas e ações de relacionamento."
    },
    "/estabelecimento/configuracoes": {
      page: "/estabelecimento/configuracoes.html",
      title: "Configurações",
      subtitle: "Personalização do portal e parâmetros do estabelecimento."
    },
    "/estabelecimento/relatorios": {
      page: "/estabelecimento/relatorios.html",
      title: "Relatórios",
      subtitle: "Análises e visão consolidada dos acessos."
    }
  };

  function normalizePath(pathname) {
    if (!pathname) return DEFAULT_ROUTE;

    const clean = pathname.replace(/\/+$/, "");
    if (!clean) return DEFAULT_ROUTE;

    if (clean === "/painel") return DEFAULT_ROUTE;
    if (clean.startsWith("/painel/")) {
      return clean.replace(/^\/painel/, BASE_ROUTE);
    }

    return clean;
  }

  function getRouteConfig(pathname) {
    const normalized = normalizePath(pathname);
    return routes[normalized] || routes[DEFAULT_ROUTE];
  }

  function setActiveByRoute(route) {
    buttons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.route === route);
    });
  }

  function updateHeader(route) {
    const meta = getRouteConfig(route);
    if (title) title.textContent = meta.title;
    if (subtitle) subtitle.textContent = meta.subtitle;
  }

  function updateTenantShell() {
    const displayName = tenantName || tenantSlug || "Estabelecimento";
    const sub = tenantId || tenantSlug
      ? `Tenant ativo • ${tenantSlug || tenantId}`
      : "Nenhum tenant selecionado";

    if (shellTenantName) shellTenantName.textContent = displayName;
    if (shellTenantSub) shellTenantSub.textContent = sub;
    if (sideTenantValue) {
      sideTenantValue.textContent =
        tenantName || tenantSlug || tenantId || "Não selecionado";
    }
  }

  function buildUrl(route) {
    const url = new URL(window.location.origin + route);
    if (tenantSlug) {
      url.searchParams.set("tenant", tenantSlug);
    }
    return url.pathname + url.search;
  }

  function ensureTenantSelected() {
    if (!tenantId && !tenantSlug) {
      alert("Nenhum tenant ativo selecionado. Volte à plataforma e selecione um tenant.");
      window.location.href = "/platform.html";
      return false;
    }
    return true;
  }

  function loadRoute(route, push = true) {
    const normalized = normalizePath(route);
    const meta = getRouteConfig(normalized);

    if (!ensureTenantSelected()) return;

    if (frame) {
      frame.src = meta.page;
    }

    updateHeader(normalized);
    setActiveByRoute(normalized);

    localStorage.setItem(ROUTE_KEY, normalized);

    if (push) {
      history.pushState({ route: normalized }, "", buildUrl(normalized));
    }
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const route = btn.dataset.route || DEFAULT_ROUTE;
      loadRoute(route, true);
    });
  });

  if (reloadBtn && frame) {
    reloadBtn.addEventListener("click", () => {
      try {
        frame.contentWindow.location.reload();
      } catch (err) {
        frame.src = frame.src;
      }
    });
  }

  window.addEventListener("popstate", () => {
    loadRoute(window.location.pathname, false);
  });

  updateTenantShell();

  const currentPath = normalizePath(window.location.pathname);
  const savedRoute = localStorage.getItem(ROUTE_KEY);
  const initialRoute = routes[currentPath]
    ? currentPath
    : (routes[savedRoute] ? savedRoute : DEFAULT_ROUTE);

  loadRoute(initialRoute, false);
})();
