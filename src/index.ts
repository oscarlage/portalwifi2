interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  HMAC_SHARED_SECRET?: string;
}

type JsonRecord = Record<string, unknown>;

interface DateRange {
  from: string;
  to: string;
}

interface TenantRecord {
  id: string;
  timezone: string | null;
}

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, x-requested-with",
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  "content-type": "application/json; charset=utf-8",
};

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...(init?.headers || {}),
    },
  });
}

function empty(init?: ResponseInit): Response {
  return new Response(null, {
    ...init,
    headers: {
      ...CORS_HEADERS,
      ...(init?.headers || {}),
    },
  });
}

function getSupabaseConfig(env: Env): { url: string; serviceRoleKey: string } {
  const url = env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new HttpError(500, "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados.");
  }

  return { url, serviceRoleKey };
}

function createSupabaseHeaders(serviceRoleKey: string, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("apikey", serviceRoleKey);
  headers.set("authorization", `Bearer ${serviceRoleKey}`);
  return headers;
}

async function parseJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "JSON inválido no corpo da requisição.");
  }
}

async function readSupabaseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") && text
    ? JSON.parse(text) as T | { message?: string; error?: string; details?: string }
    : null;

  if (!response.ok) {
    const errorMessage = typeof payload === "object" && payload !== null
      ? (payload as { message?: string; error?: string; details?: string }).message
        || (payload as { message?: string; error?: string; details?: string }).error
        || (payload as { message?: string; error?: string; details?: string }).details
      : "";
    throw new HttpError(response.status, errorMessage || `Erro Supabase ${response.status}`);
  }

  return (payload ?? null) as T;
}

async function supabaseSelect<T>(env: Env, path: string): Promise<T> {
  const { url, serviceRoleKey } = getSupabaseConfig(env);
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: createSupabaseHeaders(serviceRoleKey, {
      accept: "application/json",
    }),
  });
  return readSupabaseResponse<T>(response);
}

async function supabaseMutate<T>(
  env: Env,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { url, serviceRoleKey } = getSupabaseConfig(env);
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: createSupabaseHeaders(serviceRoleKey, {
      accept: "application/json",
      prefer: "return=representation",
      ...(init.headers || {}),
    }),
  });
  return readSupabaseResponse<T>(response);
}

async function supabaseRpc<T>(env: Env, fnName: string, payload: JsonRecord): Promise<T> {
  return supabaseMutate<T>(env, `rpc/${fnName}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

function normalizePhone(value: unknown): string | null {
  const digits = String(value || "").replace(/\D+/g, "");
  return digits || null;
}

function normalizeMac(value: unknown): string | null {
  const compact = String(value || "").replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  if (compact.length !== 12) {
    return null;
  }

  return compact.match(/.{1,2}/g)?.join(":") || null;
}

function normalizeText(value: unknown): string | null {
  const text = String(value || "").trim();
  return text ? text : null;
}

function isUuid(value: string | null | undefined): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function getDateRange(searchParams: URLSearchParams): DateRange {
  const period = searchParams.get("period") || "today";
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  if (period === "custom") {
    const from = searchParams.get("date_from");
    const to = searchParams.get("date_to");
    if (!from || !to) {
      throw new HttpError(400, "date_from e date_to são obrigatórios para período custom.");
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

function getTimestampRange(searchParams: URLSearchParams): { from: string; to: string } {
  const { from, to } = getDateRange(searchParams);
  return {
    from: `${from}T00:00:00.000Z`,
    to: `${to}T23:59:59.999Z`,
  };
}

function getHourRange(searchParams: URLSearchParams): { from: number; to: number } {
  const from = Number(searchParams.get("hour_from") || 0);
  const to = Number(searchParams.get("hour_to") || 23);

  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to > 23 || from > to) {
    throw new HttpError(400, "Faixa de horas inválida.");
  }

  return { from, to };
}

async function findTenantId(env: Env, tenantId?: string | null, tenantSlug?: string | null): Promise<string> {
  const tenant = await findTenant(env, tenantId, tenantSlug);
  return tenant.id;
}

async function findTenant(env: Env, tenantId?: string | null, tenantSlug?: string | null): Promise<TenantRecord> {
  if (isUuid(tenantId || null)) {
    const rows = await supabaseSelect<Array<TenantRecord>>(
      env,
      `tenants?select=id,timezone&id=eq.${tenantId}&limit=1`,
    );

    if (!rows.length) {
      throw new HttpError(404, "Tenant não encontrado para o id informado.");
    }

    return rows[0];
  }

  const normalizedSlug = normalizeText(tenantSlug)?.toLowerCase();
  if (!normalizedSlug) {
    throw new HttpError(400, "tenant_id ou tenant_slug é obrigatório.");
  }

  const rows = await supabaseSelect<Array<TenantRecord>>(
    env,
    `tenants?select=id,timezone&slug=eq.${encodeURIComponent(normalizedSlug)}&limit=1`,
  );

  if (!rows.length) {
    throw new HttpError(404, "Tenant não encontrado para o slug informado.");
  }

  return rows[0].id;
}

function getTenantHour(date: Date, timezone: string | null | undefined): number {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    timeZone: timezone || "UTC",
  });
  return Number(formatter.format(date));
}

async function handleLeadCapture(request: Request, env: Env): Promise<Response> {
  const body = await parseJsonBody<JsonRecord>(request);
  const tenantId = await findTenantId(
    env,
    normalizeText(body.tenant_id),
    normalizeText(body.tenant_slug),
  );
  const macAddress = normalizeMac(body.mac_address);
  const phone = normalizePhone(body.phone);
  const fullName = normalizeText(body.full_name);

  if (!macAddress) {
    return json({ ok: false, error: "mac_address inválido." }, { status: 400 });
  }

  if (!phone || phone.length < 10) {
    return json({ ok: false, error: "phone inválido." }, { status: 400 });
  }

  if (!fullName || fullName.length < 2) {
    return json({ ok: false, error: "full_name inválido." }, { status: 400 });
  }

  const device = await supabaseRpc<{ id: string }>(env, "wifi_upsert_device", {
    p_tenant_id: tenantId,
    p_mac_address: macAddress,
    p_device_type: "unknown",
    p_device_name: normalizeText(body.device_name),
    p_hotspot_user: null,
  });

  const leadRows = await supabaseRpc<Array<{ lead_id: string; inserted: boolean }>>(
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
      p_tenant_slug: normalizeText(body.tenant_slug),
    },
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
    tenant_id: tenantId,
  });
}

async function handleAdminLeads(url: URL, env: Env): Promise<Response> {
  const tenantId = await findTenantId(env, url.searchParams.get("tenant_id"), url.searchParams.get("tenant_slug"));
  const data = await supabaseSelect<Array<{
    id: string;
    full_name: string | null;
    phone: string | null;
    city: string | null;
    created_at: string;
  }>>(
    env,
    `wifi_leads?select=id,full_name,phone,city,created_at&tenant_id=eq.${tenantId}&order=created_at.desc`,
  );

  return json({ ok: true, data });
}

async function handleDashboardSummary(url: URL, env: Env): Promise<Response> {
  const tenantId = await findTenantId(env, url.searchParams.get("tenant_id"), url.searchParams.get("tenant_slug"));
  const dateRange = getDateRange(url.searchParams);
  const timestampRange = getTimestampRange(url.searchParams);

  const stats = await supabaseRpc<{
    today?: number;
    period_total?: number;
    period_optin?: number;
  }>(env, "wifi_stats", {
    p_tenant_id: tenantId,
    p_from: dateRange.from,
    p_to: dateRange.to,
  });

  const sessions = await supabaseSelect<Array<{ login_time: string; device_id: string }>>(
    env,
    `wifi_sessions?select=login_time,device_id&tenant_id=eq.${tenantId}&login_time=gte.${encodeURIComponent(timestampRange.from)}&login_time=lte.${encodeURIComponent(timestampRange.to)}`,
  );

  const previousSessions = await supabaseSelect<Array<{ device_id: string }>>(
    env,
    `wifi_sessions?select=device_id&tenant_id=eq.${tenantId}&login_time=lt.${encodeURIComponent(timestampRange.from)}`,
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
      marketing_optin: Number(stats.period_optin || 0),
    },
  });
}

async function handlePeakHours(url: URL, env: Env): Promise<Response> {
  const tenant = await findTenant(env, url.searchParams.get("tenant_id"), url.searchParams.get("tenant_slug"));
  const timestampRange = getTimestampRange(url.searchParams);
  const hourRange = getHourRange(url.searchParams);

  const sessions = await supabaseSelect<Array<{ login_time: string }>>(
    env,
    `wifi_sessions?select=login_time&tenant_id=eq.${tenant.id}&login_time=gte.${encodeURIComponent(timestampRange.from)}&login_time=lte.${encodeURIComponent(timestampRange.to)}&order=login_time.asc`,
  );

  const counts = new Map<number, number>();
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
    value,
  }));

  return json({ ok: true, hours });
}

function mapCampaignPayload(body: JsonRecord): JsonRecord {
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
    active: body.active === undefined ? true : Boolean(body.active),
    starts_at: normalizeText(body.starts_at),
    ends_at: normalizeText(body.ends_at),
    campaign_type: normalizeText(body.campaign_type) || "portal",
    priority: Number(body.priority || 0),
    bg_color: normalizeText(body.bg_color),
    text_color: normalizeText(body.text_color),
    button_bg_color: normalizeText(body.button_bg_color),
    button_text_color: normalizeText(body.button_text_color),
    render_config: (typeof body.render_config === "object" && body.render_config !== null)
      ? body.render_config
      : {},
  };
}

async function handleCampaigns(request: Request, url: URL, env: Env): Promise<Response> {
  if (request.method === "GET") {
    const tenantId = await findTenantId(env, url.searchParams.get("tenant_id"), url.searchParams.get("tenant_slug"));
    const items = await supabaseSelect<Array<JsonRecord>>(
      env,
      `wifi_campaigns?select=*&tenant_id=eq.${tenantId}&order=priority.desc,created_at.desc`,
    );
    return json(items);
  }

  const campaignId = url.pathname.split("/").pop() || "";

  if (request.method === "DELETE") {
    if (!isUuid(campaignId)) {
      return json({ ok: false, error: "campaign id inválido." }, { status: 400 });
    }

    const existing = await supabaseSelect<Array<{ id: string }>>(
      env,
      `wifi_campaigns?select=id&id=eq.${campaignId}&limit=1`,
    );

    if (!existing.length) {
      return json({ ok: false, error: "campaign id não encontrado." }, { status: 404 });
    }

    await supabaseMutate<Array<JsonRecord>>(
      env,
      `wifi_campaigns?id=eq.${campaignId}`,
      {
        method: "DELETE",
      },
    );
    return json({ ok: true, deleted: true, id: campaignId });
  }

  const body = await parseJsonBody<JsonRecord>(request);
  const tenantId = await findTenantId(env, normalizeText(body.tenant_id), normalizeText(body.tenant_slug));
  const payload = mapCampaignPayload({ ...body, tenant_id: tenantId });

  if (!payload.title || !payload.message) {
    return json({ ok: false, error: "title e message são obrigatórios." }, { status: 400 });
  }

  if (request.method === "POST") {
    const created = await supabaseMutate<Array<JsonRecord>>(env, "wifi_campaigns", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return json(created[0] || null, { status: 201 });
  }

  if (!isUuid(campaignId)) {
    return json({ ok: false, error: "campaign id inválido." }, { status: 400 });
  }

  if (request.method === "PUT") {
    const updated = await supabaseMutate<Array<JsonRecord>>(
      env,
      `wifi_campaigns?id=eq.${campaignId}&tenant_id=eq.${tenantId}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    return json(updated[0] || null);
  }

  return json({ ok: false, error: "Método não suportado." }, { status: 405 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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
            hmacSharedSecret: Boolean(env.HMAC_SHARED_SECRET),
          },
          now: new Date().toISOString(),
        });
      }

      if (url.pathname === "/lead" && request.method === "POST") {
        return await handleLeadCapture(request, env);
      }

      if (url.pathname === "/api/admin/leads" && request.method === "GET") {
        return await handleAdminLeads(url, env);
      }

      if (url.pathname === "/api/admin/dashboard/summary" && request.method === "GET") {
        return await handleDashboardSummary(url, env);
      }

      if (url.pathname === "/api/admin/reports/peak-hours" && request.method === "GET") {
        return await handlePeakHours(url, env);
      }

      if (url.pathname === "/api/admin/campaigns" || url.pathname.startsWith("/api/admin/campaigns/")) {
        return await handleCampaigns(request, url, env);
      }

      return json(
        {
          ok: true,
          message: "portalwifi-api online",
          hint: "Use /health to verify secret bindings.",
        },
        { status: 200 }
      );
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      const message = error instanceof Error ? error.message : "Erro interno inesperado.";
      return json({ ok: false, error: message }, { status });
    }
  },
};