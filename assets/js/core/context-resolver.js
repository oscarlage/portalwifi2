// js/core/context-resolver.js

import { getTenantById } from '../services/tenant-service.js';
import { getDefaultUnitByTenant, getUnitById } from '../services/unit-service.js';
import { resolveTimezone } from './timezone.js';

export async function resolveOperationalContext(tenantId, unitId = null) {
  if (!tenantId) {
    throw new Error('tenantId é obrigatório para resolver o contexto.');
  }

  const tenant = await getTenantById(tenantId);

  if (!tenant) {
    throw new Error('Tenant não encontrado.');
  }

  let unit = null;

  if (unitId) {
    try {
      unit = await getUnitById(tenantId, unitId);
    } catch (err) {
      console.warn('Unidade informada não encontrada, tentando unidade padrão.', err);
    }
  }

  if (!unit) {
    unit = await getDefaultUnitByTenant(tenantId);
  }

  const timezone = resolveTimezone(
    null,
    unit?.timezone || null,
    tenant?.timezone || null
  );

  return {
    tenant,
    tenant_id: tenant.id,
    unit: unit || null,
    unit_id: unit?.id || null,
    timezone,
  };
}

export function getCurrentTenantIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('tenant_id') || params.get('tenant');
}

export function getCurrentUnitIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('unit_id') || params.get('unit');
}

export async function resolveContextFromUrl() {
  const tenantId = getCurrentTenantIdFromUrl();
  const unitId = getCurrentUnitIdFromUrl();

  if (!tenantId) {
    throw new Error('Tenant não informado na URL.');
  }

  return resolveOperationalContext(tenantId, unitId);
}
