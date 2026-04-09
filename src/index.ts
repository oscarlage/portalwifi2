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

interface AuthUserRecord {
  id: string;
  email?: string | null;
}

interface AdminCreatedUserResponse {
  id: string;
  email?: string | null;
  user_metadata?: {
    full_name?: string | null;
  } | null;
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

const CAMPAIGN_MEDIA_BUCKET = "campaign-media";
const CAMPAIGN_MEDIA_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const CAMPAIGN_MEDIA_MAX_BYTES = 5 * 1024 * 1024;

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

function getSafeSupabaseDiagnostics(env: Env): Record<string, unknown> {
  const rawUrl = env.SUPABASE_URL?.trim() || "";

  if (!rawUrl) {
    return {
      configured: false,
    };
  }

  try {
    const parsed = new URL(rawUrl);
    return {
      configured: true,
      origin: parsed.origin,
      pathname: parsed.pathname,
      containsRestV1: parsed.pathname.includes("/rest/v1"),
    };
  } catch {
    return {
      configured: true,
      invalidUrl: true,
      preview: rawUrl.slice(0, 64),
    };
  }
}

function createSupabaseHeaders(serviceRoleKey: string, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("apikey", serviceRoleKey);
  headers.set("authorization", `Bearer ${serviceRoleKey}`);
  return headers;
}

function createSupabaseUserHeaders(apiKey: string, bearerToken: string, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("apikey", apiKey);
  headers.set("authorization", `Bearer ${bearerToken}`);
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
  const payload = contentType.toLowerCase().includes("json") && text
    ? JSON.parse(text) as T | { message?: string; error?: string; details?: string }
    : null;

  if (!response.ok) {
    const errorMessage = typeof payload === "object" && payload !== null
      ? (payload as { message?: string; error?: string; details?: string }).message
        || (payload as { message?: string; error?: string; details?: string }).error
        || (payload as { message?: string; error?: string; details?: string }).details
      : "";
    throw new HttpError(response.status, errorMessage || text || `Erro Supabase ${response.status}`);
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

async function supabaseAuthRequest<T>(
  env: Env,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { url, serviceRoleKey } = getSupabaseConfig(env);
  const response = await fetch(`${url}/auth/v1/${path}`, {
    ...init,
    headers: createSupabaseHeaders(serviceRoleKey, {
      accept: "application/json",
      ...(init.headers || {}),
    }),
  });
  return readSupabaseResponse<T>(response);
}

async function supabaseStorageRequest<T>(
  env: Env,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { url, serviceRoleKey } = getSupabaseConfig(env);
  const response = await fetch(`${url}/storage/v1/${path}`, {
    ...init,
    headers: createSupabaseHeaders(serviceRoleKey, {
      ...(init.headers || {}),
    }),
  });
  return readSupabaseResponse<T>(response);
}

function getSupabaseOrigin(env: Env): string {
  const { url } = getSupabaseConfig(env);
  const parsed = new URL(url);
  return parsed.origin;
}

function encodeStoragePath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function getPublicStorageUrl(env: Env, bucket: string, path: string): string {
  return `${getSupabaseOrigin(env)}/storage/v1/object/public/${bucket}/${encodeStoragePath(path)}`;
}

async function ensureStorageBucket(
  env: Env,
  bucketId: string,
  options: { public: boolean; fileSizeLimit?: number; allowedMimeTypes?: string[] },
): Promise<void> {
  try {
    await supabaseStorageRequest(env, `bucket/${encodeURIComponent(bucketId)}`, {
      method: "GET",
    });
    return;
  } catch (error) {
    if (!(error instanceof HttpError) || error.status !== 404) {
      throw error;
    }
  }

  await supabaseStorageRequest(env, "bucket", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      id: bucketId,
      name: bucketId,
      public: options.public,
      file_size_limit: options.fileSizeLimit,
      allowed_mime_types: options.allowedMimeTypes,
    }),
  });
}

async function uploadStorageObject(
  env: Env,
  bucketId: string,
  objectPath: string,
  file: File,
): Promise<void> {
  await supabaseStorageRequest(env, `object/${encodeURIComponent(bucketId)}/${encodeStoragePath(objectPath)}`, {
    method: "POST",
    headers: {
      "content-type": file.type || "application/octet-stream",
      "cache-control": "3600",
      "x-upsert": "false",
    },
    body: await file.arrayBuffer(),
  });
}

async function deleteStorageObjects(env: Env, bucketId: string, objectPaths: string[]): Promise<void> {
  const uniquePaths = Array.from(new Set(objectPaths.filter(Boolean)));
  if (!uniquePaths.length) {
    return;
  }

  for (const objectPath of uniquePaths) {
    try {
      await supabaseStorageRequest(env, `object/${encodeURIComponent(bucketId)}/${encodeStoragePath(objectPath)}`, {
        method: "DELETE",
      });
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        continue;
      }
      throw error;
    }
  }
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

function getBearerToken(request: Request): string {
  const authHeader = request.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    throw new HttpError(401, "Token de autorização não informado.");
  }
  return match[1].trim();
}

function generateTemporaryPassword(length = 16): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const specials = "!@#$%*+-_";
  const all = `${upper}${lower}${digits}${specials}`;
  const cryptoValues = crypto.getRandomValues(new Uint32Array(length + 4));
  const required = [upper, lower, digits, specials].map((group, index) => group[cryptoValues[index] % group.length]);
  const generated = [];

  for (let index = 0; index < length - required.length; index += 1) {
    generated.push(all[cryptoValues[index + required.length] % all.length]);
  }

  const combined = required.concat(generated);
  for (let index = combined.length - 1; index > 0; index -= 1) {
    const swapIndex = cryptoValues[(index + 1) % cryptoValues.length] % (index + 1);
    const current = combined[index];
    combined[index] = combined[swapIndex];
    combined[swapIndex] = current;
  }

  return combined.join("");
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

function normalizeFileName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "media";
}

function parseCampaignRenderConfig(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null ? value as JsonRecord : {};
}

function getManagedCampaignMediaPath(env: Env, imageUrl: unknown, renderConfig: unknown): string | null {
  const config = parseCampaignRenderConfig(renderConfig);
  const configuredPath = normalizeText(config.managed_media_path);
  if (configuredPath) {
    return configuredPath;
  }

  const urlValue = normalizeText(imageUrl);
  if (!urlValue) {
    return null;
  }

  const publicBase = `${getSupabaseOrigin(env)}/storage/v1/object/public/${CAMPAIGN_MEDIA_BUCKET}/`;
  if (!urlValue.startsWith(publicBase)) {
    return null;
  }

  return decodeURIComponent(urlValue.slice(publicBase.length));
}

function isExpiredCampaign(endsAt: unknown): boolean {
  const normalized = normalizeText(endsAt);
  if (!normalized) {
    return false;
  }

  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) && timestamp < Date.now();
}

async function cleanupExpiredCampaignMedia(tenantId: string, env: Env): Promise<void> {
  const expiredItems = await supabaseSelect<Array<JsonRecord>>(
    env,
    `wifi_campaigns?select=id,image_url,ends_at,render_config&tenant_id=eq.${tenantId}&ends_at=lt.${encodeURIComponent(new Date().toISOString())}&image_url=not.is.null`,
  );

  for (const item of expiredItems) {
    const mediaPath = getManagedCampaignMediaPath(env, item.image_url, item.render_config);
    if (!mediaPath) {
      continue;
    }

    await deleteStorageObjects(env, CAMPAIGN_MEDIA_BUCKET, [mediaPath]);

    const nextRenderConfig = {
      ...parseCampaignRenderConfig(item.render_config),
      managed_media_path: null,
    };

    await supabaseMutate<Array<JsonRecord>>(
      env,
      `wifi_campaigns?id=eq.${item.id}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          image_url: null,
          render_config: nextRenderConfig,
        }),
      },
    );
  }
}

async function handleAdminPortalSettings(url: URL, env: Env): Promise<Response> {
  const tenantId = await findTenantId(env, url.searchParams.get("tenant_id"), url.searchParams.get("tenant_slug"));
  const items = await supabaseSelect<Array<JsonRecord>>(
    env,
    `portal_settings?select=tenant_id,brand_name,social_links&tenant_id=eq.${tenantId}&limit=1`,
  );
  return json(items[0] || null);
}

async function handleCampaignMediaUpload(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData();
  const fileEntry = formData.get("file");
  const tenantId = await findTenantId(
    env,
    normalizeText(formData.get("tenant_id")),
    normalizeText(formData.get("tenant_slug")),
  );

  if (!(fileEntry instanceof File)) {
    return json({ ok: false, error: "Arquivo não informado." }, { status: 400 });
  }

  if (!CAMPAIGN_MEDIA_ALLOWED_TYPES.includes(fileEntry.type)) {
    return json({ ok: false, error: "Formato de mídia inválido. Use JPG, PNG ou WEBP." }, { status: 400 });
  }

  if (fileEntry.size > CAMPAIGN_MEDIA_MAX_BYTES) {
    return json({ ok: false, error: "A mídia excede o limite de 5 MB." }, { status: 400 });
  }

  await ensureStorageBucket(env, CAMPAIGN_MEDIA_BUCKET, {
    public: true,
    fileSizeLimit: CAMPAIGN_MEDIA_MAX_BYTES,
    allowedMimeTypes: CAMPAIGN_MEDIA_ALLOWED_TYPES,
  });

  const campaignId = normalizeText(formData.get("campaign_id")) || "draft";
  const extension = normalizeFileName(fileEntry.name).split(".").pop() || "bin";
  const objectPath = `tenants/${tenantId}/campaigns/${campaignId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

  await uploadStorageObject(env, CAMPAIGN_MEDIA_BUCKET, objectPath, fileEntry);

  return json({
    ok: true,
    path: objectPath,
    url: getPublicStorageUrl(env, CAMPAIGN_MEDIA_BUCKET, objectPath),
  }, { status: 201 });
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

async function getRequesterProfile(request: Request, env: Env): Promise<JsonRecord> {
  const { url, serviceRoleKey } = getSupabaseConfig(env);
  const bearerToken = getBearerToken(request);

  const authResponse = await fetch(`${url}/auth/v1/user`, {
    headers: createSupabaseUserHeaders(serviceRoleKey, bearerToken, {
      accept: "application/json",
    }),
  });

  const authUser = await readSupabaseResponse<AuthUserRecord>(authResponse);
  if (!authUser?.id) {
    throw new HttpError(401, "Sessão inválida para operação administrativa.");
  }

  const profiles = await supabaseSelect<Array<JsonRecord>>(
    env,
    `profiles?select=user_id,email,full_name,platform_role,is_platform_user,status&user_id=eq.${authUser.id}&limit=1`,
  );

  const profile = profiles[0];
  if (!profile) {
    throw new HttpError(403, "Perfil do solicitante não encontrado.");
  }

  return profile;
}

async function ensureAdminPasswordAccess(request: Request, env: Env): Promise<JsonRecord> {
  const requesterProfile = await getRequesterProfile(request, env);
  const requesterRole = String(requesterProfile.platform_role || "").trim().toLowerCase();
  const allowedRoles = new Set(["platform_admin", "platform_support", "platform_operations"]);

  if (requesterProfile.is_platform_user !== true || !allowedRoles.has(requesterRole)) {
    throw new HttpError(403, "Você não tem permissão para redefinir senhas diretamente.");
  }

  const requesterStatus = String(requesterProfile.status || "active").trim().toLowerCase();
  if (requesterStatus === "blocked" || requesterStatus === "disabled") {
    throw new HttpError(403, "Seu acesso administrativo não permite esta operação.");
  }

  return requesterProfile;
}

async function handleAdminTemporaryPassword(request: Request, env: Env): Promise<Response> {
  const requesterProfile = await ensureAdminPasswordAccess(request, env);
  const body = await parseJsonBody<{ user_id?: string; temporary_password?: string }>(request);
  const userId = normalizeText(body.user_id);
  const providedTemporaryPassword = normalizeText(body.temporary_password);

  if (!isUuid(userId)) {
    return json({ ok: false, error: "user_id inválido." }, { status: 400 });
  }

  if (providedTemporaryPassword && providedTemporaryPassword.length < 8) {
    return json({ ok: false, error: "A senha provisória deve ter pelo menos 8 caracteres." }, { status: 400 });
  }

  const targetProfiles = await supabaseSelect<Array<JsonRecord>>(
    env,
    `profiles?select=user_id,email,full_name,status,must_change_password,password_reset_required&user_id=eq.${userId}&limit=1`,
  );
  const targetProfile = targetProfiles[0];

  if (!targetProfile) {
    return json({ ok: false, error: "Usuário não encontrado." }, { status: 404 });
  }

  const temporaryPassword = providedTemporaryPassword || generateTemporaryPassword();

  await supabaseAuthRequest<JsonRecord>(env, `admin/users/${userId}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      password: temporaryPassword,
    }),
  });

  const now = new Date().toISOString();
  const updatedProfiles = await supabaseMutate<Array<JsonRecord>>(
    env,
    `profiles?user_id=eq.${userId}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        status: "pending",
        must_change_password: true,
        password_reset_required: false,
        updated_at: now,
      }),
    },
  );

  await supabaseMutate<Array<JsonRecord>>(
    env,
    `tenant_members?user_id=eq.${userId}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        is_active: true,
        updated_at: now,
      }),
    },
  );

  return json({
    ok: true,
    user_id: userId,
    email: targetProfile.email || null,
    full_name: targetProfile.full_name || null,
    temporary_password: temporaryPassword,
    profile: updatedProfiles[0] || null,
    actor: {
      user_id: requesterProfile.user_id || null,
      full_name: requesterProfile.full_name || null,
      email: requesterProfile.email || null,
    },
  });
}

async function handleAdminCreateUser(request: Request, env: Env): Promise<Response> {
  await ensureAdminPasswordAccess(request, env);
  const body = await parseJsonBody<{
    email?: string;
    password?: string;
    full_name?: string;
    phone?: string | null;
    status?: string;
    scope?: string | null;
    platform_role?: string | null;
    is_platform_user?: boolean;
    must_change_password?: boolean;
    password_reset_required?: boolean;
    tenant_id?: string | null;
    membership_role?: string | null;
  }>(request);

  const email = normalizeText(body.email)?.toLowerCase();
  const password = normalizeText(body.password);
  const fullName = normalizeText(body.full_name);
  const phone = normalizeText(body.phone);
  const status = normalizeText(body.status) || "pending";
  const scope = normalizeText(body.scope) || "tenant";
  const platformRole = normalizeText(body.platform_role);
  const isPlatformUser = body.is_platform_user === true;
  const mustChangePassword = body.must_change_password === true;
  const passwordResetRequired = body.password_reset_required === true;
  const tenantId = normalizeText(body.tenant_id);
  const membershipRole = normalizeText(body.membership_role);

  if (!email) {
    return json({ ok: false, error: "email é obrigatório." }, { status: 400 });
  }

  if (!password || password.length < 8) {
    return json({ ok: false, error: "password deve ter pelo menos 8 caracteres." }, { status: 400 });
  }

  if (!fullName) {
    return json({ ok: false, error: "full_name é obrigatório." }, { status: 400 });
  }

  if (membershipRole && !tenantId) {
    return json({ ok: false, error: "tenant_id é obrigatório para usuários vinculados a tenant." }, { status: 400 });
  }

  let createdUser: AdminCreatedUserResponse | null = null;

  try {
    createdUser = await supabaseAuthRequest<AdminCreatedUserResponse>(env, "admin/users", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
        },
      }),
    });

    if (!createdUser?.id) {
      throw new HttpError(500, "Não foi possível obter o id do usuário criado.");
    }

    const now = new Date().toISOString();
    const updatedProfiles = await supabaseMutate<Array<JsonRecord>>(
      env,
      `profiles?user_id=eq.${createdUser.id}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone,
          status,
          scope,
          platform_role: platformRole,
          is_platform_user: isPlatformUser,
          must_change_password: mustChangePassword,
          password_reset_required: passwordResetRequired,
          updated_at: now,
        }),
      },
    );

    if (tenantId && membershipRole) {
      await supabaseMutate<Array<JsonRecord>>(env, "tenant_members", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          user_id: createdUser.id,
          role: membershipRole,
          is_active: status !== "blocked" && status !== "disabled",
        }),
      });
    }

    return json({
      ok: true,
      user: {
        id: createdUser.id,
        email,
        full_name: fullName,
      },
      profile: updatedProfiles[0] || null,
    }, { status: 201 });
  } catch (error) {
    if (createdUser?.id) {
      try {
        await supabaseAuthRequest<JsonRecord>(env, `admin/users/${createdUser.id}`, {
          method: "DELETE",
        });
      } catch (rollbackError) {
        console.error("Falha ao reverter usuário criado parcialmente:", rollbackError);
      }
    }

    throw error;
  }
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
    await cleanupExpiredCampaignMedia(tenantId, env);
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

    const existing = await supabaseSelect<Array<JsonRecord>>(
      env,
      `wifi_campaigns?select=id,image_url,render_config&id=eq.${campaignId}&limit=1`,
    );

    if (!existing.length) {
      return json({ ok: false, error: "campaign id não encontrado." }, { status: 404 });
    }

    const mediaPath = getManagedCampaignMediaPath(env, existing[0].image_url, existing[0].render_config);
    if (mediaPath) {
      await deleteStorageObjects(env, CAMPAIGN_MEDIA_BUCKET, [mediaPath]);
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
    const existing = await supabaseSelect<Array<JsonRecord>>(
      env,
      `wifi_campaigns?select=id,image_url,render_config&id=eq.${campaignId}&tenant_id=eq.${tenantId}&limit=1`,
    );

    if (!existing.length) {
      return json({ ok: false, error: "campaign id não encontrado." }, { status: 404 });
    }

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

    const previousPath = getManagedCampaignMediaPath(env, existing[0].image_url, existing[0].render_config);
    const nextPath = getManagedCampaignMediaPath(env, updated[0]?.image_url, updated[0]?.render_config);
    if (previousPath && previousPath !== nextPath) {
      await deleteStorageObjects(env, CAMPAIGN_MEDIA_BUCKET, [previousPath]);
    }

    if (nextPath && isExpiredCampaign(updated[0]?.ends_at)) {
      await deleteStorageObjects(env, CAMPAIGN_MEDIA_BUCKET, [nextPath]);

      const sanitizedRenderConfig = {
        ...parseCampaignRenderConfig(updated[0]?.render_config),
        managed_media_path: null,
      };

      const sanitized = await supabaseMutate<Array<JsonRecord>>(
        env,
        `wifi_campaigns?id=eq.${campaignId}&tenant_id=eq.${tenantId}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            image_url: null,
            render_config: sanitizedRenderConfig,
          }),
        },
      );
      return json(sanitized[0] || null);
    }

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
          supabase: getSafeSupabaseDiagnostics(env),
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

      if (url.pathname === "/api/admin/portal-settings" && request.method === "GET") {
        return await handleAdminPortalSettings(url, env);
      }

      if (url.pathname === "/api/admin/campaign-media" && request.method === "POST") {
        return await handleCampaignMediaUpload(request, env);
      }

      if (url.pathname === "/api/admin/users/temp-password" && request.method === "POST") {
        return await handleAdminTemporaryPassword(request, env);
      }

      if (url.pathname === "/api/admin/users" && request.method === "POST") {
        return await handleAdminCreateUser(request, env);
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