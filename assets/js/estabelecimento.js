(function () {
  const frame = document.getElementById("contentFrame");
  const buttons = Array.from(document.querySelectorAll(".nav-item"));
  const title = document.getElementById("pageTitle");
  const subtitle = document.getElementById("pageSubtitle");
  const reloadBtn = document.getElementById("reloadFrameBtn");

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

  function setActive(page) {
    buttons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === page);
    });

    const meta = pageMeta[page];
    if (meta) {
      if (title) title.textContent = meta.title;
      if (subtitle) subtitle.textContent = meta.subtitle;
    }
  }

  function loadPage(page) {
    if (!frame) return;
    frame.src = page;
    setActive(page);
    localStorage.setItem("portalwifi.estabelecimento.page", page);
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const page = btn.dataset.page;
      if (!page) return;
      loadPage(page);
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

  const savedPage =
    localStorage.getItem("portalwifi.estabelecimento.page") ||
    "/estabelecimento/home.html";

  loadPage(savedPage);
})();
