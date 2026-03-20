// js/services/unit-service.js

import { getSupabaseClient } from '../core/supabase-client.js';

export async function listUnitsByTenant(tenantId, { onlyActive = false } = {}) {
  if (!tenantId) {
    throw new Error('tenantId é obrigatório.');
  }

  const supabase = getSupabaseClient();

  let query = supabase
    .from('tenant_units')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('is_active', { ascending: false })
    .order('name', { ascending: true });

  if (onlyActive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao listar unidades: ${error.message}`);
  }

  return data || [];
}

export async function getUnitById(tenantId, unitId) {
  if (!tenantId || !unitId) {
    throw new Error('tenantId e unitId são obrigatórios.');
  }

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('tenant_units')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', unitId)
    .single();

  if (error) {
    throw new Error(`Erro ao buscar unidade: ${error.message}`);
  }

  return data;
}

export async function getDefaultUnitByTenant(tenantId) {
  if (!tenantId) {
    throw new Error('tenantId é obrigatório.');
  }

  const supabase = getSupabaseClient();

  let { data, error } = await supabase
    .from('tenant_units')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('code', 'matriz')
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar unidade padrão: ${error.message}`);
  }

  if (data) {
    return data;
  }

  const fallback = await supabase
    .from('tenant_units')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fallback.error) {
    throw new Error(`Erro ao buscar fallback de unidade: ${fallback.error.message}`);
  }

  return fallback.data || null;
}

export async function createUnit(tenantId, payload) {
  if (!tenantId) {
    throw new Error('tenantId é obrigatório.');
  }

  const supabase = getSupabaseClient();

  const insertPayload = {
    tenant_id: tenantId,
    name: payload.name?.trim(),
    code: payload.code?.trim() || null,
    slug: payload.slug?.trim() || null,
    address_line: payload.address_line || null,
    address_number: payload.address_number || null,
    address_complement: payload.address_complement || null,
    district: payload.district || null,
    city: payload.city || null,
    state: payload.state || null,
    zip_code: payload.zip_code || null,
    country: payload.country || 'Brasil',
    phone: payload.phone || null,
    whatsapp: payload.whatsapp || null,
    contact_email: payload.contact_email || null,
    timezone: payload.timezone || 'America/Sao_Paulo',
    is_active: payload.is_active ?? true,
  };

  const { data, error } = await supabase
    .from('tenant_units')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar unidade: ${error.message}`);
  }

  return data;
}

export async function updateUnit(tenantId, unitId, payload) {
  if (!tenantId || !unitId) {
    throw new Error('tenantId e unitId são obrigatórios.');
  }

  const supabase = getSupabaseClient();

  const updatePayload = {
    name: payload.name?.trim(),
    code: payload.code?.trim() || null,
    slug: payload.slug?.trim() || null,
    address_line: payload.address_line || null,
    address_number: payload.address_number || null,
    address_complement: payload.address_complement || null,
    district: payload.district || null,
    city: payload.city || null,
    state: payload.state || null,
    zip_code: payload.zip_code || null,
    country: payload.country || 'Brasil',
    phone: payload.phone || null,
    whatsapp: payload.whatsapp || null,
    contact_email: payload.contact_email || null,
    timezone: payload.timezone || 'America/Sao_Paulo',
    is_active: payload.is_active ?? true,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('tenant_units')
    .update(updatePayload)
    .eq('tenant_id', tenantId)
    .eq('id', unitId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar unidade: ${error.message}`);
  }

  return data;
}

export async function toggleUnitStatus(tenantId, unitId, isActive) {
  return updateUnit(tenantId, unitId, { is_active: !!isActive });
}
