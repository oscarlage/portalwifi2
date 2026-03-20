// js/services/portal-service.js

import { getSupabaseClient } from '../core/supabase-client.js';
import { resolveOperationalContext } from '../core/context-resolver.js';

export async function getPortalSettingsByTenant(tenantId) {
  if (!tenantId) {
    throw new Error('tenantId é obrigatório.');
  }

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('portal_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    throw new Error(`Erro ao buscar portal do tenant: ${error.message}`);
  }

  return data;
}

export async function getPortalSettingsByUnit(unitId) {
  if (!unitId) {
    return null;
  }

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('portal_unit_settings')
    .select('*')
    .eq('unit_id', unitId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar portal da unidade: ${error.message}`);
  }

  return data || null;
}

export function mergePortalSettings(tenantSettings, unitSettings) {
  if (!unitSettings) {
    return { ...tenantSettings };
  }

  const merged = { ...tenantSettings };

  for (const [key, value] of Object.entries(unitSettings)) {
    if (value !== null && key !== 'unit_id') {
      merged[key] = value;
    }
  }

  return merged;
}

export async function getEffectivePortalSettings(tenantId, unitId = null) {
  const context = await resolveOperationalContext(tenantId, unitId);

  const tenantSettings = await getPortalSettingsByTenant(context.tenant_id);
  const unitSettings = context.unit_id
    ? await getPortalSettingsByUnit(context.unit_id)
    : null;

  const mergedSettings = mergePortalSettings(tenantSettings, unitSettings);

  return {
    ...mergedSettings,
    _context: context,
    _source: {
      tenant: true,
      unit: !!unitSettings,
    },
  };
}
