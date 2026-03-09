(function () {
  const SETTINGS = window.PORTAL_SETTINGS || {};
  const API_BASE = (SETTINGS.apiBase || "").replace(/\/$/, "");
  const TENANT_ID = SETTINGS.tenantId || "";

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

  let campaignsCache = [];

  function openModal(editMode = false) {
    campaignModal.classList.add("show");
    campaignModalTitle.textContent = editMode ? "Editar campanha" : "Nova campanha";
  }

  function closeModal() {
    campaignModal.classList.remove("show");
    campaignForm.reset();
    campaignId.value = "";
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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

  function formatStatus(status) {
    const labels = {
      rascunho: "Rascunho",
      agendada: "Agendada",
      enviada: "Enviada"
    };

    return `
      <span class="status-badge status-${status || "rascunho"}">
        ${labels[status] || status || "Rascunho"}
      </span>
    `;
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

  function toInputDateTime(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "";

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hour = String(d.getHours()).padStart(2, "0");
    const minute = String(d.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hour}:${minute}`;
  }

  function fromInputDateTime(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  function renderCampaigns(campaigns) {
    if (!campaigns || !campaigns.length) {
      campaignTable.innerHTML = `
        <tr>
          <td colspan="6" class="loading-row">Nenhuma campanha criada ainda.</td>
        </tr>
      `;
      return;
    }

    campaignTable.innerHTML = campaigns.map(campaign => `
      <tr>
        <td>${escapeHtml(campaign.name)}</td>
        <td>${formatType(campaign.type)}</td>
        <td>${formatStatus(campaign.status)}</td>
        <td>${campaign.estimated_clients || 0}</td>
        <td>${formatDate(campaign.scheduled_at)}</td>
        <td>
          <div class="actions-cell">
            <button class="table-action" data-action="edit" data-id="${campaign.id}">Editar</button>
            <button class="table-action" data-action="delete" data-id="${campaign.id}">Excluir</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  async function apiFetch(url, options = {}) {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json"
      },
      ...options
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `Erro HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }

    return null;
  }

  async function loadCampaigns() {
    try {
      campaignTable.innerHTML = `
        <tr>
          <td colspan="6" class="loading-row">Carregando campanhas...</td>
        </tr>
      `;

      const data = await apiFetch(`${API_BASE}/api/admin/campaigns?tenant_id=${encodeURIComponent(TENANT_ID)}`);

      campaignsCache = Array.isArray(data) ? data : (data.items || []);
      campaignsCache.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

      renderCampaigns(campaignsCache);
    } catch (error) {
      console.error("Erro ao carregar campanhas:", error);
      campaignTable.innerHTML = `
        <tr>
          <td colspan="6" class="error-row">Erro ao carregar campanhas.</td>
        </tr>
      `;
    }
  }

  function fillForm(campaign) {
    campaignId.value = campaign.id || "";
    campaignName.value = campaign.name || "";
    campaignType.value = campaign.type || "";
    campaignStatus.value = campaign.status || "rascunho";
    campaignAudience.value = campaign.audience || "";
    campaignClients.value = campaign.estimated_clients ?? "";
    campaignDate.value = toInputDateTime(campaign.scheduled_at);
    campaignMessage.value = campaign.message || "";
  }

  function getFormPayload() {
    return {
      tenant_id: TENANT_ID,
      name: campaignName.value.trim(),
      type: campaignType.value,
      status: campaignStatus.value,
      audience: campaignAudience.value || null,
      estimated_clients: Number(campaignClients.value || 0),
      scheduled_at: fromInputDateTime(campaignDate.value),
      message: campaignMessage.value.trim() || null
    };
  }

  async function createCampaign(payload) {
    return apiFetch(`${API_BASE}/api/admin/campaigns`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async function updateCampaign(id, payload) {
    return apiFetch(`${API_BASE}/api/admin/campaigns/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  }

  async function deleteCampaign(id) {
    return apiFetch(`${API_BASE}/api/admin/campaigns/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
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

  campaignForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const payload = getFormPayload();

      if (!TENANT_ID) {
        alert("tenantId não configurado.");
        return;
      }

      if (!payload.name || !payload.type || !payload.status) {
        alert("Preencha os campos obrigatórios.");
        return;
      }

      const id = campaignId.value;

      if (id) {
        await updateCampaign(id, payload);
      } else {
        await createCampaign(payload);
      }

      closeModal();
      await loadCampaigns();
    } catch (error) {
      console.error("Erro ao salvar campanha:", error);
      alert("Não foi possível salvar a campanha.");
    }
  });

  campaignTable.addEventListener("click", async (e) => {
    const button = e.target.closest("button[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;
    const campaign = campaignsCache.find(item => String(item.id) === String(id));

    if (!campaign) return;

    if (action === "edit") {
      fillForm(campaign);
      openModal(true);
      return;
    }

    if (action === "delete") {
      const confirmed = confirm(`Deseja excluir a campanha "${campaign.name}"?`);
      if (!confirmed) return;

      try {
        await deleteCampaign(id);
        await loadCampaigns();
      } catch (error) {
        console.error("Erro ao excluir campanha:", error);
        alert("Não foi possível excluir a campanha.");
      }
    }
  });

  loadCampaigns();
})();
