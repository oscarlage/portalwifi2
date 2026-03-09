(function () {
  "use strict";

  const SETTINGS = window.PORTAL_SETTINGS || {};
  const API_BASE = String(SETTINGS.apiBase || "").replace(/\/$/, "");
  const TENANT_ID = SETTINGS.tenantId || "";

  const campaignTable = document.getElementById("campaignTable");
  const campaignModal = document.getElementById("campaignModal");
  const campaignForm = document.getElementById("campaignForm");
  const campaignModalTitle = document.getElementById("campaignModalTitle");

  const openCampaignModalBtn = document.getElementById("openCampaignModal");
  const closeCampaignModalBtn = document.getElementById("closeCampaignModal");
  const cancelCampaignModalBtn = document.getElementById("cancelCampaignModal");
  const deleteCampaignBtn = document.getElementById("deleteCampaignBtn");

  const campaignId = document.getElementById("campaignId");
  const campaignTitle = document.getElementById("campaignTitle");
  const campaignSubtitle = document.getElementById("campaignSubtitle");
  const campaignMessage = document.getElementById("campaignMessage");
  const campaignImageUrl = document.getElementById("campaignImageUrl");
  const campaignCouponCode = document.getElementById("campaignCouponCode");

  const campaignButtonLabel = document.getElementById("campaignButtonLabel");
  const campaignButtonUrl = document.getElementById("campaignButtonUrl");
  const campaignInstagramUrl = document.getElementById("campaignInstagramUrl");
  const campaignFacebookUrl = document.getElementById("campaignFacebookUrl");
  const campaignWhatsappUrl = document.getElementById("campaignWhatsappUrl");

  const campaignType = document.getElementById("campaignType");
  const campaignActive = document.getElementById("campaignActive");
  const campaignStartsAt = document.getElementById("campaignStartsAt");
  const campaignEndsAt = document.getElementById("campaignEndsAt");
  const campaignPriority = document.getElementById("campaignPriority");

  const cfgShowTitle = document.getElementById("cfgShowTitle");
  const cfgShowSubtitle = document.getElementById("cfgShowSubtitle");
  const cfgShowMessage = document.getElementById("cfgShowMessage");
  const cfgShowImage = document.getElementById("cfgShowImage");
  const cfgShowButton = document.getElementById("cfgShowButton");
  const cfgShowSocials = document.getElementById("cfgShowSocials");
  const cfgShowCoupon = document.getElementById("cfgShowCoupon");

  const campaignPreview = document.getElementById("campaignPreview");
  const campaignPreviewMeta = document.getElementById("campaignPreviewMeta");

  let campaignsCache = [];
  let isSaving = false;

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function isValidHttpUrl(value) {
    if (!value) return false;
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";

    return d.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    });
  }

  function formatDateRange(startsAt, endsAt) {
    if (!startsAt && !endsAt) return "Sem período";
    if (startsAt && !endsAt) return `A partir de ${formatDateTime(startsAt)}`;
    if (!startsAt && endsAt) return `Até ${formatDateTime(endsAt)}`;
    return `${formatDateTime(startsAt)} até ${formatDateTime(endsAt)}`;
  }

  function typeLabel(value) {
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

  function activeBadge(active) {
    return active
      ? '<span class="status-badge status-active">Ativa</span>'
      : '<span class="status-badge status-inactive">Inativa</span>';
  }

  function typeBadge(type) {
    return `<span class="type-badge">${escapeHtml(typeLabel(type))}</span>`;
  }

  function inputDateTimeValue(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  function toIsoDateTime(localValue) {
    if (!localValue) return null;
    const d = new Date(localValue);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  function safeJsonParse(value, fallback) {
    try {
      if (typeof value === "object" && value !== null) return value;
      if (!value) return fallback;
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function getDefaultRenderConfig() {
    return {
      show_title: true,
      show_subtitle: true,
      show_message: true,
      show_image: true,
      show_button: true,
      show_socials: true,
      show_coupon: true
    };
  }

  function getRenderConfigFromForm() {
    return {
      show_title: cfgShowTitle.checked,
      show_subtitle: cfgShowSubtitle.checked,
      show_message: cfgShowMessage.checked,
      show_image: cfgShowImage.checked,
      show_button: cfgShowButton.checked,
      show_socials: cfgShowSocials.checked,
      show_coupon: cfgShowCoupon.checked
    };
  }

  function applyRenderConfigToForm(config) {
    const cfg = { ...getDefaultRenderConfig(), ...safeJsonParse(config, {}) };

    cfgShowTitle.checked = !!cfg.show_title;
    cfgShowSubtitle.checked = !!cfg.show_subtitle;
    cfgShowMessage.checked = !!cfg.show_message;
    cfgShowImage.checked = !!cfg.show_image;
    cfgShowButton.checked = !!cfg.show_button;
    cfgShowSocials.checked = !!cfg.show_socials;
    cfgShowCoupon.checked = !!cfg.show_coupon;
  }

  function resetForm() {
    campaignForm.reset();
    campaignId.value = "";
    campaignType.value = "portal";
    campaignActive.value = "true";
    campaignPriority.value = "0";
    applyRenderConfigToForm(getDefaultRenderConfig());
    deleteCampaignBtn.classList.add("hidden");
    campaignModalTitle.textContent = "Nova campanha";
    renderPreview();
  }

  function openModal(editMode) {
    campaignModal.classList.add("show");
    campaignModal.setAttribute("aria-hidden", "false");
    campaignModalTitle.textContent = editMode ? "Editar campanha" : "Nova campanha";
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    campaignModal.classList.remove("show");
    campaignModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
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

  function normalizeCampaign(item) {
    return {
      id: item.id,
      tenant_id: item.tenant_id,
      title: item.title || "",
      subtitle: item.subtitle || "",
      message: item.message || "",
      image_url: item.image_url || "",
      button_label: item.button_label || item.cta_label || "",
      button_url: item.button_url || item.cta_url || "",
      instagram_url: item.instagram_url || "",
      facebook_url: item.facebook_url || "",
      whatsapp_url: item.whatsapp_url || "",
      coupon_code: item.coupon_code || "",
      active: typeof item.active === "boolean" ? item.active : true,
      starts_at: item.starts_at || null,
      ends_at: item.ends_at || null,
      campaign_type: item.campaign_type || "portal",
      priority: Number(item.priority || 0),
      render_config: {
        ...getDefaultRenderConfig(),
        ...safeJsonParse(item.render_config, {})
      },
      created_at: item.created_at || null,
      updated_at: item.updated_at || null
    };
  }

  function renderTable(items) {
    if (!items.length) {
      campaignTable.innerHTML = `
        <tr>
          <td colspan="6" class="muted-center">Nenhuma campanha criada ainda.</td>
        </tr>
      `;
      return;
    }

    campaignTable.innerHTML = items.map((item) => {
      return `
        <tr>
          <td>${escapeHtml(item.title || "-")}</td>
          <td>${typeBadge(item.campaign_type)}</td>
          <td>${activeBadge(!!item.active)}</td>
          <td>${escapeHtml(formatDateRange(item.starts_at, item.ends_at))}</td>
          <td>${Number(item.priority || 0)}</td>
          <td>
            <button type="button" class="table-action" data-action="edit" data-id="${item.id}">Editar</button>
            <button type="button" class="table-action" data-action="delete" data-id="${item.id}">Excluir</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  async function loadCampaigns() {
    if (!TENANT_ID) {
      campaignTable.innerHTML = `
        <tr>
          <td colspan="6" class="muted-center">tenantId não configurado em window.PORTAL_SETTINGS.</td>
        </tr>
      `;
      return;
    }

    try {
      campaignTable.innerHTML = `
        <tr>
          <td colspan="6" class="muted-center">Carregando campanhas...</td>
        </tr>
      `;

      const data = await apiFetch(
        `${API_BASE}/api/admin/campaigns?tenant_id=${encodeURIComponent(TENANT_ID)}`
      );

      const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
      campaignsCache = items
        .map(normalizeCampaign)
        .sort((a, b) => {
          const p = Number(b.priority || 0) - Number(a.priority || 0);
          if (p !== 0) return p;
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });

      renderTable(campaignsCache);
    } catch (error) {
      console.error("Erro ao carregar campanhas:", error);
      campaignTable.innerHTML = `
        <tr>
          <td colspan="6" class="muted-center">Erro ao carregar campanhas.</td>
        </tr>
      `;
    }
  }

  function getPayloadFromForm() {
    return {
      tenant_id: TENANT_ID,
      title: campaignTitle.value.trim(),
      subtitle: campaignSubtitle.value.trim() || null,
      message: campaignMessage.value.trim(),
      image_url: campaignImageUrl.value.trim() || null,
      button_label: campaignButtonLabel.value.trim() || null,
      button_url: campaignButtonUrl.value.trim() || null,
      instagram_url: campaignInstagramUrl.value.trim() || null,
      facebook_url: campaignFacebookUrl.value.trim() || null,
      whatsapp_url: campaignWhatsappUrl.value.trim() || null,
      coupon_code: campaignCouponCode.value.trim() || null,
      active: campaignActive.value === "true",
      starts_at: toIsoDateTime(campaignStartsAt.value),
      ends_at: toIsoDateTime(campaignEndsAt.value),
      campaign_type: campaignType.value || "portal",
      priority: Number(campaignPriority.value || 0),
      render_config: getRenderConfigFromForm()
    };
  }

  function validatePayload(payload) {
    if (!TENANT_ID) {
      return "tenantId não configurado.";
    }

    if (!payload.title) {
      return "Informe o título da campanha.";
    }

    if (!payload.message) {
      return "Informe a mensagem da campanha.";
    }

    if (payload.button_url && !isValidHttpUrl(payload.button_url)) {
      return "A URL do botão é inválida.";
    }

    if (payload.image_url && !isValidHttpUrl(payload.image_url)) {
      return "A URL da imagem é inválida.";
    }

    if (payload.instagram_url && !isValidHttpUrl(payload.instagram_url)) {
      return "A URL do Instagram é inválida.";
    }

    if (payload.facebook_url && !isValidHttpUrl(payload.facebook_url)) {
      return "A URL do Facebook é inválida.";
    }

    if (payload.whatsapp_url && !isValidHttpUrl(payload.whatsapp_url)) {
      return "A URL do WhatsApp é inválida.";
    }

    if (payload.starts_at && payload.ends_at) {
      const starts = new Date(payload.starts_at).getTime();
      const ends = new Date(payload.ends_at).getTime();
      if (starts > ends) {
        return "A data final deve ser maior ou igual à data inicial.";
      }
    }

    if (payload.render_config.show_button && (!payload.button_label || !payload.button_url)) {
      return "Para exibir o botão, informe texto e URL do botão.";
    }

    return null;
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

  function fillForm(item) {
    campaignId.value = item.id || "";
    campaignTitle.value = item.title || "";
    campaignSubtitle.value = item.subtitle || "";
    campaignMessage.value = item.message || "";
    campaignImageUrl.value = item.image_url || "";
    campaignCouponCode.value = item.coupon_code || "";

    campaignButtonLabel.value = item.button_label || "";
    campaignButtonUrl.value = item.button_url || "";
    campaignInstagramUrl.value = item.instagram_url || "";
    campaignFacebookUrl.value = item.facebook_url || "";
    campaignWhatsappUrl.value = item.whatsapp_url || "";

    campaignType.value = item.campaign_type || "portal";
    campaignActive.value = item.active ? "true" : "false";
    campaignStartsAt.value = inputDateTimeValue(item.starts_at);
    campaignEndsAt.value = inputDateTimeValue(item.ends_at);
    campaignPriority.value = String(Number(item.priority || 0));

    applyRenderConfigToForm(item.render_config || getDefaultRenderConfig());

    deleteCampaignBtn.classList.remove("hidden");
    campaignModalTitle.textContent = "Editar campanha";
    renderPreview();
  }

  function getFormState() {
    return {
      title: campaignTitle.value.trim(),
      subtitle: campaignSubtitle.value.trim(),
      message: campaignMessage.value.trim(),
      image_url: campaignImageUrl.value.trim(),
      coupon_code: campaignCouponCode.value.trim(),
      button_label: campaignButtonLabel.value.trim(),
      button_url: campaignButtonUrl.value.trim(),
      instagram_url: campaignInstagramUrl.value.trim(),
      facebook_url: campaignFacebookUrl.value.trim(),
      whatsapp_url: campaignWhatsappUrl.value.trim(),
      active: campaignActive.value === "true",
      starts_at: toIsoDateTime(campaignStartsAt.value),
      ends_at: toIsoDateTime(campaignEndsAt.value),
      campaign_type: campaignType.value || "portal",
      priority: Number(campaignPriority.value || 0),
      render_config: getRenderConfigFromForm()
    };
  }

  function renderPreview() {
    const state = getFormState();
    const cfg = state.render_config || getDefaultRenderConfig();

    const imageBlock = cfg.show_image
      ? (state.image_url && isValidHttpUrl(state.image_url)
          ? `
            <div class="preview-image">
              <img src="${escapeHtml(state.image_url)}" alt="${escapeHtml(state.title || "Campanha")}">
            </div>
          `
          : `
            <div class="preview-image placeholder">
              Banner / imagem da campanha
            </div>
          `)
      : "";

    const titleBlock = cfg.show_title && state.title
      ? `<h2 class="preview-title">${escapeHtml(state.title)}</h2>`
      : "";

    const subtitleBlock = cfg.show_subtitle && state.subtitle
      ? `<p class="preview-subtitle">${escapeHtml(state.subtitle)}</p>`
      : "";

    const messageBlock = cfg.show_message && state.message
      ? `<div class="preview-message">${escapeHtml(state.message)}</div>`
      : "";

    const couponBlock = cfg.show_coupon && state.coupon_code
      ? `<div class="preview-coupon">Cupom: <strong>${escapeHtml(state.coupon_code)}</strong></div>`
      : "";

    const buttonBlock = cfg.show_button && state.button_label && state.button_url
      ? `<a class="preview-button" href="#" onclick="return false;">${escapeHtml(state.button_label)}</a>`
      : "";

    const socialLinks = [];
    if (state.instagram_url) {
      socialLinks.push(`<a href="#" onclick="return false;">Instagram</a>`);
    }
    if (state.facebook_url) {
      socialLinks.push(`<a href="#" onclick="return false;">Facebook</a>`);
    }
    if (state.whatsapp_url) {
      socialLinks.push(`<a href="#" onclick="return false;">WhatsApp</a>`);
    }

    const socialsBlock = cfg.show_socials && socialLinks.length
      ? `<div class="preview-socials">${socialLinks.join("")}</div>`
      : "";

    const nothingVisible =
      !imageBlock &&
      !titleBlock &&
      !subtitleBlock &&
      !messageBlock &&
      !couponBlock &&
      !buttonBlock &&
      !socialsBlock;

    campaignPreview.innerHTML = nothingVisible
      ? `<div class="preview-message">Nenhum elemento visível foi marcado para renderização.</div>`
      : `
          ${imageBlock}
          ${titleBlock}
          ${subtitleBlock}
          ${messageBlock}
          ${couponBlock}
          ${buttonBlock}
          ${socialsBlock}
        `;

    campaignPreviewMeta.innerHTML = `
      <div class="meta-item"><span>Tipo</span><strong>${escapeHtml(typeLabel(state.campaign_type))}</strong></div>
      <div class="meta-item"><span>Status</span><strong>${state.active ? "Ativa" : "Inativa"}</strong></div>
      <div class="meta-item"><span>Período</span><strong>${escapeHtml(formatDateRange(state.starts_at, state.ends_at))}</strong></div>
      <div class="meta-item"><span>Prioridade</span><strong>${state.priority}</strong></div>
      <div class="meta-item"><span>Botão</span><strong>${cfg.show_button ? "Visível" : "Oculto"}</strong></div>
      <div class="meta-item"><span>Redes sociais</span><strong>${cfg.show_socials ? "Visíveis" : "Ocultas"}</strong></div>
      <div class="meta-item"><span>Imagem</span><strong>${cfg.show_image ? "Visível" : "Oculta"}</strong></div>
    `;
  }

  function getCampaignById(id) {
    return campaignsCache.find((item) => String(item.id) === String(id)) || null;
  }

  async function handleSave(event) {
    event.preventDefault();
    if (isSaving) return;

    try {
      const payload = getPayloadFromForm();
      const error = validatePayload(payload);

      if (error) {
        alert(error);
        return;
      }

      isSaving = true;

      if (campaignId.value) {
        await updateCampaign(campaignId.value, payload);
      } else {
        await createCampaign(payload);
      }

      closeModal();
      await loadCampaigns();
    } catch (err) {
      console.error("Erro ao salvar campanha:", err);
      alert("Não foi possível salvar a campanha.");
    } finally {
      isSaving = false;
    }
  }

  async function handleDeleteById(id, title) {
    const confirmed = confirm(`Deseja excluir a campanha "${title}"?`);
    if (!confirmed) return;

    try {
      await deleteCampaign(id);
      closeModal();
      await loadCampaigns();
    } catch (err) {
      console.error("Erro ao excluir campanha:", err);
      alert("Não foi possível excluir a campanha.");
    }
  }

  function bindPreviewInputs() {
    [
      campaignTitle,
      campaignSubtitle,
      campaignMessage,
      campaignImageUrl,
      campaignCouponCode,
      campaignButtonLabel,
      campaignButtonUrl,
      campaignInstagramUrl,
      campaignFacebookUrl,
      campaignWhatsappUrl,
      campaignType,
      campaignActive,
      campaignStartsAt,
      campaignEndsAt,
      campaignPriority,
      cfgShowTitle,
      cfgShowSubtitle,
      cfgShowMessage,
      cfgShowImage,
      cfgShowButton,
      cfgShowSocials,
      cfgShowCoupon
    ].forEach((el) => {
      if (!el) return;
      el.addEventListener("input", renderPreview);
      el.addEventListener("change", renderPreview);
    });
  }

  openCampaignModalBtn.addEventListener("click", () => {
    resetForm();
    openModal(false);
  });

  closeCampaignModalBtn.addEventListener("click", closeModal);
  cancelCampaignModalBtn.addEventListener("click", closeModal);

  campaignModal.addEventListener("click", (event) => {
    if (event.target === campaignModal) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && campaignModal.classList.contains("show")) {
      closeModal();
    }
  });

  campaignForm.addEventListener("submit", handleSave);

  deleteCampaignBtn.addEventListener("click", async () => {
    const id = campaignId.value;
    if (!id) return;
    const item = getCampaignById(id);
    if (!item) return;
    await handleDeleteById(id, item.title || "sem título");
  });

  campaignTable.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const id = button.dataset.id;
    const action = button.dataset.action;
    const item = getCampaignById(id);

    if (!item) return;

    if (action === "edit") {
      fillForm(item);
      openModal(true);
      return;
    }

    if (action === "delete") {
      await handleDeleteById(item.id, item.title || "sem título");
    }
  });

  bindPreviewInputs();
  resetForm();
  loadCampaigns();
})();
