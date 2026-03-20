// js/core/supabase-client.js

let supabaseInstance = null;

export function initSupabaseClient(url, anonKey) {
  if (!url || !anonKey) {
    throw new Error('Supabase URL e ANON KEY são obrigatórios.');
  }

  if (!window.supabase?.createClient) {
    throw new Error('SDK do Supabase não encontrado em window.supabase.');
  }

  supabaseInstance = window.supabase.createClient(url, anonKey);
  return supabaseInstance;
}

export function getSupabaseClient() {
  if (!supabaseInstance) {
    throw new Error('Supabase client ainda não foi inicializado.');
  }

  return supabaseInstance;
}
