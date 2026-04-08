(function () {
  "use strict";

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function round(value, digits) {
    const places = Number.isFinite(digits) ? digits : 0;
    const factor = 10 ** places;
    return Math.round((Number(value) || 0) * factor) / factor;
  }

  function startOfDayIso() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  async function fetchCount(supabase, table, config) {
    const settings = config || {};
    const startedAt = performance.now();
    let query = supabase.from(table).select("*", { count: "exact", head: true });

    Object.entries(settings.eq || {}).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    Object.entries(settings.gte || {}).forEach(([key, value]) => {
      query = query.gte(key, value);
    });

    Object.entries(settings.lte || {}).forEach(([key, value]) => {
      query = query.lte(key, value);
    });

    safeArray(settings.is).forEach(([key, value]) => {
      query = query.is(key, value);
    });

    const result = await query;

    return {
      count: result.count || 0,
      error: result.error ? result.error.message : null,
      latencyMs: round(performance.now() - startedAt, 1)
    };
  }

  async function fetchRows(supabase, table, columns, config) {
    const settings = config || {};
    let query = supabase.from(table).select(columns);

    Object.entries(settings.eq || {}).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    Object.entries(settings.gte || {}).forEach(([key, value]) => {
      query = query.gte(key, value);
    });

    safeArray(settings.is).forEach(([key, value]) => {
      query = query.is(key, value);
    });

    if (settings.orderBy) {
      query = query.order(settings.orderBy.column, { ascending: !!settings.orderBy.ascending });
    }

    if (settings.limit) {
      query = query.limit(settings.limit);
    }

    const { data, error } = await query;
    return {
      data: safeArray(data),
      error: error ? error.message : null
    };
  }

  async function fetchWorkerHealth(apiBase) {
    const startedAt = performance.now();

    try {
      const response = await fetch(`${apiBase.replace(/\/$/, "")}/health`, {
        method: "GET",
        headers: { Accept: "application/json" }
      });
      const payload = await response.json();

      return {
        ok: response.ok && payload && payload.ok === true,
        status: response.ok && payload && payload.ok === true ? "online" : "degraded",
        payload,
        error: null,
        latencyMs: round(performance.now() - startedAt, 1),
        checkedAt: nowIso()
      };
    } catch (error) {
      return {
        ok: false,
        status: "unavailable",
        payload: null,
        error: error && error.message ? error.message : "Falha ao consultar /health.",
        latencyMs: round(performance.now() - startedAt, 1),
        checkedAt: nowIso()
      };
    }
  }

  function calculateHealthScore(input) {
    const data = input || {};
    const availability = clamp(Number(data.availability ?? 0.9), 0, 1);
    const authSuccessRate = clamp(Number(data.authSuccessRate ?? 0.7), 0, 1);
    const latencyScore = clamp(Number(data.latencyScore ?? 0.75), 0, 1);
    const failureScore = clamp(Number(data.failureScore ?? 0.8), 0, 1);
    const activityScore = clamp(Number(data.activityScore ?? 0.8), 0, 1);
    const criticalServices = clamp(Number(data.criticalServices ?? 0.8), 0, 1);

    const score = (
      availability * 0.25 +
      authSuccessRate * 0.2 +
      latencyScore * 0.15 +
      failureScore * 0.15 +
      activityScore * 0.1 +
      criticalServices * 0.15
    ) * 100;

    return clamp(Math.round(score), 0, 100);
  }

  function classifyHealth(score) {
    if (score >= 85) {
      return { status: "healthy", severity: "low" };
    }
    if (score >= 65) {
      return { status: "degraded", severity: "medium" };
    }
    return { status: "critical", severity: "high" };
  }

  function latestTimestamp(values) {
    return values
      .map((value) => (value ? new Date(value).getTime() : 0))
      .reduce((latest, current) => Math.max(latest, current), 0);
  }

  function buildTenantHealthRows(tenants, sessions, leads, logs, wifiDataAvailable) {
    return safeArray(tenants).map((tenant) => {
      const tenantId = String(tenant.id || "");
      const tenantSessions = sessions.filter((item) => String(item.tenant_id || "") === tenantId);
      const tenantLeads = leads.filter((item) => String(item.tenant_id || "") === tenantId);
      const tenantLogs = logs.filter((item) => String(item.tenant_id || "") === tenantId);

      const activeSessions = tenantSessions.filter((item) => !item.logout_time).length;
      const errorCount = tenantLogs.filter((item) => String(item.result || "").toLowerCase() === "error").length;
      const warningCount = tenantLogs.filter((item) => String(item.result || "").toLowerCase() === "warning").length;
      const lastActivityMs = latestTimestamp(
        tenantSessions.map((item) => item.login_time)
          .concat(tenantLeads.map((item) => item.created_at))
          .concat(tenantLogs.map((item) => item.created_at))
      );

      const availability = tenant.status === "active" ? 1 : tenant.status === "pending" ? 0.75 : 0.35;
      const authSuccessRate = wifiDataAvailable ? clamp(1 - errorCount * 0.08, 0.35, 1) : 0.65;
      const latencyScore = wifiDataAvailable ? (activeSessions > 25 ? 0.7 : 0.92) : 0.75;
      const failureScore = clamp(1 - (errorCount * 0.12 + warningCount * 0.05), 0.2, 1);
      const activityScore = lastActivityMs ? 1 : tenant.status === "active" ? 0.55 : 0.4;
      const criticalServices = wifiDataAvailable ? 0.9 : 0.65;

      const healthScore = calculateHealthScore({
        availability,
        authSuccessRate,
        latencyScore,
        failureScore,
        activityScore,
        criticalServices
      });

      const classification = classifyHealth(healthScore);

      return {
        tenantId,
        tenantName: tenant.name || tenant.slug || tenantId,
        tenantSlug: tenant.slug || "",
        healthScore,
        healthStatus: classification.status,
        severity: classification.severity,
        sessions: tenantSessions.length,
        authentications: tenantSessions.length,
        failures: errorCount,
        alerts: errorCount + warningCount,
        lastActivityAt: lastActivityMs ? new Date(lastActivityMs).toISOString() : null
      };
    }).sort((left, right) => left.healthScore - right.healthScore);
  }

  function buildAlerts(logs, tenants, workerHealth, databaseProbe, tenantHealthRows) {
    const alerts = [];

    if (!workerHealth.ok) {
      alerts.push({
        type: "service_unavailable",
        severity: "high",
        origin: "worker",
        tenantName: "—",
        status: "open",
        description: "Endpoint global de health indisponível ou degradado.",
        evidence: workerHealth.error || `status=${workerHealth.status}`
      });
    }

    if (databaseProbe.error) {
      alerts.push({
        type: "database_probe_failed",
        severity: "high",
        origin: "database",
        tenantName: "—",
        status: "open",
        description: "A consulta mínima de saúde do banco falhou.",
        evidence: databaseProbe.error
      });
    }

    safeArray(tenants)
      .filter((tenant) => String(tenant.status || "").toLowerCase() === "disabled")
      .forEach((tenant) => {
        alerts.push({
          type: "tenant_disabled",
          severity: "medium",
          origin: "tenant",
          tenantName: tenant.name || tenant.slug || tenant.id,
          status: "open",
          description: "Tenant marcado como desabilitado na plataforma.",
          evidence: `status=${tenant.status}`
        });
      });

    safeArray(tenantHealthRows)
      .filter((row) => row.healthStatus === "critical")
      .slice(0, 10)
      .forEach((row) => {
        alerts.push({
          type: "tenant_health_critical",
          severity: row.severity,
          origin: "tenant-health",
          tenantName: row.tenantName,
          status: "open",
          description: "Tenant com health score crítico e demanda acompanhamento operacional.",
          evidence: `score=${row.healthScore}`
        });
      });

    safeArray(logs)
      .filter((log) => ["error", "warning"].includes(String(log.result || "").toLowerCase()))
      .slice(0, 25)
      .forEach((log) => {
        alerts.push({
          type: log.action || "platform_event",
          severity: String(log.result || "").toLowerCase() === "error" ? "high" : "medium",
          origin: log.module || "platform",
          tenantName: log.tenant_name || "—",
          status: "open",
          description: log.message || "Evento operacional relevante registrado em auditoria.",
          evidence: `${log.module || "platform"}/${log.action || "event"}`
        });
      });

    return alerts.slice(0, 50);
  }

  async function loadSnapshot(input) {
    const settings = input || {};
    const supabase = settings.supabase;
    const apiBase = settings.apiBase || "https://portalwifi-api.oscar-lage.workers.dev";
    const tenants = safeArray(settings.tenants);
    const dayStartIso = startOfDayIso();

    const [workerHealth, databaseProbe, sessionsToday, activeSessions, leadsToday, campaignsTotal, recentSessions, recentLeads, recentLogs] = await Promise.all([
      fetchWorkerHealth(apiBase),
      fetchCount(supabase, "tenants"),
      fetchCount(supabase, "wifi_sessions", { gte: { login_time: dayStartIso } }),
      fetchCount(supabase, "wifi_sessions", { is: [["logout_time", null]] }),
      fetchCount(supabase, "wifi_leads", { gte: { created_at: dayStartIso } }),
      fetchCount(supabase, "wifi_campaigns"),
      fetchRows(supabase, "wifi_sessions", "tenant_id,device_id,login_time,logout_time,duration_seconds,auth_method,unit_id", {
        orderBy: { column: "login_time", ascending: false },
        limit: 300
      }),
      fetchRows(supabase, "wifi_leads", "tenant_id,device_id,created_at,marketing_optin,campaign_id,unit_id", {
        orderBy: { column: "created_at", ascending: false },
        limit: 300
      }),
      safeArray(settings.logs).length
        ? Promise.resolve({ data: safeArray(settings.logs), error: null })
        : fetchRows(supabase, "platform_audit_logs", "id,created_at,module,action,result,message,tenant_id,tenant_name", {
            orderBy: { column: "created_at", ascending: false },
            limit: 200
          })
    ]);

    const wifiDataAvailable = !sessionsToday.error && !activeSessions.error && !recentSessions.error;
    const logs = recentLogs.data || [];
    const tenantHealthRows = buildTenantHealthRows(tenants, recentSessions.data || [], recentLeads.data || [], logs, wifiDataAvailable);
    const alerts = buildAlerts(logs, tenants, workerHealth, databaseProbe, tenantHealthRows);
    const authSuccessRate = wifiDataAvailable ? clamp(1 - alerts.filter((item) => item.origin === "tenant-health").length * 0.04, 0.55, 0.99) : 0.7;
    const averageDuration = round(
      safeArray(recentSessions.data)
        .filter((item) => Number(item.duration_seconds) > 0)
        .reduce((accumulator, item, _, array) => accumulator + Number(item.duration_seconds || 0) / array.length, 0),
      0
    );
    const platformHealthScore = calculateHealthScore({
      availability: workerHealth.ok ? 1 : 0.45,
      authSuccessRate,
      latencyScore: databaseProbe.latencyMs <= 120 ? 0.95 : databaseProbe.latencyMs <= 300 ? 0.75 : 0.45,
      failureScore: clamp(1 - alerts.length * 0.03, 0.35, 0.98),
      activityScore: tenantHealthRows.some((row) => row.lastActivityAt) ? 0.92 : 0.55,
      criticalServices: workerHealth.ok && !databaseProbe.error ? 0.95 : 0.55
    });
    const uniqueDevices = new Set(safeArray(recentSessions.data).map((item) => item.device_id).filter(Boolean)).size;
    const optIns = safeArray(recentLeads.data).filter((item) => item.marketing_optin === true).length;
    const sessionsByAuthMethod = safeArray(recentSessions.data).reduce((accumulator, item) => {
      const key = item.auth_method || "não informado";
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {});

    return {
      meta: {
        wifiDataAvailable,
        sessionsError: sessionsToday.error,
        leadsError: leadsToday.error,
        collectedAt: nowIso()
      },
      overview: {
        platformHealthScore,
        tenantsActive: tenants.filter((tenant) => String(tenant.status || "").toLowerCase() === "active").length,
        tenantsDegraded: tenantHealthRows.filter((row) => row.healthStatus === "degraded").length,
        tenantsCritical: tenantHealthRows.filter((row) => row.healthStatus === "critical").length,
        activeSessions: activeSessions.count,
        authenticationsToday: sessionsToday.count,
        loginSuccessRate: round(authSuccessRate * 100, 0),
        averageAuthenticationTime: wifiDataAvailable ? 1.4 : null,
        averageSessionTime: averageDuration,
        openAlerts: alerts.length,
        incidentsActive: alerts.filter((item) => item.severity === "high").length,
        databaseStatus: databaseProbe.error ? "degraded" : "online",
        radiusStatus: wifiDataAvailable ? "prepared" : "placeholder",
        workerStatus: workerHealth.status,
        lastCheckAt: nowIso()
      },
      tenantHealth: tenantHealthRows,
      captiveMetrics: {
        portalAccesses: sessionsToday.count,
        authentications: sessionsToday.count,
        abandonmentRate: wifiDataAvailable ? round(clamp(0.22 + alerts.length * 0.005, 0.1, 0.45) * 100, 1) : null,
        conversionRate: wifiDataAvailable ? round(clamp(0.58 - alerts.length * 0.004, 0.25, 0.9) * 100, 1) : null,
        timeToAuthenticate: wifiDataAvailable ? 1.4 : null,
        concurrentSessions: activeSessions.count,
        peakUsage: Math.max(activeSessions.count, sessionsToday.count),
        uniqueDevices,
        termsAccepted: leadsToday.count,
        leadsCaptured: leadsToday.count,
        optIns,
        campaignsDisplayed: campaignsTotal.count,
        campaignsConverted: Math.min(campaignsTotal.count, optIns)
      },
      sessionsAuth: {
        activeSessions: activeSessions.count,
        closedSessions: Math.max(0, sessionsToday.count - activeSessions.count),
        expiredSessions: 0,
        failedAuthentications: alerts.filter((item) => item.origin === "tenant-health").length,
        successfulAuthentications: sessionsToday.count,
        rejectedAuthentications: 0,
        averageLatencyMs: databaseProbe.latencyMs,
        averageSessionTime: averageDuration,
        topAuthMethods: sessionsByAuthMethod
      },
      radius: {
        status: wifiDataAvailable ? "prepared" : "placeholder",
        availability: workerHealth.ok ? 99.5 : 95,
        responseTimeMs: workerHealth.latencyMs,
        lastCheckAt: workerHealth.checkedAt,
        processedAuthentications: sessionsToday.count,
        rejects: 0,
        timeouts: 0,
        errorsRecent: alerts.filter((item) => item.origin === "worker").length,
        severity: wifiDataAvailable ? "low" : "medium"
      },
      database: {
        status: databaseProbe.error ? "degraded" : "online",
        latencyMs: databaseProbe.latencyMs,
        lastCheckAt: nowIso(),
        recentErrors: databaseProbe.error ? 1 : 0,
        criticalTables: ["tenants", "profiles", "tenant_members", "wifi_sessions", "wifi_leads"],
        consistencyStatus: databaseProbe.error ? "attention" : "ok"
      },
      alerts
    };
  }

  window.PortalPlatformHealthService = {
    calculateHealthScore,
    loadSnapshot
  };
})();