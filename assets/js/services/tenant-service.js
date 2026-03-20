// js/services/tenant-service.js

import { getSupabaseClient } from '../core/supabase-client.js';

export async function getTenantById(tenantId) {
  if (!tenantId) {
    throw new Error('tenantId é obrigatório.');
  }

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (error) {
    throw new Error(`Erro ao buscar tenant: ${error.message}`);
  }

  return data;
}

export async function getTenantBySlug(slug) {
  if (!slug) {
    throw new Error('slug é obrigatório.');
  }

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    throw new Error(`Erro ao buscar tenant por slug: ${error.message}`);
  }

  return data;
}

export async function listTenants() {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Erro ao listar tenants: ${error.message}`);
  }

  return data || [];
}
