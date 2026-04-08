import { createClient } from "https://esm.sh/@supabase/supabase-js"
import {
  canAccessGlobalAdmin,
  canAccessTenantAdmin,
  resolveAccessContext
} from "./core/permissions.js"

const supabase = createClient(
  window.PORTAL_SUPABASE_URL,
  window.PORTAL_SUPABASE_ANON_KEY
)

const AUTH_CONTEXT_KEY = "portalwifi.authContext"
const TENANT_MEMBERSHIPS_KEY = "portalwifi.tenantMemberships"
const ACTIVE_TENANT_ID_KEY = "portalwifi.activeTenantId"
const ACTIVE_TENANT_NAME_KEY = "portalwifi.activeTenantName"
const ACTIVE_TENANT_SLUG_KEY = "portalwifi.activeTenantSlug"

function clearStoredAccessContext() {
  sessionStorage.removeItem("tenant_id")
  sessionStorage.removeItem("tenant_role")
  sessionStorage.removeItem("tenant_unit_id")
  sessionStorage.removeItem(AUTH_CONTEXT_KEY)
  sessionStorage.removeItem(TENANT_MEMBERSHIPS_KEY)
  localStorage.removeItem(ACTIVE_TENANT_ID_KEY)
  localStorage.removeItem(ACTIVE_TENANT_NAME_KEY)
  localStorage.removeItem(ACTIVE_TENANT_SLUG_KEY)
}

function persistAccessContext(profile, memberships) {
  const access = resolveAccessContext(profile, memberships)

  sessionStorage.setItem(AUTH_CONTEXT_KEY, JSON.stringify({
    scope: access.scope,
    platformRole: access.platformRole,
    tenantRole: access.tenantRole,
    canAccessGlobalAdmin: access.canAccessGlobalAdmin,
    canAccessTenantAdmin: access.canAccessTenantAdmin
  }))
  sessionStorage.setItem(TENANT_MEMBERSHIPS_KEY, JSON.stringify(access.memberships))

  return access
}

async function hydrateActiveTenant(tenantId) {
  if (!tenantId) return

  try {
    const { data } = await supabase
      .from("tenants")
      .select("id,name,slug")
      .eq("id", tenantId)
      .maybeSingle()

    localStorage.setItem(ACTIVE_TENANT_ID_KEY, tenantId)

    if (data?.name) {
      localStorage.setItem(ACTIVE_TENANT_NAME_KEY, data.name)
    }

    if (data?.slug) {
      localStorage.setItem(ACTIVE_TENANT_SLUG_KEY, data.slug)
    }
  } catch (error) {
    console.warn("Falha ao hidratar tenant ativo:", error)
    localStorage.setItem(ACTIVE_TENANT_ID_KEY, tenantId)
  }
}

async function redirectToLogin(reason = "") {
  try {
    clearStoredAccessContext()
    await supabase.auth.signOut()
  } catch (e) {
    console.error("erro ao encerrar sessão:", e)
  }

  const url = reason ? `/login.html?error=${encodeURIComponent(reason)}` : "/login.html"
  window.location.replace(url)
}

export async function checkAuthRedirect() {
  try {
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession()

    if (sessionError) {
      console.error("erro ao obter sessão:", sessionError)
      await redirectToLogin("session_error")
      return
    }

    if (!session) {
      window.location.replace("/login.html")
      return
    }

    const userId = session.user.id

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single()

    if (profileError || !profile) {
      console.error("perfil não encontrado:", profileError)
      await redirectToLogin("profile_not_found")
      return
    }

    if (profile.status !== "active") {
      console.warn("usuário inativo, status =", profile.status)
      await redirectToLogin("user_inactive")
      return
    }

    const { data: memberships, error: membershipError } = await supabase
      .from("tenant_members")
      .select("tenant_id, role, is_active, unit_id")
      .eq("user_id", userId)
      .eq("is_active", true)

    if (membershipError) {
      console.error("erro ao buscar vínculo do tenant:", membershipError)
      await redirectToLogin("membership_error")
      return
    }

    const access = persistAccessContext(profile, memberships || [])

    if (canAccessGlobalAdmin(profile, memberships || [])) {
      window.location.replace("/platform.html")
      return
    }

    if (!canAccessTenantAdmin(profile, memberships || [])) {
      console.warn("usuário sem vínculo ativo com tenant")
      await redirectToLogin("no_active_membership")
      return
    }

    const primaryMembership = access.memberships[0]

    if (!primaryMembership?.tenant_id) {
      await redirectToLogin("tenant_context_invalid")
      return
    }

    sessionStorage.setItem("tenant_id", primaryMembership.tenant_id)
    sessionStorage.setItem("tenant_role", primaryMembership.role || access.tenantRole || "tenant_viewer")
    if (primaryMembership.unit_id) {
      sessionStorage.setItem("tenant_unit_id", primaryMembership.unit_id)
    }

    await hydrateActiveTenant(primaryMembership.tenant_id)

    window.location.replace(`/estabelecimento/index.html?tenant_id=${encodeURIComponent(primaryMembership.tenant_id)}`)
  } catch (err) {
    console.error("falha inesperada em checkAuthRedirect:", err)
    await redirectToLogin("unexpected_error")
  }
}
