(function () {
  const SETTINGS = window.PORTAL_SETTINGS || {};
  const API_BASE = (SETTINGS.apiBase || "").replace(/\/$/, "");
  const TENANT_ID = SETTINGS.tenantId || "";

  const campaignTable = document.getElementById("campaignTable");
  const campaignModal = document.getElementById("campaignModal");
  const campaignForm = document.getElementById("campaignForm");
  const campaignModalTitle = document.getElementById("campaignModalTitle");

  const openCampaignModalBtn = document.getElementById("openCampaignModal");
  const closeCampaignModalBtn = document.getElementById("closeCampaignModal");
  const cancelCampaignModalBtn = document.getElementById("cancelCampaignModal");

  const campaignId = document.getElementById("campaignId");
  const campaignTitle = document.getElementById("campaignTitle");
  const campaignMessage = document.getElementById("campaignMessage");
  const campaignType = document.getElementById("campaignType");
  const audienceType = document.getElementById("audienceType");
  const campaignStartsAt = document.getElementById("campaignStartsAt");
  const campaignEndsAt = document.getElementById("campaignEndsAt");
  const campaignCouponCode = document.getElementById("campaignCouponCode");
  const campaignPriority = document.getElementById("campaignPriority");
  const campaignCtaLabel = document.getElementById("campaignCtaLabel");
  const campaignCtaUrl = document.getElementById("campaignCtaUrl");
  const campaignImageUrl = document.getElementById("campaignImageUrl");
  const campaignActive = document.getElementById("campaignActive");

  let campaignsCache = [];

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function openModal(editMode = false) {
    campaignModal.classList.add("show");
    campaignModalTitle.textContent = editMode ? "Editar campanha" : "Nova campanha";
  }

  function closeModal() {
    campaignModal.classList.remove("show");
    campaignForm.reset();
    campaignId.value = "";
    campaignPriority.value = 0;
    campaignActive.value = "true";
  }

  function formatDate(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    });
  }

  function formatPeriod(startsAt, endsAt) {
    if (!startsAt && !endsAt) return "Sem período";
    return `${formatDate(startsAt)} até ${formatDate(endsAt)}`;
  }

  function formatCampaignType(value) {
    const map = {
      portal: "Portal",
      post_login: "Pós-login",
      coupon: "Cupom",
      birthday: "Aniversário",
      returning_customer: "Cliente recorrente",
      inactive_customer: "Cliente inativo"
    };
    return map[value] || value || "-";
  }

  function formatAudienceType(value) {
    const map = {
      all: "Todos",
      new_customers: "Novos clientes",
      returning_customers: "Recorrentes",
      inactive_30d: "Inativos 30d",
      inactive_60d: "Inativos 60d",
      birthday_month: "Aniversariantes",
      consent_marketing: "Consentimento marketing"
    };
    return map[value] || value || "-";
  }

  function formatActive(active) {
    return active
      ? '<span class="status-badge status-active">Ativa</span>'
      : '<span class="status-badge status-inactive">Inativa</span>';
  }

  function toInputDateTime(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "";

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  function fromInputDateTime(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  async function apiFetch(url, options = {}) {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json"
      },
      ...options
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(errorText || `Erro HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }

    return null;
  }

  function renderCampaigns(items) {
    if (!items.length) {
      campaignTable.innerHTML = `
        <tr>
          <td colspan="7" class="muted">Nenhuma campanha criada ainda.</td>
        </tr>
      `;
      return;
    }

    campaignTable.innerHTML = items.map(item => `
      <tr>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(formatCampaignType(item.campaign_type))}</td>
        <td>${escapeHtml(formatAudienceType(item.audience_type))}</td>
        <td>${formatActive(!!item.active)}</td>
        <td>${escapeHtml(formatPeriod(item.starts_at, item.ends_at))}</td>
        <td>${Number(item.priority || 0)}</td>
        <td>
          <button class="table-action" data-action="edit" data-id="${item.id}">Editar</button>
          <button class="table-action" data-action="delete" data-id="${item.id}">Excluir</button>
        </td>
      </tr>
    `).join("");
  }

  async function loadCampaigns() {
    try {
      campaignTable.innerHTML = `
        <tr>
          <td colspan="7" class="muted">Carregando campanhas...</td>
        </tr>
      `;

      const data = await apiFetch(`${API_BASE}/api/admin/campaigns?tenant_id=${encodeURIComponent(TENANT_ID)}`);
      campaignsCache = Array.isArray(data) ? data : (data.items || []);

      campaignsCache.sort((a, b) => {
        const pa = Number(a.priority || 0);
        const pb = Number(b.priority || 0);
        if (pb !== pa) return pb - pa;
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });

      renderCampaigns(campaignsCache);
    } catch (err) {
      console.error(err);
      campaignTable.innerHTML = `
        <tr>
          <td colspan="7" class="muted">Erro ao carregar campanhas.</td>
        </tr>
      `;
    }
  }

  function fillForm(item) {
    campaignId.value = item.id || "";
    campaignTitle.value = item.title || "";
    campaignMessage.value = item.message || "";
    campaignType.value = item.campaign_type || "portal";
    audienceType.value = item.audience_type || "all";
    campaignStartsAt.value = toInputDateTime(item.starts_at);
    campaignEndsAt.value = toInputDateTime(item.ends_at);
    campaignCouponCode.value = item.coupon_code || "";
    campaignPriority.value = Number(item.priority || 0);
    campaignCtaLabel.value = item.cta_label || "";
    campaignCtaUrl.value = item.cta_url || "";
    campaignImageUrl.value = item.image_url || "";
    campaignActive.value = item.active ? "true" : "false";
  }

  function getPayload() {
    return {
      tenant_id: TENANT_ID,
      title: campaignTitle.value.trim(),
      message: campaignMessage.value.trim(),
      active: campaignActive.value === "true",
      starts_at: fromInputDateTime(campaignStartsAt.value),
      ends_at: fromInputDateTime(campaignEndsAt.value),
      campaign_type: campaignType.value,
      audience_type: audienceType.value,
      coupon_code: campaignCouponCode.value.trim() || null,
      cta_label: campaignCtaLabel.value.trim() || null,
      cta_url: campaignCtaUrl.value.trim() || null,
      image_url: campaignImageUrl.value.trim() || null,
      priority: Number(campaignPriority.value || 0)
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

  async function removeCampaign(id) {
    return apiFetch(`${API_BASE}/api/admin/campaigns/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
  }

  openCampaignModalBtn.addEventListener("click", () => {
    closeModal();
    openModal(false);
  });

  closeCampaignModalBtn.addEventListener("click", closeModal);
  cancelCampaignModalBtn.addEventListener("click", closeModal);

  campaignModal.addEventListener("click", (e) => {
    if (e.target === campaignModal) closeModal();
  });

  campaignForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      if (!TENANT_ID) {
        alert("tenantId não configurado.");
        return;
      }

      const payload = getPayload();

      if (!payload.title || !payload.message) {
        alert("Preencha título e mensagem.");
        return;
      }

      if (payload.starts_at && payload.ends_at && payload.starts_at > payload.ends_at) {
        alert("A data final deve ser maior que a data inicial.");
        return;
      }

      if (campaignId.value) {
        await updateCampaign(campaignId.value, payload);
      } else {
        await createCampaign(payload);
      }

      closeModal();
      await loadCampaigns();
    } catch (err) {
      console.error(err);
      alert("Não foi possível salvar a campanha.");
    }
  });

  campaignTable.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const item = campaignsCache.find(c => String(c.id) === String(id));

    if (!item) return;

    if (action === "edit") {
      fillForm(item);
      openModal(true);
      return;
    }

    if (action === "delete") {
      const ok = confirm(`Deseja excluir a campanha "${item.title}"?`);
      if (!ok) return;

      try {
        await removeCampaign(id);
        await loadCampaigns();
      } catch (err) {
        console.error(err);
        alert("Não foi possível excluir a campanha.");
      }
    }
  });

  loadCampaigns();
})();
