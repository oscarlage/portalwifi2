import { getSupabaseClient } from '../core/supabase-client.js';
import { getEffectivePortalSettings } from './portal-service.js';
import { listUnitsByTenant } from './unit-service.js';

function normalizeCampaign(campaign = {}) {
	return {
		id: campaign.id || null,
		tenant_id: campaign.tenant_id || null,
		unit_id: campaign.unit_id || null,
		title: campaign.title || '',
		active: campaign.active !== false,
		campaign_type: campaign.campaign_type || 'portal',
		starts_at: campaign.starts_at || null,
		ends_at: campaign.ends_at || null,
		priority: Number(campaign.priority || 0),
	};
}

export async function listCampaignBindings(tenantId, { onlyActive = false } = {}) {
	if (!tenantId) {
		throw new Error('tenantId é obrigatório.');
	}

	const supabase = getSupabaseClient();
	let query = supabase
		.from('wifi_campaigns')
		.select('id, tenant_id, unit_id, title, active, campaign_type, starts_at, ends_at, priority')
		.eq('tenant_id', tenantId)
		.order('priority', { ascending: false })
		.order('created_at', { ascending: false });

	if (onlyActive) {
		query = query.eq('active', true);
	}

	const { data, error } = await query;

	if (error) {
		throw new Error(`Erro ao listar vínculos de campanhas: ${error.message}`);
	}

	return (data || []).map(normalizeCampaign);
}

export async function getBindingSnapshot(tenantId, unitId = null) {
	if (!tenantId) {
		throw new Error('tenantId é obrigatório.');
	}

	const [units, portalSettings, campaigns] = await Promise.all([
		listUnitsByTenant(tenantId),
		getEffectivePortalSettings(tenantId, unitId),
		listCampaignBindings(tenantId, { onlyActive: true }),
	]);

	const selectedUnit = unitId
		? units.find((unit) => unit.id === unitId) || null
		: null;

	return {
		tenant_id: tenantId,
		unit_id: unitId || null,
		unit: selectedUnit,
		units,
		portal: portalSettings,
		campaigns: campaigns.filter((campaign) => !unitId || !campaign.unit_id || campaign.unit_id === unitId),
	};
}

export async function getActivePortalBinding(tenantId, unitId = null) {
	const snapshot = await getBindingSnapshot(tenantId, unitId);
	return {
		tenant_id: snapshot.tenant_id,
		unit_id: snapshot.unit_id,
		portal: snapshot.portal,
		campaign: snapshot.campaigns[0] || null,
	};
}

