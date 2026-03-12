import { createClient } from "https://esm.sh/@supabase/supabase-js"

const supabase = createClient(
  window.PORTAL_SUPABASE_URL,
  window.PORTAL_SUPABASE_ANON_KEY
)

async function redirectToLogin(reason = "") {
  try {
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

    if (profile.is_platform_user === true) {
      window.location.replace("/platform.html")
      return
    }

    const { data: membership, error: membershipError } = await supabase
      .from("tenant_members")
      .select("tenant_id, role")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)

    if (membershipError) {
      console.error("erro ao buscar vínculo do tenant:", membershipError)
      await redirectToLogin("membership_error")
      return
    }

    if (!membership || membership.length === 0) {
      console.warn("usuário sem vínculo ativo com tenant")
      await redirectToLogin("no_active_membership")
      return
    }

    sessionStorage.setItem("tenant_id", membership[0].tenant_id)
    sessionStorage.setItem("tenant_role", membership[0].role)

    window.location.replace("/estabelecimento/index.html")
  } catch (err) {
    console.error("falha inesperada em checkAuthRedirect:", err)
    await redirectToLogin("unexpected_error")
  }
}
