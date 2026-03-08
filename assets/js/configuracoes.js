(function () {
  "use strict";

  const SUPABASE_URL = window.PORTAL_SUPABASE_URL || window.SUPABASE_URL || "";
  const SUPABASE_ANON_KEY = window.PORTAL_SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY || "";

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Supabase URL/KEY não configurados.");
    const saveStatus = document.getElementById("saveStatus");
    if (saveStatus) {
      saveStatus.textContent = "Erro: Supabase não configurado.";
    }
    return;
  }

  if (!window.supabase || !window.supabase.createClient) {
    console.error("SDK do Supabase não encontrado.");
    const saveStatus = document.getElementById("saveStatus");
    if (saveStatus) {
      saveStatus.textContent = "Erro: SDK do Supabase não carregado.";
    }
    return;
  }

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const form = document.getElementById("portalSettingsForm");
  const saveStatus = document.getElementById("saveStatus");
  const tenantNameEl = document.getElementById("tenantName");
  const fieldsEditor = document.getElementById("fieldsEditor");
  const socialLinksEditor = document.getElementById("socialLinksEditor");

  let currentTenantId = null;
  let currentUser = null;

  const DEFAULT_FIELDS = [
    {
      name: "full_name",
      label: "Nome",
      type: "text",
      placeholder: "Seu nome completo",
      enabled: true,
      required: true,
      order: 1,
    },
    {
      name: "whatsapp",
      label: "WhatsApp",
      type: "tel",
      placeholder: "(31) 99999-9999",
      enabled: true,
      required: true,
      order: 2,
    },
    {
      name: "city",
      label: "Cidade",
      type: "text",
      placeholder: "Sua cidade",
      enabled: true,
      required: false,
      order: 3,
    },
    {
      name: "email",
      label: "E-mail",
      type: "email",
      placeholder: "voce@exemplo.com",
      enabled: false,
      required: false,
      order: 4,
    },
    {
      name: "birthdate",
      label: "Data de nascimento",
      type: "date",
      placeholder: "",
      enabled: false,
      required: false,
      order: 5,
    },
    {
      name: "marketing_consent",
      label: "Aceito receber novidades e promoções",
      type: "checkbox",
      placeholder: "",
      enabled: true,
      required: false,
      order: 6,
    },
  ];

  const DEFAULT_SOCIAL_LINKS = [
    {
      name: "instagram",
      label: "Instagram",
      icon: "instagram",
      url: "",
      enabled: false,
    },
    {
      name: "facebook",
      label: "Facebook",
      icon: "facebook",
      url: "",
      enabled: false,
    },
    {
      name: "whatsapp",
      label: "WhatsApp",
      icon: "whatsapp",
      url: "",
      enabled: false,
    },
    {
      name: "site",
      label: "Site",
      icon: "globe",
      url: "",
      enabled: false,
    },
  ];

  function setStatus(message, isError = false) {
    if (!saveStatus) return;
    saveStatus.textContent = message || "";
    saveStatus.style.color = isError ? "#b42318" : "#067647";
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function safeJsonArray(value, fallback) {
    if (Array.isArray(value)) return structuredClone(value);
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : structuredClone(fallback);
      } catch (_) {
        return structuredClone(fallback);
      }
    }
    return structuredClone(fallback);
  }

  function toInt(value, fallback = 0) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getFormValue(id, fallback = "") {
    const el = byId(id);
    return el ? el.value : fallback;
  }

  function getCheckboxValue(id) {
    const el = byId(id);
    return !!(el && el.checked);
  }

  function setInputValue(id, value) {
    const el = byId(id);
    if (!el) return;
    el.value = value ?? "";
  }

  function setCheckboxValue(id, value) {
    const el = byId(id);
    if (!el) return;
    el.checked = !!value;
  }

  function mergeFields(savedFields) {
    const incoming = safeJsonArray(savedFields, DEFAULT_FIELDS);
    const map = new Map();

    DEFAULT_FIELDS.forEach((f) => {
      map.set(f.name, { ...f });
    });

    incoming.forEach((f) => {
      if (!f || !f.name) return;
      const base = map.get(f.name) || {
        name: f.name,
        label: f.label || f.name,
        type: f.type || "text",
        placeholder: f.placeholder || "",
        enabled: !!f.enabled,
        required: !!f.required,
        order: Number.isFinite(f.order) ? f.order : 999,
      };
      map.set(f.name, {
        ...base,
        ...f,
        enabled: !!f.enabled,
        required: !!f.required,
        order: Number.isFinite(f.order) ? f.order : base.order,
      });
    });

    return Array.from(map.values()).sort((a, b) => (a.order || 999) - (b.order || 999));
  }

  function mergeSocialLinks(savedLinks) {
    const incoming = safeJsonArray(savedLinks, DEFAULT_SOCIAL_LINKS);
    const map = new Map();

    DEFAULT_SOCIAL_LINKS.forEach((item) => {
      map.set(item.name, { ...item });
    });

    incoming.forEach((item) => {
      if (!item || !item.name) return;
      const base = map.get(item.name) || {
        name: item.name,
        label: item.label || item.name,
        icon: item.icon || item.name,
        url: "",
        enabled: false,
      };

      map.set(item.name, {
        ...base,
        ...item,
        enabled: !!item.enabled,
      });
    });

    return Array.from(map.values());
  }

  function renderFieldsEditor(fields) {
    if (!fieldsEditor) return;

    const rows = fields
      .map((field, index) => {
        const disabledRequired = field.type === "checkbox" ? "" : "";
        return `
          <div class="field-row" data-index="${index}" style="display:grid;grid-template-columns:1.3fr .8fr 1.2fr .9fr .9fr .7fr;gap:12px;align-items:end;margin-bottom:14px;padding:12px;border:1px solid #e5e7eb;border-radius:12px;">
            <label>
              <span>Campo</span>
              <input type="text" class="field-label" value="${escapeHtml(field.label || "")}">
            </label>

            <label>
              <span>Tipo</span>
              <select class="field-type">
                <option value="text" ${field.type === "text" ? "selected" : ""}>Texto</option>
                <option value="tel" ${field.type === "tel" ? "selected" : ""}>Telefone</option>
                <option value="email" ${field.type === "email" ? "selected" : ""}>E-mail</option>
                <option value="date" ${field.type === "date" ? "selected" : ""}>Data</option>
                <option value="checkbox" ${field.type === "checkbox" ? "selected" : ""}>Checkbox</option>
              </select>
            </label>

            <label>
              <span>Placeholder</span>
              <input type="text" class="field-placeholder" value="${escapeHtml(field.placeholder || "")}">
            </label>

            <label>
              <span>Ordem</span>
              <input type="number" class="field-order" min="1" value="${escapeHtml(field.order ?? index + 1)}">
            </label>

            <label class="check" style="display:flex;gap:8px;align-items:center;padding-top:28px;">
              <input type="checkbox" class="field-enabled" ${field.enabled ? "checked" : ""}>
              <span>Mostrar</span>
            </label>

            <label class="check" style="display:flex;gap:8px;align-items:center;padding-top:28px;">
              <input type="checkbox" class="field-required" ${field.required ? "checked" : ""} ${disabledRequired}>
              <span>Obrig.</span>
            </label>

            <input type="hidden" class="field-name" value="${escapeHtml(field.name)}">
          </div>
        `;
      })
      .join("");

    fieldsEditor.innerHTML = rows || "<p>Nenhum campo disponível.</p>";
  }

  function renderSocialLinksEditor(links) {
    if (!socialLinksEditor) return;

    socialLinksEditor.innerHTML = links
      .map(
        (item, index) => `
        <div class="social-row" data-index="${index}" style="display:grid;grid-template-columns:1fr 2fr .8fr;gap:12px;align-items:end;margin-bottom:14px;padding:12px;border:1px solid #e5e7eb;border-radius:12px;">
          <label>
            <span>Rede</span>
            <input type="text" class="social-label" value="${escapeHtml(item.label || "")}">
          </label>

          <label>
            <span>URL</span>
            <input type="url" class="social-url" value="${escapeHtml(item.url || "")}" placeholder="https://...">
          </label>

          <label class="check" style="display:flex;gap:8px;align-items:center;padding-top:28px;">
            <input type="checkbox" class="social-enabled" ${item.enabled ? "checked" : ""}>
            <span>Ativo</span>
          </label>

          <input type="hidden" class="social-name" value="${escapeHtml(item.name || "")}">
          <input type="hidden" class="social-icon" value="${escapeHtml(item.icon || "")}">
        </div>
      `
      )
      .join("");
  }

  function readFieldsEditor() {
    if (!fieldsEditor) return structuredClone(DEFAULT_FIELDS);

    const rows = Array.from(fieldsEditor.querySelectorAll(".field-row"));
    const fields = rows.map((row) => {
      const name = row.querySelector(".field-name")?.value || "";
      const label = row.querySelector(".field-label")?.value?.trim() || name;
      const type = row.querySelector(".field-type")?.value || "text";
      const placeholder = row.querySelector(".field-placeholder")?.value || "";
      const order = toInt(row.querySelector(".field-order")?.value, 999);
      const enabled = !!row.querySelector(".field-enabled")?.checked;
      const required = !!row.querySelector(".field-required")?.checked;

      return {
        name,
        label,
        type,
        placeholder,
        enabled,
        required,
        order,
      };
    });

    return fields.sort((a, b) => (a.order || 999) - (b.order || 999));
  }

  function readSocialLinksEditor() {
    if (!socialLinksEditor) return structuredClone(DEFAULT_SOCIAL_LINKS);

    const rows = Array.from(socialLinksEditor.querySelectorAll(".social-row"));
    return rows.map((row) => {
      const name = row.querySelector(".social-name")?.value || "";
      const icon = row.querySelector(".social-icon")?.value || name;
      const label = row.querySelector(".social-label")?.value?.trim() || name;
      const url = row.querySelector(".social-url")?.value?.trim() || "";
      const enabled = !!row.querySelector(".social-enabled")?.checked;

      return {
        name,
        icon,
        label,
        url,
        enabled,
      };
    });
  }

  function applyBgTypeVisibility() {
    const bgType = getFormValue("bg_type", "image");
    const bgColor = byId("bg_color")?.closest("label");
    const bgImage = byId("bg_image_url")?.closest("label");
    const bgVideo = byId("bg_video_url")?.closest("label");

    if (bgColor) bgColor.style.display = bgType === "color" ? "" : "none";
    if (bgImage) bgImage.style.display = bgType === "image" ? "" : "none";
    if (bgVideo) bgVideo.style.display = bgType === "video" ? "" : "none";
  }

  async function getCurrentUser() {
    const { data, error } = await sb.auth.getUser();
    if (error) throw error;
    return data?.user || null;
  }

  async function getTenantIdForUser(userId) {
    const fromMembership = await sb
      .from("tenant_members")
      .select("tenant_id, tenants(name)")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (!fromMembership.error && fromMembership.data?.tenant_id) {
      const tenantName = fromMembership.data.tenants?.name || "Estabelecimento";
      return {
        tenant_id: fromMembership.data.tenant_id,
        tenant_name: tenantName,
      };
    }

    const fromUsers = await sb
      .from("users")
      .select("tenant_id, full_name")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (!fromUsers.error && fromUsers.data?.tenant_id) {
      return {
        tenant_id: fromUsers.data.tenant_id,
        tenant_name: fromUsers.data.full_name || "Estabelecimento",
      };
    }

    throw new Error("Não foi possível identificar o tenant do usuário logado.");
  }

  async function loadPortalSettings(tenantId) {
    const { data, error } = await sb
      .from("portal_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  function populateForm(settings) {
    const safe = settings || {};

    setInputValue("brand_name", safe.brand_name || "");
    setInputValue("logo_url", safe.logo_url || "");
    setInputValue("primary_color", safe.primary_color || "#355e3b");
    setInputValue("accent_color", safe.accent_color || "#d4a373");

    setInputValue("headline", safe.headline || "");
    setInputValue("subheadline", safe.subheadline || "");
    setInputValue("welcome_message", safe.welcome_message || "");

    setInputValue("bg_type", safe.bg_type || "image");
    setInputValue("bg_overlay_strength", safe.bg_overlay_strength ?? 45);
    setInputValue("bg_color", safe.bg_color || "#0f172a");
    setInputValue("bg_image_url", safe.bg_image_url || "");
    setInputValue("bg_video_url", safe.bg_video_url || "");

    setCheckboxValue("terms_enabled", !!safe.terms_enabled);
    setCheckboxValue("terms_required", !!safe.terms_required);
    setInputValue("terms_title", safe.terms_title || "");
    setInputValue("terms_body", safe.terms_body || "");

    setCheckboxValue("splash_enabled", !!safe.splash_enabled);
    setInputValue("splash_dismiss_seconds", safe.splash_dismiss_seconds ?? 5);
    setInputValue("splash_title", safe.splash_title || "");
    setInputValue("splash_image_url", safe.splash_image_url || "");
    setInputValue("splash_message", safe.splash_message || "");
    setInputValue("splash_cta_text", safe.splash_cta_text || "");
    setInputValue("splash_cta_url", safe.splash_cta_url || "");

    setInputValue("footer_text", safe.footer_text || "");
    setInputValue("success_message", safe.success_message || "");
    setInputValue("error_message", safe.error_message || "");

    const fields = mergeFields(safe.fields);
    const socialLinks = mergeSocialLinks(safe.social_links);

    renderFieldsEditor(fields);
    renderSocialLinksEditor(socialLinks);
    applyBgTypeVisibility();
  }

  function collectPayload() {
    return {
      tenant_id: currentTenantId,
      brand_name: getFormValue("brand_name").trim(),
      logo_url: getFormValue("logo_url").trim(),
      primary_color: getFormValue("primary_color", "#355e3b"),
      accent_color: getFormValue("accent_color", "#d4a373"),

      headline: getFormValue("headline").trim(),
      subheadline: getFormValue("subheadline").trim(),
      welcome_message: getFormValue("welcome_message").trim(),

      bg_type: getFormValue("bg_type", "image"),
      bg_overlay_strength: toInt(getFormValue("bg_overlay_strength", "45"), 45),
      bg_color: getFormValue("bg_color", "#0f172a"),
      bg_image_url: getFormValue("bg_image_url").trim(),
      bg_video_url: getFormValue("bg_video_url").trim(),

      fields: readFieldsEditor(),

      terms_enabled: getCheckboxValue("terms_enabled"),
      terms_required: getCheckboxValue("terms_required"),
      terms_title: getFormValue("terms_title").trim(),
      terms_body: getFormValue("terms_body").trim(),

      splash_enabled: getCheckboxValue("splash_enabled"),
      splash_dismiss_seconds: toInt(getFormValue("splash_dismiss_seconds", "5"), 5),
      splash_title: getFormValue("splash_title").trim(),
      splash_message: getFormValue("splash_message").trim(),
      splash_image_url: getFormValue("splash_image_url").trim(),
      splash_cta_text: getFormValue("splash_cta_text").trim(),
      splash_cta_url: getFormValue("splash_cta_url").trim(),

      social_links: readSocialLinksEditor(),
      footer_text: getFormValue("footer_text").trim(),

      success_message: getFormValue("success_message").trim(),
      error_message: getFormValue("error_message").trim(),

      updated_at: new Date().toISOString(),
    };
  }

  function validatePayload(payload) {
    if (!payload.tenant_id) {
      throw new Error("Tenant não identificado.");
    }

    if (payload.bg_type === "image" && payload.bg_image_url && !/^https?:\/\//i.test(payload.bg_image_url)) {
      throw new Error("A URL da imagem de fundo deve começar com http:// ou https://");
    }

    if (payload.bg_type === "video" && payload.bg_video_url && !/^https?:\/\//i.test(payload.bg_video_url)) {
      throw new Error("A URL do vídeo de fundo deve começar com http:// ou https://");
    }

    if (payload.logo_url && !/^https?:\/\//i.test(payload.logo_url)) {
      throw new Error("A URL da logo deve começar com http:// ou https://");
    }

    const enabledFields = payload.fields.filter((f) => f.enabled);
    if (!enabledFields.length) {
      throw new Error("Selecione pelo menos um campo para exibir no captive portal.");
    }

    return true;
  }

  async function savePortalSettings(payload) {
    const { error } = await sb.from("portal_settings").upsert(payload, {
      onConflict: "tenant_id",
    });

    if (error) throw error;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("Salvando...");

    try {
      const payload = collectPayload();
      validatePayload(payload);
      await savePortalSettings(payload);
      setStatus("Configurações salvas com sucesso.");
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Erro ao salvar configurações.", true);
    }
  }

  async function init() {
    try {
      setStatus("Carregando...");
      currentUser = await getCurrentUser();

      if (!currentUser) {
        window.location.href = "/login.html";
        return;
      }

      const membership = await getTenantIdForUser(currentUser.id);
      currentTenantId = membership.tenant_id;

      if (tenantNameEl) {
        tenantNameEl.textContent = membership.tenant_name || "Estabelecimento";
      }

      const settings = await loadPortalSettings(currentTenantId);
      populateForm(settings);

      const bgTypeEl = byId("bg_type");
      if (bgTypeEl) {
        bgTypeEl.addEventListener("change", applyBgTypeVisibility);
      }

      if (form) {
        form.addEventListener("submit", handleSubmit);
      }

      setStatus("");
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Erro ao carregar configurações.", true);
    }
  }

  init();
})();
