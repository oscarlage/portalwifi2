import { createClient } from "https://esm.sh/@supabase/supabase-js"

const supabase = createClient(
  window.PORTAL_SUPABASE_URL,
  window.PORTAL_SUPABASE_ANON_KEY
)

export async function checkAuthRedirect() {

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    window.location.href = "/login.html"
    return
  }

  const userId = session.user.id

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single()

  if (error || !profile) {
    console.error("perfil não encontrado")
    window.location.href = "/login.html"
    return
  }

  if (profile.status !== "active") {
    window.location.href = "/login.html"
    return
  }

  if (profile.is_platform_user === true) {

    window.location.href = "/platform.html"

  } else {

    const { data: membership } = await supabase
      .from("tenant_members")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)

    if (!membership || membership.length === 0) {
      window.location.href = "/login.html"
      return
    }

    sessionStorage.setItem("tenant_id", membership[0].tenant_id)
    sessionStorage.setItem("tenant_role", membership[0].role)

    window.location.href = "/estabelecimento/index.html"
  }
}
