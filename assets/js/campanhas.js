(function () {
  const STORAGE_KEY = "portalwifi_campaigns";

  const campaignTable = document.getElementById("campaignTable");
  const campaignModal = document.getElementById("campaignModal");
  const openCampaignModalBtn = document.getElementById("openCampaignModal");
  const closeCampaignModalBtn = document.getElementById("closeCampaignModal");
  const cancelCampaignModalBtn = document.getElementById("cancelCampaignModal");
  const campaignForm = document.getElementById("campaignForm");
  const campaignModalTitle = document.getElementById("campaignModalTitle");

  const campaignId = document.getElementById("campaignId");
  const campaignName = document.getElementById("campaignName");
  const campaignType = document.getElementById("campaignType");
  const campaignStatus = document.getElementById("campaignStatus");
  const campaignAudience = document.getElementById("campaignAudience");
  const campaignClients = document.getElementById("campaignClients");
  const campaignDate = document.getElementById("campaignDate");
  const campaignMessage = document.getElementById("campaignMessage");

  function loadCampaigns() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error("Erro ao carregar campanhas:", err);
      return [];
    }
  }

  function saveCampaigns(campaigns) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(campaigns));
  }

  function openModal(editMode = false) {
    campaignModal.classList.add("show");
    campaignModalTitle.textContent = editMode ? "Editar campanha" : "Nova campanha";
  }

  function closeModal() {
    campaignModal.classList.remove("show");
    campaignForm.reset();
    campaignId.value = "";
  }

  function generateId() {
    return "camp_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  }

  function formatType(type) {
    const map = {
      whatsapp: "WhatsApp",
      sms: "SMS",
      email: "E-mail",
      cupom: "Cupom promocional",
      reengajamento: "Reengajamento"
    };
    return map[type] || type || "-";
  }

  function formatDate(dateStr) {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    });
  }

  function formatStatus(status) {
    const labels = {
      rascunho: "Rascunho",
      agendada: "Agendada",
      enviada: "Enviada"
    };

    return `
      <span class="status-badge status-${status || "rascunho"}">
        ${labels[status] || "Rascunho"}
      </span>
    `;
  }

  function renderCampaigns() {
    const campaigns = loadCampaigns();

    if (!campaigns.length) {
      campaignTable.innerHTML = `
        <tr>
          <td colspan="6" class="muted">Nenhuma campanha criada ainda.</td>
        </tr>
      `;
      return;
    }

    campaignTable.innerHTML = campaigns
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(campaign => `
        <tr>
          <td>${escapeHtml(campaign.name)}</td>
          <td>${formatType(campaign.type)}</td>
          <td>${formatStatus(campaign.status)}</td>
          <td>${campaign.clients || 0}</td>
          <td>${formatDate(campaign.date)}</td>
          <td>
            <div class="actions-cell">
              <button class="table-action" data-action="edit" data-id="${campaign.id}">Editar</button>
              <button class="table-action" data-action="delete" data-id="${campaign.id}">Excluir</button>
            </div>
          </td>
        </tr>
      `)
      .join("");
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function fillForm(campaign) {
    campaignId.value = campaign.id || "";
    campaignName.value = campaign.name || "";
    campaignType.value = campaign.type || "";
    campaignStatus.value = campaign.status || "rascunho";
    campaignAudience.value = campaign.audience || "";
    campaignClients.value = campaign.clients ?? "";
    campaignDate.value = campaign.date || "";
    campaignMessage.value = campaign.message || "";
  }

  function getFormData() {
    return {
      id: campaignId.value || generateId(),
      name: campaignName.value.trim(),
      type: campaignType.value,
      status: campaignStatus.value,
      audience: campaignAudience.value,
      clients: Number(campaignClients.value || 0),
      date: campaignDate.value || "",
      message: campaignMessage.value.trim(),
      created_at: new Date().toISOString()
    };
  }

  openCampaignModalBtn.addEventListener("click", () => {
    campaignForm.reset();
    campaignId.value = "";
    openModal(false);
  });

  closeCampaignModalBtn.addEventListener("click", closeModal);
  cancelCampaignModalBtn.addEventListener("click", closeModal);

  campaignModal.addEventListener("click", (e) => {
    if (e.target === campaignModal) {
      closeModal();
    }
  });

  campaignForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const data = getFormData();

    if (!data.name || !data.type || !data.status || !data.audience) {
      alert("Preencha os campos obrigatórios.");
      return;
    }

    const campaigns = loadCampaigns();
    const index = campaigns.findIndex(item => item.id === data.id);

    if (index >= 0) {
      data.created_at = campaigns[index].created_at || data.created_at;
      campaigns[index] = data;
    } else {
      campaigns.push(data);
    }

    saveCampaigns(campaigns);
    renderCampaigns();
    closeModal();
  });

  campaignTable.addEventListener("click", (e) => {
    const button = e.target.closest("button[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    const campaigns = loadCampaigns();
    const campaign = campaigns.find(item => item.id === id);

    if (!campaign) return;

    if (action === "edit") {
      fillForm(campaign);
      openModal(true);
      return;
    }

    if (action === "delete") {
      const confirmed = confirm(`Deseja excluir a campanha "${campaign.name}"?`);
      if (!confirmed) return;

      const updated = campaigns.filter(item => item.id !== id);
      saveCampaigns(updated);
      renderCampaigns();
    }
  });

  renderCampaigns();
})();
