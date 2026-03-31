interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  HMAC_SHARED_SECRET?: string;
}

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers || {}),
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

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

    return json(
      {
        ok: true,
        message: "portalwifi-api online",
        hint: "Use /health to verify secret bindings.",
      },
      { status: 200 }
    );
  },
};