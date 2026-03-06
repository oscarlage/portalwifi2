(function(){
  const $ = (id) => document.getElementById(id);

  const SETTINGS = window.PORTAL_SETTINGS || {};
  const apiBase = (SETTINGS.apiBase || "").replace(/\/$/, "");
  const endpoint = apiBase + "/lead";

  let __submitted = false; // evita duplo submit

  // yyyy-mm-dd in local time
  function todayStr(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  function randHex(n){
    const chars = "0123456789abcdef";
    let out = "";
    for (let i=0;i<n;i++) out += chars[Math.floor(Math.random()*chars.length)];
    return out;
  }

  // Pseudo-MAC (12 hex) — usado APENAS quando ainda não há MikroTik/Hotspot.
  // O Worker está com DEV_ALLOW_FAKE_MAC=true, então isso serve para identificar device e testar o fluxo.
  function getOrCreateFakeMac(){
    const key = "portal_fake_mac_v1";
    let mac = localStorage.getItem(key);
    if (!mac){
      mac = randHex(12);
      localStorage.setItem(key, mac);
    }
    // formato clássico: aa:bb:cc:dd:ee:ff
    return mac.match(/.{1,2}/g).join(":");
  }

  function getDeviceName(){
    const ua = navigator.userAgent || "";
    const plat = navigator.platform || "";
    const lang = navigator.language || "";
    return `ua:${ua.slice(0,90)} | p:${plat.slice(0,24)} | l:${lang}`;
  }

  function digitsOnly(s){ return (s||"").replace(/\D+/g,""); }

  function formatBRPhone(raw){
    const d = digitsOnly(raw);
    if (d.length === 11){
      return `(${d.slice(0,2)}) ${d.slice(2,3)}${d.slice(3,7)}-${d.slice(7,11)}`;
    }
    if (d.length === 10){
      return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6,10)}`;
    }
    return raw;
  }

  function setStatus(msg, kind){
    const el = $("statusLine");
    if (!el) return;
    el.textContent = msg || "";
    el.dataset.kind = kind || "";
  }

  function setLoading(on){
    const btn = $("submitBtn");
    if (!btn) return;
    btn.disabled = !!on;
    const spin = btn.querySelector(".btn-spin");
    const txt = btn.querySelector(".btn-text");
    if (spin) spin.style.display = on ? "inline-block" : "none";
    if (txt) txt.textContent = on ? "Enviando..." : "Conectar";
  }

  function readQueryParams(){
    const p = new URLSearchParams(location.search);
    return {
      // MikroTik hotspot redirect params
      dst: p.get("dst") || "",
      ip: p.get("ip") || "",
      link_login: p.get("link-login") || "",
      link_login_only: p.get("link-login-only") || "", // ✅ preferir este
      link_orig: p.get("link-orig") || "",

      // mac pode vir do hotspot redirect
      mac: p.get("mac") || p.get("mac_address") || "",

      // campanha por QR específico (?campaign_id=UUID)
      campaign_id: p.get("campaign_id") || ""
    };
  }

  function hotspotLogin(linkLogin, dst){
    // autentica no hotspot para liberar internet
    const safeDst = dst || "http://neverssl.com/";
    const form = document.createElement("form");
    form.method = "POST";
    form.action = linkLogin;

    const u = document.createElement("input");
    u.type = "hidden"; u.name = "username"; u.value = "portal";

    const p = document.createElement("input");
    p.type = "hidden"; p.name = "password"; p.value = "portal";

    const d = document.createElement("input");
    d.type = "hidden"; d.name = "dst"; d.value = safeDst;

    form.appendChild(u);
    form.appendChild(p);
    form.appendChild(d);
    document.body.appendChild(form);

    setStatus("Liberando internet…", "ok");
    form.submit();
  }

  function init(){
    const yearEl = $("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    const qp = readQueryParams();

    const tenantSlug = SETTINGS.tenantSlug || "";
    const campaignId = qp.campaign_id || SETTINGS.defaultCampaignId || "";

    $("tenant_slug").value = tenantSlug;
    $("campaign_id").value = campaignId;

    const mac = (qp.mac || "").trim() || getOrCreateFakeMac();
    $("mac_address").value = mac;

    const devName = getDeviceName();
    $("device_name").value = devName;

    const deviceLabel = $("deviceLabel");
    if (deviceLabel) deviceLabel.textContent = mac.toUpperCase();

    const phoneEl = $("phone");
    if (phoneEl){
      phoneEl.addEventListener("input", () => {
        const d = digitsOnly(phoneEl.value);
        if (d.length >= 10) phoneEl.value = formatBRPhone(phoneEl.value);
      });
    }

    const form = $("leadForm");
    if (!form) return;

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      setStatus("", "");

      if (__submitted) return;
      __submitted = true;

      // validação mínima
      const full_name = $("full_name").value.trim();
      const phone = digitsOnly($("phone").value);
      const city = $("city").value.trim();
      const marketing_optin = !!$("marketing_optin").checked;
      const lgpd = !!$("lgpd").checked;

      if (full_name.length < 2){
        setStatus("Informe seu nome.", "warn");
        $("full_name").focus();
        __submitted = false;
        return;
      }
      if (phone.length < 10){
        setStatus("Informe um WhatsApp válido (com DDD).", "warn");
        $("phone").focus();
        __submitted = false;
        return;
      }
      if (!lgpd){
        setStatus("Para continuar, aceite os termos (LGPD).", "warn");
        $("lgpd").focus();
        __submitted = false;
        return;
      }

      const payload = {
        full_name,
        phone, // envia só dígitos para dedup e normalização
        city: city || null,
        marketing_optin,
        source: $("source").value || "portal",
        tenant_slug: $("tenant_slug").value || null,
        campaign_id: $("campaign_id").value || null,

        // device info
        mac_address: $("mac_address").value || null,
        device_name: $("device_name").value || null,

        // hotspot hints (opcional; ajuda debug/telemetria)
        hotspot_ip: qp.ip || null
      };

      setLoading(true);
      try{
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type":"application/json" },
          body: JSON.stringify(payload),
          credentials: "omit"
        });

        const text = await res.text();
        let data = null;
        try{ data = JSON.parse(text); }catch(_){}

        if (!res.ok){
          const msg = (data && (data.error || data.message)) ? (data.error || data.message) : ("Erro HTTP " + res.status);
          throw new Error(msg);
        }
        if (!data || data.ok !== true){
          throw new Error("Resposta inválida da API.");
        }

        // ✅ Se veio do MikroTik Hotspot, autentica para liberar internet
        const loginUrl = qp.link_login_only || qp.link_login;
        if (loginUrl) {
          hotspotLogin(loginUrl, qp.dst || qp.link_orig || "http://neverssl.com/");
          return; // não executa o redirect para success
        }

        // fallback: sem hotspot (testes), vai para success
        const u = new URL("/success.html", location.origin);
        if (data.lead_id) u.searchParams.set("lead_id", data.lead_id);
        if (typeof data.inserted === "boolean") u.searchParams.set("inserted", String(data.inserted));
        if (typeof data.deduped === "boolean") u.searchParams.set("deduped", String(data.deduped));
        u.searchParams.set("phone", phone);
        location.href = u.toString();

      }catch(err){
        console.error(err);
        const msg = (err && err.message) ? err.message : String(err);
        setStatus("Falha ao conectar: " + msg, "danger");
        __submitted = false;
      }finally{
        setLoading(false);
      }
    });

    // ping visual
    setStatus("Pronto para conectar • " + todayStr(), "ok");
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
