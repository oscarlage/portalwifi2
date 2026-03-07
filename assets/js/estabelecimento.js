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

  const tenantId = localStorage.getItem(TENANT_ID_KEY);
  const tenantName = localStorage.getItem(TENANT_NAME_KEY);
  const tenantSlug = localStorage.getItem(TENANT_SLUG_KEY);

  const routes = {
    "/painel": {
      page: "/estabelecimento/home.html",
      title: "Dashboard",
      subtitle: "Visão geral do movimento do Wi-Fi."
    },
    "/painel/clientes": {
      page: "/estabelecimento/clientes.html",
      title: "Clientes",
      subtitle: "Base de clientes captados pelo Wi-Fi."
    },
    "/painel/campanhas": {
      page: "/estabelecimento/campanhas.html",
      title: "Campanhas",
      subtitle: "Campanhas e ações de relacionamento."
    },
    "/painel/configuracoes": {
      page: "/estabelecimento/configuracoes.html",
      title: "Configurações",
      subtitle: "Personalização do portal e parâmetros do estabelecimento."
    },
    "/painel/relatorios": {
      page: "/estabelecimento/relatorios.html",
      title: "Relatórios",
      subtitle: "Análises e visão consolidada dos acessos."
    }
  };

  function normalizePath(pathname) {
    if (!pathname) return "/painel";
    const clean = pathname.replace(/\/+$/, "");
    return clean || "/painel";
  }

  function getRouteConfig(pathname) {
    const normalized = normalizePath(pathname);
    return routes[normalized] || routes["/painel"];
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
    const name = tenantName || tenantSlug || "Estabelecimento";
    const sub = tenantId
      ? `Tenant ativo • ${tenantSlug || tenantId}`
      : "Nenhum tenant selecionado";

    if (shellTenantName) shellTenantName.textContent = name;
    if (shellTenantSub) shellTenantSub.textContent = sub;
    if (sideTenantValue) sideTenantValue.textContent = tenantName || tenantSlug || tenantId || "Não selecionado";
  }

  function loadRoute(route, push = true) {
    const normalized = normalizePath(route);
    const meta = getRouteConfig(normalized);

    if (!tenantId) {
      alert("Nenhum tenant ativo selecionado. Volte ao platform e selecione um tenant.");
      window.location.href = "/platform.html";
      return;
    }

    if (frame) {
      frame.src = meta.page;
    }

    updateHeader(normalized);
    setActiveByRoute(normalized);

    localStorage.setItem("portalwifi.estabelecimento.route", normalized);

    if (push) {
      history.pushState({ route: normalized }, "", normalized);
    }
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const route = btn.dataset.route || "/painel";
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
  const initialRoute = routes[currentPath]
    ? currentPath
    : (localStorage.getItem("portalwifi.estabelecimento.route") || "/painel");

  loadRoute(initialRoute, false);
})();
