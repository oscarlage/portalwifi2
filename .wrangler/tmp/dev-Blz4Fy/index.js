var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var HttpError = class extends Error {
  static {
    __name(this, "HttpError");
  }
  status;
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
var CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, x-requested-with"
};
var JSON_HEADERS = {
  ...CORS_HEADERS,
  "content-type": "application/json; charset=utf-8"
};
function json(data, init) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...init?.headers || {}
    }
  });
}
__name(json, "json");
function empty(init) {
  return new Response(null, {
    ...init,
    headers: {
      ...CORS_HEADERS,
      ...init?.headers || {}
    }
  });
}
__name(empty, "empty");
function getSupabaseConfig(env) {
  const url = env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new HttpError(500, "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY n\xE3o configurados.");
  }
  return { url, serviceRoleKey };
}
__name(getSupabaseConfig, "getSupabaseConfig");
function createSupabaseHeaders(serviceRoleKey, extra) {
  const headers = new Headers(extra);
  headers.set("apikey", serviceRoleKey);
  headers.set("authorization", `Bearer ${serviceRoleKey}`);
  return headers;
}
__name(createSupabaseHeaders, "createSupabaseHeaders");
async function parseJsonBody(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "JSON inv\xE1lido no corpo da requisi\xE7\xE3o.");
  }
}
__name(parseJsonBody, "parseJsonBody");
async function readSupabaseResponse(response) {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") && text ? JSON.parse(text) : null;
  if (!response.ok) {
    const errorMessage = typeof payload === "object" && payload !== null ? payload.message || payload.error || payload.details : "";
    throw new HttpError(response.status, errorMessage || `Erro Supabase ${response.status}`);
  }
  return payload ?? null;
}
__name(readSupabaseResponse, "readSupabaseResponse");
async function supabaseSelect(env, path) {
  const { url, serviceRoleKey } = getSupabaseConfig(env);
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: createSupabaseHeaders(serviceRoleKey, {
      accept: "application/json"
    })
  });
  return readSupabaseResponse(response);
}
__name(supabaseSelect, "supabaseSelect");
async function supabaseMutate(env, path, init = {}) {
  const { url, serviceRoleKey } = getSupabaseConfig(env);
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: createSupabaseHeaders(serviceRoleKey, {
      accept: "application/json",
      prefer: "return=representation",
      ...init.headers || {}
    })
  });
  return readSupabaseResponse(response);
}
__name(supabaseMutate, "supabaseMutate");
async function supabaseRpc(env, fnName, payload) {
  return supabaseMutate(env, `rpc/${fnName}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}
__name(supabaseRpc, "supabaseRpc");
function normalizePhone(value) {
  const digits = String(value || "").replace(/\D+/g, "");
  return digits || null;
}
__name(normalizePhone, "normalizePhone");
function normalizeMac(value) {
  const compact = String(value || "").replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  if (compact.length !== 12) {
    return null;
  }
  return compact.match(/.{1,2}/g)?.join(":") || null;
}
__name(normalizeMac, "normalizeMac");
function normalizeText(value) {
  const text = String(value || "").trim();
  return text ? text : null;
}
__name(normalizeText, "normalizeText");
function isUuid(value) {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
__name(isUuid, "isUuid");
function toDateOnly(value) {
  return value.toISOString().slice(0, 10);
}
__name(toDateOnly, "toDateOnly");
function getDateRange(searchParams) {
  const period = searchParams.get("period") || "today";
  const now = /* @__PURE__ */ new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (period === "custom") {
    const from = searchParams.get("date_from");
    const to = searchParams.get("date_to");
    if (!from || !to) {
      throw new HttpError(400, "date_from e date_to s\xE3o obrigat\xF3rios para per\xEDodo custom.");
    }
    return { from, to };
  }
  if (period === "7d") {
    const from = new Date(today);
    from.setUTCDate(from.getUTCDate() - 6);
    return { from: toDateOnly(from), to: toDateOnly(today) };
  }
  if (period === "30d") {
    const from = new Date(today);
    from.setUTCDate(from.getUTCDate() - 29);
    return { from: toDateOnly(from), to: toDateOnly(today) };
  }
  if (period === "month") {
    const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    return { from: toDateOnly(from), to: toDateOnly(today) };
  }
  return { from: toDateOnly(today), to: toDateOnly(today) };
}
__name(getDateRange, "getDateRange");
function getTimestampRange(searchParams) {
  const { from, to } = getDateRange(searchParams);
  return {
    from: `${from}T00:00:00.000Z`,
    to: `${to}T23:59:59.999Z`
  };
}
__name(getTimestampRange, "getTimestampRange");
function getHourRange(searchParams) {
  const from = Number(searchParams.get("hour_from") || 0);
  const to = Number(searchParams.get("hour_to") || 23);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to > 23 || from > to) {
    throw new HttpError(400, "Faixa de horas inv\xE1lida.");
  }
  return { from, to };
}
__name(getHourRange, "getHourRange");
async function findTenantId(env, tenantId, tenantSlug) {
  const tenant = await findTenant(env, tenantId, tenantSlug);
  return tenant.id;
}
__name(findTenantId, "findTenantId");
async function findTenant(env, tenantId, tenantSlug) {
  if (isUuid(tenantId || null)) {
    const rows2 = await supabaseSelect(
      env,
      `tenants?select=id,timezone&id=eq.${tenantId}&limit=1`
    );
    if (!rows2.length) {
      throw new HttpError(404, "Tenant n\xE3o encontrado para o id informado.");
    }
    return rows2[0];
  }
  const normalizedSlug = normalizeText(tenantSlug)?.toLowerCase();
  if (!normalizedSlug) {
    throw new HttpError(400, "tenant_id ou tenant_slug \xE9 obrigat\xF3rio.");
  }
  const rows = await supabaseSelect(
    env,
    `tenants?select=id,timezone&slug=eq.${encodeURIComponent(normalizedSlug)}&limit=1`
  );
  if (!rows.length) {
    throw new HttpError(404, "Tenant n\xE3o encontrado para o slug informado.");
  }
  return rows[0].id;
}
__name(findTenant, "findTenant");
function getTenantHour(date, timezone) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    timeZone: timezone || "UTC"
  });
  return Number(formatter.format(date));
}
__name(getTenantHour, "getTenantHour");
async function handleLeadCapture(request, env) {
  const body = await parseJsonBody(request);
  const tenantId = await findTenantId(
    env,
    normalizeText(body.tenant_id),
    normalizeText(body.tenant_slug)
  );
  const macAddress = normalizeMac(body.mac_address);
  const phone = normalizePhone(body.phone);
  const fullName = normalizeText(body.full_name);
  if (!macAddress) {
    return json({ ok: false, error: "mac_address inv\xE1lido." }, { status: 400 });
  }
  if (!phone || phone.length < 10) {
    return json({ ok: false, error: "phone inv\xE1lido." }, { status: 400 });
  }
  if (!fullName || fullName.length < 2) {
    return json({ ok: false, error: "full_name inv\xE1lido." }, { status: 400 });
  }
  const device = await supabaseRpc(env, "wifi_upsert_device", {
    p_tenant_id: tenantId,
    p_mac_address: macAddress,
    p_device_type: "unknown",
    p_device_name: normalizeText(body.device_name),
    p_hotspot_user: null
  });
  const leadRows = await supabaseRpc(
    env,
    "upsert_wifi_lead",
    {
      p_tenant_id: tenantId,
      p_device_id: device.id,
      p_phone: phone,
      p_marketing_optin: Boolean(body.marketing_optin),
      p_source: normalizeText(body.source) || "portal",
      p_campaign_id: isUuid(normalizeText(body.campaign_id)) ? normalizeText(body.campaign_id) : null,
      p_full_name: fullName,
      p_city: normalizeText(body.city),
      p_tenant_slug: normalizeText(body.tenant_slug)
    }
  );
  const lead = Array.isArray(leadRows) ? leadRows[0] : null;
  if (!lead) {
    throw new HttpError(500, "Falha ao capturar lead.");
  }
  return json({
    ok: true,
    lead_id: lead.lead_id,
    inserted: lead.inserted,
    deduped: !lead.inserted,
    tenant_id: tenantId
  });
}
__name(handleLeadCapture, "handleLeadCapture");
async function handleAdminLeads(url, env) {
  const tenantId = await findTenantId(env, url.searchParams.get("tenant_id"), url.searchParams.get("tenant_slug"));
  const data = await supabaseSelect(
    env,
    `wifi_leads?select=id,full_name,phone,city,created_at&tenant_id=eq.${tenantId}&order=created_at.desc`
  );
  return json({ ok: true, data });
}
__name(handleAdminLeads, "handleAdminLeads");
async function handleDashboardSummary(url, env) {
  const tenantId = await findTenantId(env, url.searchParams.get("tenant_id"), url.searchParams.get("tenant_slug"));
  const dateRange = getDateRange(url.searchParams);
  const timestampRange = getTimestampRange(url.searchParams);
  const stats = await supabaseRpc(env, "wifi_stats", {
    p_tenant_id: tenantId,
    p_from: dateRange.from,
    p_to: dateRange.to
  });
  const sessions = await supabaseSelect(
    env,
    `wifi_sessions?select=login_time,device_id&tenant_id=eq.${tenantId}&login_time=gte.${encodeURIComponent(timestampRange.from)}&login_time=lte.${encodeURIComponent(timestampRange.to)}`
  );
  const previousSessions = await supabaseSelect(
    env,
    `wifi_sessions?select=device_id&tenant_id=eq.${tenantId}&login_time=lt.${encodeURIComponent(timestampRange.from)}`
  );
  const previousDevices = new Set(previousSessions.map((item) => item.device_id));
  const currentDevices = new Set(sessions.map((item) => item.device_id));
  let returningCustomers = 0;
  currentDevices.forEach((deviceId) => {
    if (previousDevices.has(deviceId)) {
      returningCustomers += 1;
    }
  });
  return json({
    ok: true,
    summary: {
      connected: sessions.length,
      new_customers: Number(stats.period_total || 0),
      returning_customers: returningCustomers,
      marketing_optin: Number(stats.period_optin || 0)
    }
  });
}
__name(handleDashboardSummary, "handleDashboardSummary");
async function handlePeakHours(url, env) {
  const tenant = await findTenant(env, url.searchParams.get("tenant_id"), url.searchParams.get("tenant_slug"));
  const timestampRange = getTimestampRange(url.searchParams);
  const hourRange = getHourRange(url.searchParams);
  const sessions = await supabaseSelect(
    env,
    `wifi_sessions?select=login_time&tenant_id=eq.${tenant.id}&login_time=gte.${encodeURIComponent(timestampRange.from)}&login_time=lte.${encodeURIComponent(timestampRange.to)}&order=login_time.asc`
  );
  const counts = /* @__PURE__ */ new Map();
  for (let hour = hourRange.from; hour <= hourRange.to; hour += 1) {
    counts.set(hour, 0);
  }
  sessions.forEach((item) => {
    const date = new Date(item.login_time);
    const hour = getTenantHour(date, tenant.timezone);
    if (counts.has(hour)) {
      counts.set(hour, (counts.get(hour) || 0) + 1);
    }
  });
  const hours = Array.from(counts.entries()).map(([hour, value]) => ({
    label: `${String(hour).padStart(2, "0")}h`,
    value
  }));
  return json({ ok: true, hours });
}
__name(handlePeakHours, "handlePeakHours");
function mapCampaignPayload(body) {
  return {
    tenant_id: normalizeText(body.tenant_id),
    title: normalizeText(body.title),
    subtitle: normalizeText(body.subtitle),
    message: normalizeText(body.message),
    image_url: normalizeText(body.image_url),
    button_label: normalizeText(body.button_label),
    button_url: normalizeText(body.button_url),
    instagram_url: normalizeText(body.instagram_url),
    facebook_url: normalizeText(body.facebook_url),
    whatsapp_url: normalizeText(body.whatsapp_url),
    coupon_code: normalizeText(body.coupon_code),
    active: body.active === void 0 ? true : Boolean(body.active),
    starts_at: normalizeText(body.starts_at),
    ends_at: normalizeText(body.ends_at),
    campaign_type: normalizeText(body.campaign_type) || "portal",
    priority: Number(body.priority || 0),
    bg_color: normalizeText(body.bg_color),
    text_color: normalizeText(body.text_color),
    button_bg_color: normalizeText(body.button_bg_color),
    button_text_color: normalizeText(body.button_text_color),
    render_config: typeof body.render_config === "object" && body.render_config !== null ? body.render_config : {}
  };
}
__name(mapCampaignPayload, "mapCampaignPayload");
async function handleCampaigns(request, url, env) {
  if (request.method === "GET") {
    const tenantId2 = await findTenantId(env, url.searchParams.get("tenant_id"), url.searchParams.get("tenant_slug"));
    const items = await supabaseSelect(
      env,
      `wifi_campaigns?select=*&tenant_id=eq.${tenantId2}&order=priority.desc,created_at.desc`
    );
    return json(items);
  }
  const campaignId = url.pathname.split("/").pop() || "";
  if (request.method === "DELETE") {
    if (!isUuid(campaignId)) {
      return json({ ok: false, error: "campaign id inv\xE1lido." }, { status: 400 });
    }
    const existing = await supabaseSelect(
      env,
      `wifi_campaigns?select=id&id=eq.${campaignId}&limit=1`
    );
    if (!existing.length) {
      return json({ ok: false, error: "campaign id n\xE3o encontrado." }, { status: 404 });
    }
    await supabaseMutate(
      env,
      `wifi_campaigns?id=eq.${campaignId}`,
      {
        method: "DELETE"
      }
    );
    return json({ ok: true, deleted: true, id: campaignId });
  }
  const body = await parseJsonBody(request);
  const tenantId = await findTenantId(env, normalizeText(body.tenant_id), normalizeText(body.tenant_slug));
  const payload = mapCampaignPayload({ ...body, tenant_id: tenantId });
  if (!payload.title || !payload.message) {
    return json({ ok: false, error: "title e message s\xE3o obrigat\xF3rios." }, { status: 400 });
  }
  if (request.method === "POST") {
    const created = await supabaseMutate(env, "wifi_campaigns", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    return json(created[0] || null, { status: 201 });
  }
  if (!isUuid(campaignId)) {
    return json({ ok: false, error: "campaign id inv\xE1lido." }, { status: 400 });
  }
  if (request.method === "PUT") {
    const updated = await supabaseMutate(
      env,
      `wifi_campaigns?id=eq.${campaignId}&tenant_id=eq.${tenantId}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );
    return json(updated[0] || null);
  }
  return json({ ok: false, error: "M\xE9todo n\xE3o suportado." }, { status: 405 });
}
__name(handleCampaigns, "handleCampaigns");
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === "OPTIONS") {
        return empty({ status: 204 });
      }
      if (url.pathname === "/health") {
        return json({
          ok: true,
          service: "portalwifi-api",
          secrets: {
            supabaseUrl: Boolean(env.SUPABASE_URL),
            supabaseServiceRoleKey: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
            hmacSharedSecret: Boolean(env.HMAC_SHARED_SECRET)
          },
          now: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      if (url.pathname === "/lead" && request.method === "POST") {
        return handleLeadCapture(request, env);
      }
      if (url.pathname === "/api/admin/leads" && request.method === "GET") {
        return handleAdminLeads(url, env);
      }
      if (url.pathname === "/api/admin/dashboard/summary" && request.method === "GET") {
        return handleDashboardSummary(url, env);
      }
      if (url.pathname === "/api/admin/reports/peak-hours" && request.method === "GET") {
        return handlePeakHours(url, env);
      }
      if (url.pathname === "/api/admin/campaigns" || url.pathname.startsWith("/api/admin/campaigns/")) {
        return handleCampaigns(request, url, env);
      }
      return json(
        {
          ok: true,
          message: "portalwifi-api online",
          hint: "Use /health to verify secret bindings."
        },
        { status: 200 }
      );
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      const message = error instanceof Error ? error.message : "Erro interno inesperado.";
      return json({ ok: false, error: message }, { status });
    }
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-64znTw/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-64znTw/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
