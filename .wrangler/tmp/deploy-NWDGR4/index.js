var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
function json(data, init) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init?.headers || {}
    }
  });
}
__name(json, "json");
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
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
    return json(
      {
        ok: true,
        message: "portalwifi-api online",
        hint: "Use /health to verify secret bindings."
      },
      { status: 200 }
    );
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
